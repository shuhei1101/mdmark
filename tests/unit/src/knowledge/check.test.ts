import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import { parseDocument } from "../../../../src/knowledge/references.ts";
import {
  AVOIDED_GUIDE,
  AVOIDED_TERMS,
  glossaryDocument,
} from "../../helpers/index-fixtures.ts";

/** 索引の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/knowledge/check.ts");

/** 文書の本文を、点検が読むトークンにする */
const tokensOf = (body: string) =>
  parseDocument({ body, docId: "guide", defaults: { ...DEFAULT_FEATURES } })
    .tokens;

// ずれの無い索引で空を返す（正常系）
test("test_check_index", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
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

// 消えた文書・索引に無い文書・切れた id・用語の重複 3 種を返す（正常系）
test("test_check_index_when_drift", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
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
  // 用語集の表の最初の行は 5 行目になる
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
  expect(issues.map((issue) => issue.kind)).toEqual([
    "missing_doc",
    "orphan_doc",
    "broken_ref",
    "duplicate_term",
    "duplicate_term",
    "duplicate_term",
  ]);
  expect(issues[0]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[1].path",
  });
  expect(issues[1]).toMatchObject({ file: "new.md", where: "" });
  expect(issues[2]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[0].related[0]",
  });
  expect(issues[2]?.message).toContain("gone");
  // 用語の重複は、重なった組の後ろの側を指し、message にもう片方の場所を書く
  expect(issues[3]).toMatchObject({
    file: "docs/index.yaml",
    where: "terms[1].term",
  });
  expect(issues[3]?.message).toContain("terms[0]");
  expect(issues[4]).toMatchObject({ file: "api.md", where: "5 行目" });
  expect(issues[4]?.message).toContain("docs/index.yaml");
  expect(issues[5]).toMatchObject({ file: "guide.md", where: "5 行目" });
  expect(issues[5]?.message).toContain("api.md");
});

// Schema に合わない索引で例外を投げず schema のずれを返す（異常系）
test("test_check_index_when_invalid_schema", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
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
  // docs[0] の文書について、ほかの種類のずれが無い
  expect(issues.every((issue) => issue.kind === "schema")).toBe(true);
});

// 本文に出たやめた言い方を、行とやめた言い方の組ごとに avoided_term で返す（正常系）
test("test_check_index_when_avoided_term", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [{ id: "guide", path: "guide.md", title: "手引き" }],
    terms: AVOIDED_TERMS,
  };
  const documents = { "guide.md": AVOIDED_GUIDE };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  // 見出し（1 行目）と行内のコード（5 行目）、同じ行に 2 回出た 3 行目の 2 回目は件数に入らない
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

// 段落・段落の 2 行目・表のセルのやめた言い方をその行で返す（正常系）
test("test_find_avoided_terms", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const tokens = tokensOf(AVOIDED_GUIDE);
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens,
    terms: AVOIDED_TERMS,
  });
  // 検証
  expect(issues.map((issue) => issue.where)).toEqual([
    "3 行目",
    "8 行目",
    "12 行目",
  ]);
  for (const issue of issues) {
    expect(issue.file).toBe("guide.md");
    expect(issue.kind).toBe("avoided_term");
    expect(issue.message).toContain("作業場");
    expect(issue.message).toContain("ワークスペース");
  }
});

// 見出し・リンクの中・行内のコード・コードブロック・用語集の表の中のやめた言い方を返さない（正常系）
test("test_find_avoided_terms_ignores_code_links_and_headings", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const body = [
    "# 作業場の手引き",
    "",
    "[作業場の一覧](./list.md)",
    "",
    "`作業場`",
    "",
    "```text",
    "作業場を開く",
    "```",
    "",
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 作業場 | 記録を置く場所 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf(body),
    terms: AVOIDED_TERMS,
  });
  // 検証
  expect(issues).toEqual([]);
});

// やめた言い方が用語の語の一部として出たところを数えず、同じ行に 2 回出たやめた言い方を 1 件にまとめる（正常系）
test("test_find_avoided_terms_prefers_term_words", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const terms = [
    { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    { id: "job", term: "仕事", meaning: "取り組むこと", avoid: ["ワーク"] },
  ];
  // 1 行目の ワークスペース は用語の語に当たり、3 行目の ワーク が 2 回だけやめた言い方に当たる
  const body = ["ワークスペースを開く。", "", "ワークとワーク。", ""].join(
    "\n",
  );
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf(body),
    terms,
  });
  // 検証
  expect(issues.map((issue) => issue.where)).toEqual(["3 行目"]);
});
