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
