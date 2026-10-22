import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/** 索引の形の検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadShape = () => import("../../../../src/knowledge/index-shape.ts");

/** 索引の JSON Schema の要素: キーの型と、必須のキーの並び */
type SchemaObject = {
  type?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, SchemaProperty>;
};

/** JSON Schema のキー 1 つ */
type SchemaProperty = {
  type?: string;
  items?: SchemaObject & { type?: string };
};

/** 索引の JSON Schema の最上位 */
type IndexSchema = SchemaObject & {
  properties: {
    docs: { items: SchemaObject };
    terms: { items: SchemaObject };
  };
};

/** JSON Schema のキー 1 つを、`INDEX_SHAPE` と同じ型の書き方（`string[]` など）にする */
function shapeType(property: SchemaProperty): string {
  if (property.type === "array") {
    return property.items?.type === "string" ? "string[]" : "array";
  }
  return property.type ?? "";
}

/** JSON Schema の要素を、`INDEX_SHAPE` の 1 要素と同じ形（キーから型と必須か）にする */
function shapeOf(
  schema: SchemaObject,
): Record<string, { type: string; required: boolean }> {
  const required = new Set(schema.required ?? []);
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, property]) => [
      key,
      { type: shapeType(property), required: required.has(key) },
    ]),
  );
}

// 合う索引はそのまま返し、合わない場所が無い（正常系）
test("test_normalize_index", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    schema: 1,
    docs: [
      {
        id: "arch",
        path: "設計/arch.md",
        title: "アーキテクチャ",
        description: "全体の構成と依存の向き",
        aliases: ["構成図"],
        tags: ["設計"],
        related: ["api"],
      },
      { id: "api", path: "api.md", title: "API" },
    ],
    terms: [
      {
        id: "workspace",
        term: "ワークスペース",
        aliases: ["WS"],
        meaning: "話し合いの記録を置くフォルダ",
      },
    ],
  };
  // 実行
  const { index, problems } = normalizeIndex(structuredClone(value));
  // 検証
  expect(problems).toEqual([]);
  expect(index).toEqual(value);
});

// 形の合わない文書・用語を除き、場所を返す（異常系）
test("test_normalize_index_when_invalid_item", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    docs: [
      { id: "a", path: "a.md", title: "A" },
      { id: "b", title: "B" },
      { id: "a", path: "c.md", title: "C" },
    ],
    terms: [{ id: "t", term: "語" }],
  };
  // 実行
  const { index, problems } = normalizeIndex(value);
  // 検証
  expect(problems.map((problem) => problem.where)).toEqual([
    "schema",
    "docs[1].path",
    "docs[2].id",
    "terms[0].meaning",
  ]);
  expect(index.docs.map((doc) => doc.id)).toEqual(["a"]);
  expect(index.terms ?? []).toEqual([]);
});

// 空の要素を持つ avoid の用語を除き、場所を返す（異常系）
test("test_normalize_index_when_invalid_avoid", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    schema: 1,
    docs: [],
    terms: [
      { id: "a", term: "語 A", meaning: "意味 A", avoid: [""] },
      { id: "b", term: "語 B", meaning: "意味 B", avoid: ["作業場"] },
    ],
  };
  // 実行
  const { index, problems } = normalizeIndex(value);
  // 検証
  expect(problems.map((problem) => problem.where)).toEqual(["terms[0].avoid"]);
  expect((index.terms ?? []).map((term) => term.id)).toEqual(["b"]);
});

// オブジェクトでない値でも例外を投げない（異常系）
test("test_normalize_index_when_not_object", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  // 実行・検証
  for (const value of [null, "索引", []]) {
    const { index, problems } = normalizeIndex(value);
    expect(index.docs).toEqual([]);
    expect(index.terms ?? []).toEqual([]);
    expect(problems.map((problem) => problem.where)).toEqual([""]);
  }
});

// JSON Schema が INDEX_SHAPE と同じキー・型・必須を持つ（正常系）
test("test_normalize_index_matches_json_schema", async () => {
  // 準備
  const { INDEX_SHAPE } = await loadShape();
  const schema = JSON.parse(
    readFileSync(
      new URL("../../../../schemas/mdmark.index.schema.json", import.meta.url),
      "utf8",
    ),
  ) as IndexSchema;
  // 実行
  const root = shapeOf(schema);
  const doc = shapeOf(schema.properties.docs.items);
  const term = shapeOf(schema.properties.terms.items);
  // 検証
  expect(root).toEqual(INDEX_SHAPE.root);
  expect(doc).toEqual(INDEX_SHAPE.doc);
  expect(term).toEqual(INDEX_SHAPE.term);
  for (const object of [
    schema,
    schema.properties.docs.items,
    schema.properties.terms.items,
  ]) {
    expect(object.additionalProperties).toBe(false);
  }
});
