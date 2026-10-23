import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";

/** 索引から文書を探す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFind = () => import("../../../../src/knowledge/find.ts");

/** 文書を並べた索引を作る */
function createIndex(docs: MdmarkIndex["docs"]): MdmarkIndex {
  return { schema: 1, docs };
}

/** 当たった文書の ID を並べる */
function idsOf(docs: { id: string }[]): string[] {
  return docs.map((doc) => doc.id);
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
  expect(idsOf(result)).toEqual(["a"]);
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
  expect(idsOf(result)).toEqual(["a", "b"]);
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
  expect(idsOf(result)).toEqual(["a"]);
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
  expect(idsOf(result)).toEqual(["b", "c"]);
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
  expect(result).toHaveLength(2);
});

// 当たらなければ空（正常系）
test("test_find_docs_when_no_match", async () => {
  // 準備
  const { findDocs } = await loadFind();
  const index = createIndex([{ id: "a", path: "a.md", title: "A" }]);
  // 実行
  const result = findDocs({ index, text: "どの文書にも無い語" });
  // 検証
  expect(result).toEqual([]);
});
