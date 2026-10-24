import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";

/** 索引から文書を探す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFind = () => import("../../../../src/knowledge/find.ts");

/** 文書を並べた索引を作る（タグの語彙は任意） */
function createIndex(
  docs: MdmarkIndex["docs"],
  tags?: MdmarkIndex["tags"],
): MdmarkIndex {
  return tags === undefined ? { schema: 1, docs } : { schema: 1, docs, tags };
}

/** 当たった文書の ID を並べる */
function idsOf(docs: { id: string }[]): string[] {
  return docs.map((doc) => doc.id);
}

/** タグを AND / OR で引くテストが共有する索引（主題のタグが当たる文書を上に並べる確認ができる並び） */
function createTaggedIndex(): MdmarkIndex {
  return createIndex(
    [
      { id: "c", path: "c.md", title: "C", tags: ["topic:yaml"] },
      {
        id: "a",
        path: "a.md",
        title: "A",
        tags: [{ name: "topic:mcp", main: true }],
      },
      {
        id: "b",
        path: "b.md",
        title: "B",
        tags: ["topic:mcp", { name: "topic:yaml", main: true }],
      },
      { id: "d", path: "d.md", title: "D", tags: ["設計"] },
    ],
    [{ name: "topic:mcp" }, { name: "topic:yaml" }],
  );
}

// 題の一部で引く（正常系）
test("test_find_docs", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    { id: "a", path: "a.md", title: "文書 A" },
    { id: "b", path: "b.md", title: "文書 B" },
  ]);
  // 実行
  const result = findDocs({ index, text: "文書 a" });
  // 検証
  expect(idsOf(result.docs)).toEqual(["a"]);
});

// 別名と概要でも引く（正常系）
test("test_find_docs_when_alias_or_description", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    { id: "a", path: "a.md", title: "A", aliases: ["構成図"] },
    { id: "b", path: "b.md", title: "B", description: "全体の構成" },
    { id: "c", path: "c.md", title: "C" },
  ]);
  // 実行
  const result = findDocs({ index, text: "構成" });
  // 検証
  expect(idsOf(result.docs)).toEqual(["a", "b"]);
});

// 全てのタグを持つ文書に絞る（正常系）
test("test_find_docs_when_tags", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    { id: "a", path: "a.md", title: "A", tags: ["設計", "API"] },
    { id: "b", path: "b.md", title: "B", tags: ["設計"] },
  ]);
  // 実行
  const result = findDocs({ index, tags: ["設計", "API"] });
  // 検証
  expect(idsOf(result.docs)).toEqual(["a"]);
});

// 参照先と被参照を引く（正常系）
test("test_find_docs_when_related_to", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    { id: "a", path: "a.md", title: "A" },
    { id: "b", path: "b.md", title: "B" },
    { id: "c", path: "c.md", title: "C" },
    { id: "d", path: "d.md", title: "D" },
  ]);
  const references = { backlinks: { a: ["c"], b: ["a"] }, glossary: [] };
  // 実行
  const result = findDocs({ index, references, relatedTo: "a" });
  // 検証
  expect(idsOf(result.docs)).toEqual(["b", "c"]);
});

// 条件が無ければ全ての文書（正常系）
test("test_find_docs_when_no_condition", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    { id: "a", path: "a.md", title: "A" },
    { id: "b", path: "b.md", title: "B" },
  ]);
  // 実行
  const result = findDocs({ index });
  // 検証
  expect(result.docs).toHaveLength(2);
});

// 当たらなければ空（正常系）
test("test_find_docs_when_no_match", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([{ id: "a", path: "a.md", title: "A" }]);
  // 実行
  const result = findDocs({ index, text: "どの文書にも無い語" });
  // 検証
  expect(result.docs).toEqual([]);
});

// どれかのタグを持つ文書を、主題のタグが当たる文書を上にして返す（正常系）
test("test_find_docs_when_any_tags", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createTaggedIndex();
  // 実行
  const result = findDocs({ index, anyTags: ["topic:mcp", "topic:yaml"] });
  // 検証
  expect(idsOf(result.docs)).toEqual(["a", "b", "c"]);
  expect(result.unknownTags).toEqual([]);
});

// `tags` と `anyTags` の両方を満たす文書に絞る（正常系）
test("test_find_docs_when_tags_and_any_tags", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createTaggedIndex();
  // 実行
  const result = findDocs({
    index,
    tags: ["topic:mcp"],
    anyTags: ["topic:yaml"],
  });
  // 検証
  expect(idsOf(result.docs)).toEqual(["b"]);
});

// 渡したタグと文書のタグの別名を語彙の `name` にそろえて引く（正常系）
test("test_find_docs_when_alias_tag", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex(
    [
      { id: "a", path: "a.md", title: "A", tags: ["topic:mcp"] },
      { id: "b", path: "b.md", title: "B", tags: ["MCP"] },
    ],
    [{ name: "topic:mcp", aliases: ["MCP"] }],
  );
  // 実行
  const result = findDocs({ index, tags: ["MCP"] });
  // 検証
  expect(idsOf(result.docs)).toEqual(["a", "b"]);
  expect(result.unknownTags).toEqual([]);
});

// 語彙に無いタグを拒まず、近いタグと一緒に返す（正常系）
test("test_find_docs_when_unknown_tag", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex(
    [{ id: "a", path: "a.md", title: "A", tags: ["topic:mcp"] }],
    [{ name: "topic:mcp" }],
  );
  // 実行
  const result = findDocs({ index, tags: ["topic:mcq"] });
  // 検証
  expect(result.docs).toEqual([]);
  expect(result.unknownTags).toEqual([
    { tag: "topic:mcq", nearest: "topic:mcp" },
  ]);
});

// 語彙を持たない索引ではタグを書いたとおりの文字で引き、語彙に無いタグを返さない（正常系）
test("test_find_docs_when_no_vocabulary", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([
    {
      id: "a",
      path: "a.md",
      title: "A",
      tags: [{ name: "設計", main: true }],
    },
  ]);
  // 実行
  const found = findDocs({ index, tags: ["設計"] });
  const missed = findDocs({ index, tags: ["設定"] });
  // 検証
  expect(idsOf(found.docs)).toEqual(["a"]);
  expect(found.unknownTags).toEqual([]);
  expect(missed.docs).toEqual([]);
  expect(missed.unknownTags).toEqual([]);
});
