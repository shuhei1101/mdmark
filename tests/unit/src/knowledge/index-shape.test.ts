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
  maxItems?: number;
  items?: SchemaObject & {
    type?: string;
    anyOf?: Array<SchemaObject & { enum?: string[] }>;
  };
};

/** 索引の JSON Schema の最上位 */
type IndexSchema = SchemaObject & {
  properties: {
    docs: { items: SchemaObject };
    terms: { items: SchemaObject };
    tags: { items: SchemaObject };
  };
};

/** JSON Schema のキー 1 つを、`INDEX_SHAPE` と同じ型の書き方（`string[]` など）にする */
function shapeType(key: string, property: SchemaProperty): string {
  if (property.type === "array") {
    if (property.items?.anyOf !== undefined) {
      return key === "related" ? "doc_related" : "doc_tags";
    }
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
      { type: shapeType(key, property), required: required.has(key) },
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
        tags: ["設計", { name: "topic:mcp", main: true }],
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
    tags: [
      {
        name: "topic:mcp",
        group: "topic",
        description: "含める: MCP のツールの作り方",
        aliases: ["MCP"],
      },
      { name: "設計", group: "kind" },
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
  const tag = shapeOf(schema.properties.tags.items);
  const docTagItems = schema.properties.docs.items.properties?.tags?.items;
  const docRelated = schema.properties.docs.items.properties?.related;
  const docRelatedItems = docRelated?.items;
  // 検証
  expect(root).toEqual(INDEX_SHAPE.root);
  expect(doc).toEqual(INDEX_SHAPE.doc);
  expect(term).toEqual(INDEX_SHAPE.term);
  expect(tag).toEqual(INDEX_SHAPE.tag);
  for (const object of [
    schema,
    schema.properties.docs.items,
    schema.properties.terms.items,
    schema.properties.tags.items,
  ]) {
    expect(object.additionalProperties).toBe(false);
  }
  // 文書のタグの要素は、文字列か `name` が必須で `main` を持つオブジェクト
  expect(docTagItems?.anyOf).toHaveLength(2);
  expect(docTagItems?.anyOf?.[0]?.type).toBe("string");
  const docTagObject = docTagItems?.anyOf?.[1];
  expect(docTagObject?.type).toBe("object");
  expect(docTagObject?.required).toEqual(["name"]);
  expect(Object.keys(docTagObject?.properties ?? {})).toEqual(["name", "main"]);
  expect(docTagObject?.additionalProperties).toBe(false);
  // 文書の関連の要素は、文字列か `to`・`type`・`when` が必須で `paths` を持つオブジェクトで、件数の上限を置かない
  expect(docRelatedItems?.anyOf).toHaveLength(2);
  expect(docRelatedItems?.anyOf?.[0]?.type).toBe("string");
  const docRelatedObject = docRelatedItems?.anyOf?.[1];
  expect(docRelatedObject?.type).toBe("object");
  expect(docRelatedObject?.required).toEqual(["to", "type", "when"]);
  expect(Object.keys(docRelatedObject?.properties ?? {})).toEqual([
    "to",
    "type",
    "when",
    "paths",
  ]);
  expect(docRelatedObject?.additionalProperties).toBe(false);
  expect(
    (
      docRelatedObject?.properties?.type as unknown as
        | { enum?: string[] }
        | undefined
    )?.enum,
  ).toEqual([
    "requires",
    "references",
    "replaces",
    "part_of",
    "change_together",
  ]);
  expect(docRelated?.maxItems).toBeUndefined();
});

// タグの語彙と、文字列・オブジェクトの文書のタグをそのまま返す（正常系）
test("test_normalize_index_when_tags", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const tags = [
    {
      name: "topic:mcp",
      group: "topic",
      description: "含める: MCP のツールの作り方",
      aliases: ["MCP"],
    },
    { name: "topic:mcp", group: "kind" },
    { name: "topic:old", deprecated: "topic:mcp" },
  ];
  const docTags = ["設計", { name: "topic:mcp", main: true }];
  const value = {
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: docTags }],
    tags,
  };
  // 実行
  const { index, problems } = normalizeIndex(structuredClone(value));
  // 検証
  expect(problems).toEqual([]);
  expect(index.tags).toEqual(tags);
  expect(index.docs[0]?.tags).toEqual(docTags);
});

// 形の合わないタグの語彙の要素と文書のタグを、場所を返して除く（異常系）
test("test_normalize_index_when_invalid_tags", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: [{ main: true }] }],
    tags: [{ group: "topic" }, { name: "topic:mcp", color: "red" }],
  };
  // 実行
  const { index, problems } = normalizeIndex(value);
  // 検証
  expect(problems.map((problem) => problem.where)).toEqual([
    "tags[0].name",
    "tags[1].color",
    "docs[0].tags[0].name",
  ]);
  expect(index.tags ?? []).toEqual([]);
  expect(index.docs).toEqual([]);
});

// 最上位に `tags` が無ければ、返す索引にも `tags` を持たせない（正常系）
test("test_normalize_index_without_tags", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    schema: 1,
    docs: [{ id: "arch", path: "設計/arch.md", title: "アーキテクチャ" }],
    terms: [
      {
        id: "workspace",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
      },
    ],
  };
  // 実行
  const { index, problems } = normalizeIndex(structuredClone(value));
  // 検証
  expect(problems).toEqual([]);
  expect("tags" in index).toBe(false);
});

// 文字列とオブジェクトの関連をそのまま返す（正常系）
test("test_normalize_index_when_related", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const manyRelated = Array.from({ length: 9 }, (_, i) => ({
    to: `doc${i}`,
    type: "references",
    when: "使い方を確かめるとき",
  }));
  const value = {
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          "b",
          {
            to: "b",
            type: "change_together",
            when: "公開関数を変えるとき",
            paths: ["src/**"],
          },
        ],
      },
      { id: "b", path: "b.md", title: "B", related: manyRelated },
    ],
  };
  // 実行
  const { index, problems } = normalizeIndex(structuredClone(value));
  // 検証
  expect(problems).toEqual([]);
  expect(index.docs).toEqual(value.docs);
});

// 形の合わない関連を持つ文書を、場所を返して除く（異常系）
test("test_normalize_index_when_invalid_related", async () => {
  // 準備
  const { normalizeIndex } = await loadShape();
  const value = {
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [{ to: "b", type: "requires" }],
      },
      {
        id: "b",
        path: "b.md",
        title: "B",
        related: [{ to: "a", type: "depends_on", when: "前提を確かめるとき" }],
      },
      {
        id: "c",
        path: "c.md",
        title: "C",
        related: [
          { to: "a", type: "requires", when: "前提を確かめるとき", note: "x" },
        ],
      },
      {
        id: "d",
        path: "d.md",
        title: "D",
        related: [{ to: "a", type: "requires", when: "" }],
      },
    ],
  };
  // 実行
  const { index, problems } = normalizeIndex(value);
  // 検証
  expect(problems.map((problem) => problem.where)).toEqual([
    "docs[0].related[0].when",
    "docs[1].related[0].type",
    "docs[2].related[0].note",
    "docs[3].related[0].when",
  ]);
  const typeProblem = problems.find(
    (problem) => problem.where === "docs[1].related[0].type",
  );
  for (const type of [
    "requires",
    "references",
    "replaces",
    "part_of",
    "change_together",
  ]) {
    expect(typeProblem?.message).toContain(type);
  }
  expect(index.docs).toEqual([]);
});

// 文字列の要素を `type` と `when` が null のオブジェクトにする（正常系）
test("test_read_related", async () => {
  // 準備
  const { readRelated } = await loadShape();
  // 実行
  const related = readRelated("arch");
  // 検証
  expect(related).toEqual({ to: "arch", type: null, when: null });
  expect("paths" in related).toBe(false);
});

// オブジェクトの要素をそのままのキーで返す（正常系）
test("test_read_related_when_object", async () => {
  // 準備
  const { readRelated } = await loadShape();
  const item = {
    to: "arch",
    type: "requires" as const,
    when: "前提を確かめるとき",
    paths: ["src/**"],
  };
  // 実行
  const related = readRelated(item);
  // 検証
  expect(related).toEqual(item);
});
