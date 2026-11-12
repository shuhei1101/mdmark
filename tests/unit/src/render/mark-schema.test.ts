import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";

/** マーカーの設定の検証を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMarkSchema = () => import("../../../../src/render/mark-schema.ts");

/** マーカーの設定の ER 図のフォルダ */
const ER_DIR = join(import.meta.dirname, "../../../../docs/er");

/** 検証が参照する JSON Schema のキーワード */
const KNOWN_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$defs",
  "$ref",
  "title",
  "description",
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "anyOf",
  "minimum",
  "maximum",
  "minLength",
]);

/** ER 図の列 */
type ErColumn = {
  name: string;
  type: string;
  not_null?: boolean;
  enum_values?: string;
};

/** JSON Schema の節 */
type SchemaNode = Record<string, unknown>;

/** 値がオブジェクト（配列を除く）か */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `$ref` をスキーマの `$defs` で解く */
const resolveRef = (node: SchemaNode, root: SchemaNode): SchemaNode => {
  const ref = node.$ref;
  if (typeof ref !== "string") {
    return node;
  }
  const name = ref.replace(/^.*#\/\$defs\//, "");
  const defs = root.$defs;
  if (!isRecord(defs) || !isRecord(defs[name])) {
    throw new Error(`$ref を解けません: ${ref}`);
  }
  return resolveRef(defs[name], root);
};

/** 節の候補（`anyOf` は各要素）を返却する */
const alternativesOf = (node: SchemaNode, root: SchemaNode): SchemaNode[] => {
  const resolved = resolveRef(node, root);
  return Array.isArray(resolved.anyOf)
    ? resolved.anyOf.filter(isRecord).map((item) => resolveRef(item, root))
    : [resolved];
};

/** キーのパスの区切りの並び（`columns.{列名}.total[].calc` → `columns`・`{列名}`・`total`・`[]`・`calc`） */
const segmentsOf = (path: string): string[] =>
  path.match(/\{[^}]+\}|\[\]|[^.[\]{}]+/g) ?? [];

/** キーのパスの節と、その節を持つ親の節を辿る */
const nodeAt = (
  schema: SchemaNode,
  path: string,
): { node: SchemaNode; parent: SchemaNode; key: string } | undefined => {
  let node: SchemaNode = schema;
  let parent: SchemaNode = schema;
  let key = "";
  for (const segment of segmentsOf(path)) {
    const candidates = alternativesOf(node, schema);
    let next: SchemaNode | undefined;
    let owner: SchemaNode | undefined;
    for (const candidate of candidates) {
      if (segment === "[]" && isRecord(candidate.items)) {
        next = candidate.items;
      } else if (
        segment.startsWith("{") &&
        isRecord(candidate.additionalProperties)
      ) {
        next = candidate.additionalProperties;
      } else if (segment.startsWith("{") && isRecord(candidate.properties)) {
        // 名前を列挙したオブジェクト（表の `features`）は最初の名前の節で照らす
        next = Object.values(candidate.properties).find(isRecord);
      } else if (
        isRecord(candidate.properties) &&
        isRecord(candidate.properties[segment])
      ) {
        next = candidate.properties[segment];
        owner = candidate;
      }
      if (next) {
        break;
      }
    }
    if (!next) {
      return undefined;
    }
    parent = owner ?? parent;
    key = segment;
    node = next;
  }
  return { node, parent, key };
};

/** 節が持つ型の並び */
const typesOf = (node: SchemaNode, root: SchemaNode): string[] =>
  alternativesOf(node, root)
    .map((item) => item.type)
    .filter((type): type is string => typeof type === "string")
    .sort();

/** 節が持つ選べる値の並び */
const enumOf = (node: SchemaNode, root: SchemaNode): string[] =>
  alternativesOf(node, root)
    .flatMap((item) => (Array.isArray(item.enum) ? item.enum : []))
    .map(String)
    .sort();

/** スキーマの中の、検証が参照しないキーワードを集める */
const unknownKeywordsOf = (node: unknown, path = ""): string[] => {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      unknownKeywordsOf(item, `${path}[${index}]`),
    );
  }
  if (!isRecord(node)) {
    return [];
  }
  return Object.entries(node).flatMap(([key, value]) => {
    const isNameMap = key === "properties" || key === "$defs";
    const own = isNameMap || KNOWN_KEYWORDS.has(key) ? [] : [`${path}/${key}`];
    const children =
      isNameMap && isRecord(value)
        ? Object.entries(value).flatMap(([name, child]) =>
            unknownKeywordsOf(child, `${path}/${key}/${name}`),
          )
        : unknownKeywordsOf(value, `${path}/${key}`);
    return [...own, ...children];
  });
};

// スキーマに合う設定はそのまま返却する（正常系）
test("test_validate_mark_options", async () => {
  // 準備
  const { validateMarkOptions } = await loadMarkSchema();
  const options = {
    kind: "data",
    columns: { 数量: { total: [{ calc: "sum" }] } },
    collapse: { open: false },
  };
  // 実行
  const result = validateMarkOptions({ name: "table", options });
  // 検証
  expect(result.options).toEqual(options);
  expect(result.problems).toEqual([]);
  expect(result.unknownKeys).toEqual([]);
});

// 型と選べる値の誤りを除いて問題にする（異常系）
test("test_validate_mark_options_when_invalid", async () => {
  // 準備
  const { validateMarkOptions } = await loadMarkSchema();
  // 実行
  const result = validateMarkOptions({
    name: "table",
    options: {
      kind: "unknown",
      columns: { 数量: { total: [{ calc: "max" }] } },
      collapse: "closed",
    },
  });
  // 検証
  expect(result.options).toEqual({ columns: { 数量: { total: [] } } });
  expect(result.problems.map((problem) => problem.path)).toEqual([
    "kind",
    "columns.数量.total[0].calc",
    "collapse",
  ]);
});

// 知らないキーを除いてパスを返却する（正常系）
test("test_validate_mark_options_when_unknown_key", async () => {
  // 準備
  const { validateMarkOptions } = await loadMarkSchema();
  // 実行
  const result = validateMarkOptions({
    name: "table",
    options: { kind: "data", features: { foo: {} }, size: 2 },
  });
  // 検証
  expect(result.options).toEqual({ kind: "data", features: {} });
  expect(result.unknownKeys).toEqual(["features.foo", "size"]);
  expect(result.problems).toEqual([]);
});

// 必須のキーが欠けたオブジェクトを除く（異常系）
test("test_validate_mark_options_when_required_missing", async () => {
  // 準備
  const { validateMarkOptions } = await loadMarkSchema();
  // 実行
  const table = validateMarkOptions({
    name: "table",
    options: { tree: { type: { column: "型" } } },
  });
  const glossary = validateMarkOptions({
    name: "glossary",
    options: { term: { column: "用語" } },
  });
  // 検証
  expect(table.options).toEqual({});
  expect(table.problems.map((problem) => problem.path)).toEqual(["tree.key"]);
  expect(glossary.problems.map((problem) => problem.path)).toEqual(["meaning"]);
});

// スキーマの無い名前は確かめない（正常系）
test("test_validate_mark_options_when_no_schema", async () => {
  // 準備
  const { validateMarkOptions } = await loadMarkSchema();
  // 実行
  const result = validateMarkOptions({ name: "greet", options: { target: 1 } });
  // 検証
  expect(result.options).toEqual({ target: 1 });
  expect(result.problems).toEqual([]);
  expect(result.unknownKeys).toEqual([]);
});

// 全てのマーカーのスキーマが ER 図と一致し、読まないキーワードを持たない（正常系）
test("test_mark_schemas_match_er", async () => {
  // 準備
  const { MARK_SCHEMAS } = await loadMarkSchema();
  const schemas = MARK_SCHEMAS as Record<string, SchemaNode>;
  const files = readdirSync(ER_DIR).filter((file) =>
    /^ER-477-\d+\.yaml$/.test(file),
  );
  const mismatches: string[] = [];
  // 実行
  for (const file of files) {
    const er = parse(readFileSync(join(ER_DIR, file), "utf8")) as {
      tables: { name: string; columns: ErColumn[] }[];
    };
    for (const table of er.tables) {
      const name = table.name.replaceAll("_", "-");
      const schema = schemas[name];
      if (!schema) {
        continue;
      }
      for (const column of table.columns) {
        const found = nodeAt(schema, column.name);
        if (!found) {
          mismatches.push(`${name}: ${column.name} がスキーマにありません`);
          continue;
        }
        const erTypes = column.type
          .split("/")
          .map((type) => type.trim())
          .sort();
        const types = typesOf(found.node, schema);
        if (types.join(",") !== erTypes.join(",")) {
          mismatches.push(
            `${name}: ${column.name} の型 ${types} と ER 図の ${erTypes}`,
          );
        }
        const erEnum = [...(column.enum_values ?? "").matchAll(/`([^`]+)`/g)]
          .map((match) => match[1] ?? "")
          .sort();
        const values = enumOf(found.node, schema);
        if (erEnum.length > 0 && values.join(",") !== erEnum.join(",")) {
          mismatches.push(
            `${name}: ${column.name} の選べる値 ${values} と ER 図の ${erEnum}`,
          );
        }
        const required = Array.isArray(found.parent.required)
          ? found.parent.required.includes(found.key)
          : false;
        if (
          !found.key.startsWith("{") &&
          found.key !== "[]" &&
          required !== Boolean(column.not_null)
        ) {
          mismatches.push(
            `${name}: ${column.name} の必須 ${required} と ER 図の ${Boolean(column.not_null)}`,
          );
        }
      }
    }
  }
  const unknownKeywords = Object.entries(schemas).flatMap(([name, schema]) =>
    unknownKeywordsOf(schema).map((path) => `${name}${path}`),
  );
  // 検証
  expect(Object.keys(schemas).length).toBeGreaterThan(0);
  expect(mismatches).toEqual([]);
  expect(unknownKeywords).toEqual([]);
});

// 知らないキーと適用しない列の設定を注記にする（正常系）
test("test_mark_option_notes", async () => {
  // 準備
  const { markOptionNotes } = await loadMarkSchema();
  // 実行
  const notes = markOptionNotes({
    name: "table",
    source: "json",
    options: {
      features: { total: { enabled: false } },
      columns: { 数量: { total: [{ calc: "sum" }] } },
      rows: { colors: [{ column: "状態", color: "green" }] },
    },
    unknownKeys: ["size"],
    isExtension: false,
  });
  // 検証
  expect(notes.map((note) => note.kind)).toEqual([
    "unknown_mark_arg",
    "mark_option_unapplied",
    "mark_option_unapplied",
  ]);
  expect(notes[0]?.message).toContain("size");
  expect(notes[0]?.message).toContain("columns");
  expect(notes[1]?.message).toContain("columns.数量.total");
  expect(notes[2]?.message).toContain("rows.colors[0]");
});

// 今の書き方の引数を 1 つの legacy_mark にする（正常系）
test("test_mark_option_notes_when_legacy", async () => {
  // 準備
  const { markOptionNotes } = await loadMarkSchema();
  // 実行
  const tabs = markOptionNotes({
    name: "tabs",
    source: "legacy",
    options: { group: "os" },
    unknownKeys: [],
    isExtension: false,
  });
  const greet = markOptionNotes({
    name: "greet",
    source: "legacy",
    options: {},
    unknownKeys: [],
    isExtension: true,
  });
  // 検証
  expect(tabs.map((note) => note.kind)).toEqual(["legacy_mark"]);
  expect(tabs[0]?.message).toContain("mdmark upgrade");
  expect(greet.map((note) => note.kind)).toEqual(["legacy_mark"]);
  expect(greet[0]?.message).toMatch(/描かない|描きません|描いていません/);
  expect(greet[0]?.message).toContain("移行の報告");
});
