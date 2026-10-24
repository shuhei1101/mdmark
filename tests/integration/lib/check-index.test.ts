import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import type { MdmarkIndexIssue } from "../../../src/index.ts";

type Built = {
  checkIndex: (input: {
    index: unknown;
    documents: Record<string, string>;
    indexFile?: string;
  }) => MdmarkIndexIssue[];
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** 用語集の表を 1 つ持つ本文。`rows` は `[用語, 意味]` の並びで、最初の行が 5 行目になる */
function glossaryDocument(rows: Array<[string, string]>): string {
  return [
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    ...rows.map(([term, meaning]) => `| ${term} | ${meaning} |`),
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
}

// ずれの無い索引と文書で空の一覧を返す（正常系）
test("test_normal", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [
      { id: "arch", path: "arch.md", title: "アーキテクチャ" },
      { id: "api", path: "api.md", title: "API", related: ["arch"] },
    ],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    ],
  };
  const documents = { "arch.md": "# アーキテクチャ\n", "api.md": "# API\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toEqual([]);
});

// 正規化すると同じになる用語の語・別名を用語の重複に、表記の違うやめた言い方を本文のずれにする（正常系）
test("test_normal_when_normalized_words", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [{ id: "guide", path: "guide.md", title: "手引き" }],
    terms: [
      { id: "mcp", term: "MCP", meaning: "Model Context Protocol" },
      {
        id: "mcp-kana",
        term: "エムシーピー",
        aliases: ["ｍｃｐ"],
        meaning: "MCP の読み",
      },
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "記録を置くフォルダ",
        avoid: ["workplace"],
      },
    ],
  };
  const documents = { "guide.md": "WorkPlace を開く。\n" };
  // 実行
  const issues = checkIndex({ index, documents, indexFile: "docs/index.yaml" });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    {
      file: "docs/index.yaml",
      where: "terms[1].aliases[0]",
      kind: "duplicate_term",
    },
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
  ]);
  expect(issues[0]?.message).toContain("ｍｃｐ");
  expect(issues[0]?.message).toContain("terms[0].term");
  expect(issues[1]?.message).toContain("workplace");
  expect(issues[1]?.message).toContain("ワークスペース");
});

// 消えた文書・索引に無い文書・切れた id・用語の重複を返す（正常系）
test("test_normal_when_drift", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [
      { id: "api", path: "api.md", title: "API", related: ["gone"] },
      { id: "old", path: "old.md", title: "旧" },
      { id: "guide", path: "guide.md", title: "使い方" },
    ],
    terms: [
      { id: "ws1", term: "ワークスペース", meaning: "一つ目" },
      { id: "ws2", term: "ワークスペース", meaning: "二つ目" },
    ],
  };
  const documents = {
    "api.md": glossaryDocument([
      ["ワークスペース", "索引と重なる"],
      ["印", "HTML コメントで書く指定"],
    ]),
    "guide.md": glossaryDocument([["印", "api.md と重なる"]]),
    "new.md": "# 新しい文書\n",
  };
  // 実行
  const issues = checkIndex({
    index,
    documents,
    indexFile: "docs/index.yaml",
  });
  // 検証
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "docs/index.yaml",
      where: "docs[1].path",
      kind: "missing_doc",
    }),
  );
  expect(issues).toContainEqual(
    expect.objectContaining({ file: "new.md", where: "", kind: "orphan_doc" }),
  );
  const broken = issues.find((issue) => issue.kind === "broken_ref");
  expect(broken).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[0].related[0]",
  });
  expect(broken?.message).toContain("gone");
  expect(
    issues.filter((issue) => issue.kind === "duplicate_term"),
  ).toHaveLength(3);
  // 種類の並びは missing_doc → orphan_doc → broken_ref → duplicate_term
  const order = ["missing_doc", "orphan_doc", "broken_ref", "duplicate_term"];
  const ranks = issues.map((issue) => order.indexOf(issue.kind));
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
});

// 本文に出た用語のやめた言い方を、行とやめた言い方の組ごとに avoided_term で返す（正常系）
test("test_normal_when_avoided_term", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [{ id: "guide", path: "guide.md", title: "手引き" }],
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
        avoid: ["作業場"],
      },
    ],
  };
  // 1 行目が見出し、3 行目の段落に 2 回、5 行目が行内のコード、7・8 行目が 1 つの段落、10〜12 行目が表
  const guide = [
    "# 作業場の手引き",
    "",
    "作業場を開き、作業場に記録を置く。",
    "",
    "`作業場`",
    "",
    "ワークスペースを閉じる前に",
    "作業場の記録を確かめる。",
    "",
    "| 項目 | 内容 |",
    "| --- | --- |",
    "| 共有 | 作業場の共有 |",
    "",
  ].join("\n");
  // 実行
  const issues = checkIndex({ index, documents: { "guide.md": guide } });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
    { file: "guide.md", where: "8 行目", kind: "avoided_term" },
    { file: "guide.md", where: "12 行目", kind: "avoided_term" },
  ]);
  for (const issue of issues) {
    expect(issue.message).toContain("作業場");
    expect(issue.message).toContain("ワークスペース");
  }
});

// 用語集の表のやめた言い方を、表を持たない文書の本文からも avoided_term で返す（正常系）
test("test_normal_when_glossary_avoided_term", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [
      { id: "glossary", path: "glossary.md", title: "用語集" },
      { id: "guide", path: "guide.md", title: "手引き" },
    ],
  };
  // glossary.md は表の中に 作業場・ワーク場 を持つ。guide.md は 1 行目に 作業場、3 行目に ワーク場、5 行目に ワークスペース
  const glossary = [
    "<!-- glossary: term=用語 meaning=意味 avoid=やめた言い方 -->",
    "",
    "| 用語 | 意味 | やめた言い方 |",
    "| --- | --- | --- |",
    "| ワークスペース | 作業の置き場所 | 作業場、ワーク場 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  const guide = [
    "作業場を開く。",
    "",
    "ワーク場を閉じる。",
    "",
    "ワークスペースを使う。",
    "",
  ].join("\n");
  // 実行
  const issues = checkIndex({
    index,
    documents: { "glossary.md": glossary, "guide.md": guide },
  });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
  ]);
  expect(issues[0]?.message).toContain("作業場");
  expect(issues[0]?.message).toContain("ワークスペース");
  expect(issues[1]?.message).toContain("ワーク場");
  expect(issues[1]?.message).toContain("ワークスペース");
});

// 合わないところごとに schema のずれを返し、例外を投げない（異常系）
test("test_normal_when_invalid_schema", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    docs: [
      { id: "a", path: "a.md", title: "A" },
      { id: "b", title: "B" },
    ],
  };
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "schema",
      kind: "schema",
    }),
  );
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "docs[1].path",
      kind: "schema",
    }),
  );
  expect(issues.every((issue) => issue.kind === "schema")).toBe(true);
});

// タグの語彙の重なり・切れた振り替え先・語彙に無いタグ・やめたタグを返す（正常系）
test("test_normal_when_tag_drift", async () => {
  // 準備
  const { checkIndex } = await loadBuilt();
  const index = {
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        tags: [{ name: "topic:mcp", main: true }, "topic:mcq", "topic:old"],
      },
    ],
    tags: [
      { name: "topic:mcp", aliases: ["MCP"] },
      { name: "topic:yaml", aliases: ["MCP"] },
      { name: "topic:yaml" },
      { name: "topic:old", deprecated: "topic:mcp" },
      { name: "topic:gone", deprecated: "topic:none" },
    ],
  };
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "index.yaml", where: "tags[2].name", kind: "duplicate_tag" },
    {
      file: "index.yaml",
      where: "tags[1].aliases[0]",
      kind: "tag_alias_conflict",
    },
    {
      file: "index.yaml",
      where: "tags[4].deprecated",
      kind: "broken_tag_replacement",
    },
    { file: "index.yaml", where: "docs[0].tags[1]", kind: "unregistered_tag" },
    { file: "index.yaml", where: "docs[0].tags[2]", kind: "deprecated_tag" },
  ]);
  const unregistered = issues.find(
    (issue) => issue.kind === "unregistered_tag",
  );
  expect(unregistered?.message).toContain("topic:mcq");
  expect(unregistered?.message).toContain("topic:mcp");
  const deprecated = issues.find((issue) => issue.kind === "deprecated_tag");
  expect(deprecated?.message).toContain("topic:old");
  expect(deprecated?.message).toContain("topic:mcp");
});
