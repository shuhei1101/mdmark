import { expect, test } from "@playwright/test";
import { buildDistRoot, checkInNode, removeDistRoot } from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

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

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// ずれの無い索引と文書では、空のずれの一覧を返す（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const index = {
    schema: 1,
    docs: [
      {
        id: "arch",
        path: "arch.md",
        title: "アーキテクチャ",
        tags: ["設計"],
      },
      {
        id: "api",
        path: "api.md",
        title: "API",
        related: ["arch"],
        tags: [{ name: "設計", main: true }],
      },
    ],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    ],
  };
  const documents = { "arch.md": "# アーキテクチャ\n", "api.md": "# API\n" };
  // 実行
  const issues = await checkInNode(builtRoot, { index, documents });
  // 検証
  expect(issues).toEqual([]);
});

// 消えた文書・索引に無い文書・切れた id・用語の重複を、場所と種類つきで返す（正常シナリオ（ずれがある））
test("test_normal_when_drift", async () => {
  // 準備
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
  const issues = await checkInNode(builtRoot, {
    index,
    documents,
    indexFile: "docs/index.yaml",
  });
  // 検証
  // 索引にあって消えた文書は、索引のファイルとその場所を持つ
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "docs/index.yaml",
      where: "docs[1].path",
      kind: "missing_doc",
    }),
  );
  // 索引に無い文書は、その文書のファイルを持つ
  expect(issues).toContainEqual(
    expect.objectContaining({ file: "new.md", where: "", kind: "orphan_doc" }),
  );
  // 切れた id は、その related の場所を持つ
  const broken = issues.find((issue) => issue.kind === "broken_ref");
  expect(broken).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[0].related[0]",
  });
  expect(broken?.message).toContain("gone");
  // 用語の重複は、索引の terms どうし・索引と api の表・api と guide の表の 3 件
  const duplicates = issues.filter((issue) => issue.kind === "duplicate_term");
  expect(duplicates).toHaveLength(3);
  expect(duplicates.map((issue) => issue.file)).toEqual([
    "docs/index.yaml",
    "api.md",
    "guide.md",
  ]);
  // 各行が、ずれの種類と直す場所が分かる内容を持つ
  for (const issue of issues) {
    expect(issue.message.length).toBeGreaterThan(0);
  }
});

// Schema に合わない索引でも例外で止まらず、Schema のずれの行を返す（正常シナリオ（Schema に合わない索引））
test("test_normal_when_invalid_schema", async () => {
  // 準備
  const index = {
    docs: [
      { id: "a", path: "a.md", title: "A" },
      { id: "b", title: "B" },
    ],
  };
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = await checkInNode(builtRoot, { index, documents });
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
});

// 本文に出た用語のやめた言い方を、行とやめた言い方の組ごとに返す（正常シナリオ（やめた言い方が本文に出る））
test("test_normal_when_avoided_term", async () => {
  // 準備
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
  // 1 行目に作業場が 2 回、3 行目に 1 回、5 行目はワークスペースだけ
  const guide = [
    "作業場を開き、作業場に記録を置く。",
    "",
    "作業場の記録を確かめる。",
    "",
    "ワークスペースを閉じる。",
    "",
  ].join("\n");
  // 実行
  const issues = await checkInNode(builtRoot, {
    index,
    documents: { "guide.md": guide },
  });
  // 検証
  // 同じ行に 2 回出た 1 行目は 1 件にまとまり、ワークスペースだけの 5 行目と、ほかの種類のずれは返らない
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
  ]);
  // 各行の内容が、やめた言い方と代わりに使う用語を示す
  for (const issue of issues) {
    expect(issue.message).toContain("作業場");
    expect(issue.message).toContain("ワークスペース");
  }
});

// 用語集の表のやめた言い方を、表を持たない文書の本文からも返す（正常シナリオ（用語集の表のやめた言い方が本文に出る））
test("test_normal_when_glossary_avoided_term", async () => {
  // 準備
  const index = {
    schema: 1,
    docs: [
      { id: "glossary", path: "glossary.md", title: "用語集" },
      { id: "guide", path: "guide.md", title: "手引き" },
    ],
  };
  // glossary は表の中に 作業場・ワーク場 を持つ。guide は 1 行目に 作業場、3 行目に ワーク場、5 行目に ワークスペース
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
  const issues = await checkInNode(builtRoot, {
    index,
    documents: { "glossary.md": glossary, "guide.md": guide },
  });
  // 検証
  // guide の 2 件だけを返し、glossary の表の中の言い方と、ワークスペースだけの 5 行目と、ほかの種類のずれは返さない
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
  ]);
  // 各行の内容が、やめた言い方と代わりに使う用語を示す
  expect(issues[0]?.message).toContain("作業場");
  expect(issues[0]?.message).toContain("ワークスペース");
  expect(issues[1]?.message).toContain("ワーク場");
  expect(issues[1]?.message).toContain("ワークスペース");
});

// 語彙の重なり・切れた振り替え先・語彙に無いタグ・やめたタグを、場所と近いタグ・振り替え先つきで返す（正常シナリオ（タグが語彙とずれる））
test("test_normal_when_tag_drift", async () => {
  // 準備
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
  const issues = await checkInNode(builtRoot, { index, documents });
  // 検証
  // 語彙に載った `topic:mcp` のタグ（`docs[0].tags[0]`）の行は返らない
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
