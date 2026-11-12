import codeSchema from "../../schemas/marks/code.schema.json" with {
  type: "json",
};
import commonSchema from "../../schemas/marks/common.schema.json" with {
  type: "json",
};
import detailsSchema from "../../schemas/marks/details.schema.json" with {
  type: "json",
};
import featuresSchema from "../../schemas/marks/features.schema.json" with {
  type: "json",
};
import figSchema from "../../schemas/marks/fig.schema.json" with {
  type: "json",
};
import gallerySchema from "../../schemas/marks/gallery.schema.json" with {
  type: "json",
};
import glossarySchema from "../../schemas/marks/glossary.schema.json" with {
  type: "json",
};
import includeSchema from "../../schemas/marks/include.schema.json" with {
  type: "json",
};
import pageSchema from "../../schemas/marks/page.schema.json" with {
  type: "json",
};
import rowDetailSchema from "../../schemas/marks/row-detail.schema.json" with {
  type: "json",
};
import sectionSchema from "../../schemas/marks/section.schema.json" with {
  type: "json",
};
import stepsSchema from "../../schemas/marks/steps.schema.json" with {
  type: "json",
};
import tableSchema from "../../schemas/marks/table.schema.json" with {
  type: "json",
};
import tabsSchema from "../../schemas/marks/tabs.schema.json" with {
  type: "json",
};
import treeSchema from "../../schemas/marks/tree.schema.json" with {
  type: "json",
};
import viewSchema from "../../schemas/marks/view.schema.json" with {
  type: "json",
};
import wideSchema from "../../schemas/marks/wide.schema.json" with {
  type: "json",
};
import { DEFAULT_FEATURES } from "../config.ts";
import { isMarkOptions, type MarkOptions } from "./mark-options.ts";

/** 検証が参照する JSON Schema のキーワードだけを持つスキーマ */
export type MarkSchema = {
  $schema?: string;
  $id?: string;
  $defs?: Record<string, MarkSchema>;
  $ref?: string;
  title?: string;
  description?: string;
  type?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, MarkSchema>;
  required?: string[];
  additionalProperties?: boolean | MarkSchema;
  items?: MarkSchema;
  anyOf?: MarkSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
};

/** マーカーの設定の誤り 1 つ */
export type MarkProblem = {
  /** キーのパス（引数そのもののときは空） */
  path: string;
  /** 記載の警告の本文 */
  message: string;
};

/** 描くときは画面に出さず、点検だけがずれにする記法のマーカーの注記 1 つ */
export type MarkNote = {
  kind: "unknown_mark_arg" | "legacy_mark" | "mark_option_unapplied";
  message: string;
};

/** 共通のオブジェクトを `$defs` に持たせたマーカーのスキーマ */
const withCommon = (schema: MarkSchema): MarkSchema => ({
  ...schema,
  $defs: (commonSchema as MarkSchema).$defs ?? {},
});

/** マーカーの名前から JSON Schema を参照する表 */
export const MARK_SCHEMAS: Readonly<Record<string, MarkSchema>> = {
  code: withCommon(codeSchema as MarkSchema),
  details: withCommon(detailsSchema as MarkSchema),
  features: withCommon(featuresSchema as MarkSchema),
  fig: withCommon(figSchema as MarkSchema),
  gallery: withCommon(gallerySchema as MarkSchema),
  glossary: withCommon(glossarySchema as MarkSchema),
  include: withCommon(includeSchema as MarkSchema),
  page: withCommon(pageSchema as MarkSchema),
  "row-detail": withCommon(rowDetailSchema as MarkSchema),
  section: withCommon(sectionSchema as MarkSchema),
  steps: withCommon(stepsSchema as MarkSchema),
  table: withCommon(tableSchema as MarkSchema),
  tabs: withCommon(tabsSchema as MarkSchema),
  tree: withCommon(treeSchema as MarkSchema),
  view: withCommon(viewSchema as MarkSchema),
  wide: withCommon(wideSchema as MarkSchema),
};

/** 検証で取り除いた値の印 */
const REMOVED = Symbol("removed");

/** 検証の途中の結果 */
type Checked = {
  value: unknown;
  problems: MarkProblem[];
  unknownKeys: string[];
};

/** `$ref` をスキーマの `$defs` で解く */
const resolve = (node: MarkSchema, root: MarkSchema): MarkSchema => {
  if (node.$ref === undefined) {
    return node;
  }
  const name = node.$ref.replace(/^.*#\/\$defs\//, "");
  const target = root.$defs?.[name];
  if (target === undefined) {
    throw new Error(
      `マーカーの JSON Schema の $ref を解けません: ${node.$ref}`,
    );
  }
  return resolve(target, root);
};

/** キーのパスに子を足す（配列の要素は `[位置]`） */
const childPath = (path: string, key: string | number): string =>
  typeof key === "number"
    ? `${path}[${key}]`
    : path === ""
      ? key
      : `${path}.${key}`;

/** 値を JSON の文字にする */
const show = (value: unknown): string => JSON.stringify(value);

/** スキーマから見本の値を作る */
const exampleOf = (node: MarkSchema, root: MarkSchema): unknown => {
  const resolved = resolve(node, root);
  if (resolved.anyOf?.[0]) {
    return exampleOf(resolved.anyOf[0], root);
  }
  if (resolved.enum?.[0] !== undefined) {
    return resolved.enum[0];
  }
  switch (resolved.type) {
    case "object": {
      const [first] = Object.entries(resolved.properties ?? {});
      return first ? { [first[0]]: exampleOf(first[1], root) } : {};
    }
    case "array":
      return resolved.items ? [exampleOf(resolved.items, root)] : [];
    case "string":
      return "文字";
    case "integer":
    case "number":
      return Math.max(resolved.minimum ?? 1, 1);
    case "boolean":
      return false;
    default:
      return null;
  }
};

/** スキーマが受け付ける値の説明 */
const expectedOf = (node: MarkSchema, root: MarkSchema): string => {
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    return resolved.anyOf.map((item) => expectedOf(item, root)).join("か、");
  }
  if (resolved.enum) {
    return `${resolved.enum.map((value) => `\`${show(value)}\``).join("・")} のどれか`;
  }
  switch (resolved.type) {
    case "object": {
      const keys = Object.keys(resolved.properties ?? {});
      return keys.length > 0
        ? `${keys.map((key) => `\`${key}\``).join("・")} を持つオブジェクト`
        : "オブジェクト";
    }
    case "array":
      return "配列";
    case "string":
      return resolved.minLength !== undefined && resolved.minLength > 0
        ? `${resolved.minLength} 文字以上の文字`
        : "文字";
    case "integer":
      return resolved.minimum !== undefined && resolved.maximum !== undefined
        ? `${resolved.minimum}〜${resolved.maximum} の整数`
        : resolved.minimum !== undefined
          ? `${resolved.minimum} 以上の整数`
          : "整数";
    case "number":
      return resolved.minimum !== undefined
        ? `${resolved.minimum} 以上の数`
        : "数";
    case "boolean":
      return "`true` か `false`";
    default:
      return "値";
  }
};

/** 値がスキーマの型に合うか */
const matchesType = (type: string | undefined, value: unknown): boolean => {
  switch (type) {
    case undefined:
      return true;
    case "object":
      return isMarkOptions(value);
    case "array":
      return Array.isArray(value);
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
};

/** 型・選べる値・範囲の誤りの文 */
const mismatchMessage = (
  path: string,
  node: MarkSchema,
  root: MarkSchema,
  value: unknown,
): string => {
  const resolved = resolve(node, root);
  if (resolved.enum && matchesType(resolved.type, value)) {
    const values = resolved.enum.map((item) => `\`${show(item)}\``).join("・");
    return `の \`${path}\` の \`${show(value)}\` は選べる値にありません。選べる値は ${values} です。この設定を当てずに描いています。`;
  }
  return `の \`${path}\` には ${expectedOf(node, root)} を記載してください（例 \`${show(exampleOf(node, root))}\`）。この設定を当てずに描いています。`;
};

/** 値をスキーマで検証し、誤りと知らないキーを除いた値を返却する */
const check = (
  node: MarkSchema,
  root: MarkSchema,
  value: unknown,
  path: string,
): Checked => {
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    for (const alternative of resolved.anyOf) {
      const result = check(alternative, root, value, path);
      if (result.value !== REMOVED && result.problems.length === 0) {
        return result;
      }
    }
    return {
      value: REMOVED,
      problems: [{ path, message: mismatchMessage(path, node, root, value) }],
      unknownKeys: [],
    };
  }
  const invalid = (): Checked => ({
    value: REMOVED,
    problems: [{ path, message: mismatchMessage(path, node, root, value) }],
    unknownKeys: [],
  });
  if (!matchesType(resolved.type, value)) {
    return invalid();
  }
  if (resolved.enum && !resolved.enum.includes(value)) {
    return invalid();
  }
  if (resolved.const !== undefined && resolved.const !== value) {
    return invalid();
  }
  if (typeof value === "number") {
    if (
      (resolved.minimum !== undefined && value < resolved.minimum) ||
      (resolved.maximum !== undefined && value > resolved.maximum)
    ) {
      return invalid();
    }
  }
  if (
    typeof value === "string" &&
    resolved.minLength !== undefined &&
    value.length < resolved.minLength
  ) {
    return invalid();
  }
  if (Array.isArray(value)) {
    return checkArray(resolved, root, value, path);
  }
  if (isMarkOptions(value) && resolved.type === "object") {
    return checkObject(resolved, root, value, path);
  }
  return { value, problems: [], unknownKeys: [] };
};

/** 配列の要素を検証し、取り除いた要素を詰める */
const checkArray = (
  node: MarkSchema,
  root: MarkSchema,
  value: unknown[],
  path: string,
): Checked => {
  const out: unknown[] = [];
  const problems: MarkProblem[] = [];
  const unknownKeys: string[] = [];
  value.forEach((item, index) => {
    const result = node.items
      ? check(node.items, root, item, childPath(path, index))
      : { value: item, problems: [], unknownKeys: [] };
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value !== REMOVED) {
      out.push(result.value);
    }
  });
  return { value: out, problems, unknownKeys };
};

/** オブジェクトのキーを検証し、知らないキーと誤りの値を除き、必須のキーが欠けたら取り除く */
const checkObject = (
  node: MarkSchema,
  root: MarkSchema,
  value: MarkOptions,
  path: string,
): Checked => {
  const out: MarkOptions = {};
  const problems: MarkProblem[] = [];
  const unknownKeys: string[] = [];
  const removed = new Set<string>();
  for (const [key, child] of Object.entries(value)) {
    const property = node.properties?.[key];
    const schema =
      property ??
      (typeof node.additionalProperties === "object"
        ? node.additionalProperties
        : undefined);
    if (schema === undefined) {
      unknownKeys.push(childPath(path, key));
      continue;
    }
    const result = check(schema, root, child, childPath(path, key));
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value === REMOVED) {
      removed.add(key);
    } else {
      out[key] = result.value;
    }
  }
  const missing = (node.required ?? []).filter(
    (key) => !Object.hasOwn(value, key),
  );
  if (missing.length > 0) {
    for (const key of missing) {
      const where = childPath(path, key);
      const example = node.properties?.[key]
        ? ` \`${show({ [key]: exampleOf(node.properties[key], root) })}\` のように記載してください。`
        : "";
      const owner = path === "" ? "" : `の \`${path}\` `;
      problems.push({
        path: where,
        message: `${owner}に必須の \`${key}\` がありません。${example}この設定を当てずに描いています。`,
      });
    }
    // 引数そのもの（最上位）は取り除かない
    if (path !== "") {
      return { value: REMOVED, problems, unknownKeys };
    }
  }
  // 誤りで取り除いたキーが必須なら、このオブジェクトも当てない
  if (path !== "" && (node.required ?? []).some((key) => removed.has(key))) {
    return { value: REMOVED, problems, unknownKeys };
  }
  return { value: out, problems, unknownKeys };
};

/** マーカーの設定を、マーカーの JSON Schema で確かめ、誤りの値と知らないキーを除いた設定を返却する。スキーマの無い名前は確かめない */
export const validateMarkOptions = (options: {
  name: string;
  options: MarkOptions;
}): {
  options: MarkOptions;
  problems: MarkProblem[];
  unknownKeys: string[];
} => {
  const schema = MARK_SCHEMAS[options.name];
  if (schema === undefined) {
    return { options: options.options, problems: [], unknownKeys: [] };
  }
  const result = checkObject(
    resolve(schema, schema),
    schema,
    options.options,
    "",
  );
  const checked = isMarkOptions(result.value) ? result.value : {};
  if (options.name === "features") {
    // 機能のマーカーのキーは、設定の `features` の機能の名前に照らす
    for (const key of Object.keys(checked)) {
      if (!Object.hasOwn(DEFAULT_FEATURES, key)) {
        delete checked[key];
        result.unknownKeys.push(key);
      }
    }
  }
  return {
    options: checked,
    problems: result.problems,
    unknownKeys: result.unknownKeys,
  };
};

/** キーのパスの場所で使用できるキーの並び */
const usableKeysAt = (schema: MarkSchema, path: string): string[] => {
  const segments = path.split(/\.|\[\d+\]/).filter(Boolean);
  segments.pop();
  let node: MarkSchema | undefined = resolve(schema, schema);
  for (const segment of segments) {
    if (node === undefined) {
      return [];
    }
    const resolved: MarkSchema = resolve(node, schema);
    node =
      resolved.properties?.[segment] ??
      (typeof resolved.additionalProperties === "object"
        ? resolved.additionalProperties
        : resolved.items);
    if (node?.items && !node.properties) {
      node = node.items;
    }
  }
  if (node === undefined) {
    return [];
  }
  const resolved = resolve(node, schema);
  return Object.keys(resolved.properties ?? {});
};

/** 表の列の設定のキーから、その設定が付ける機能の名前を参照する */
const COLUMN_FEATURES: Readonly<Record<string, string>> = {
  filter: "filter",
  hidden: "columns",
  pinned: "pin",
  total: "total",
};

/** 表のマーカーの、適用しない列の設定と行の色の要素の注記 */
const unappliedTableNotes = (options: MarkOptions): MarkNote[] => {
  const notes: MarkNote[] = [];
  const features = isMarkOptions(options.features) ? options.features : {};
  const disabled = new Set(
    Object.entries(features)
      .filter(([, value]) => isMarkOptions(value) && value.enabled === false)
      .map(([name]) => name),
  );
  const columns = isMarkOptions(options.columns) ? options.columns : {};
  for (const [column, settings] of Object.entries(columns)) {
    if (!isMarkOptions(settings)) {
      continue;
    }
    for (const key of Object.keys(settings)) {
      const feature = COLUMN_FEATURES[key];
      if (feature !== undefined && disabled.has(feature)) {
        notes.push({
          kind: "mark_option_unapplied",
          message: `表のマーカーの columns.${column}.${key} は、features.${feature}.enabled を false にした機能の設定のため適用していません。機能を削除しないか、列の設定を削除してください。`,
        });
      }
    }
  }
  const rows = isMarkOptions(options.rows) ? options.rows : {};
  const colors = Array.isArray(rows.colors) ? rows.colors : [];
  colors.forEach((item, index) => {
    if (!isMarkOptions(item)) {
      return;
    }
    const hasColumn = item.column !== undefined;
    const hasValue = item.value !== undefined;
    if (hasColumn !== hasValue || (!hasColumn && item.at === undefined)) {
      notes.push({
        kind: "mark_option_unapplied",
        message: `表のマーカーの rows.colors[${index}] は、column と value の両方か at を記載していないため適用していません。column と value を両方記載するか、at を記載してください。`,
      });
    }
  });
  return notes;
};

/** 描くときは画面に出さず点検だけがずれにする注記を作る */
export const markOptionNotes = (options: {
  name: string;
  source: "none" | "json" | "legacy" | "invalid";
  options: MarkOptions;
  unknownKeys: string[];
  isExtension: boolean;
}): MarkNote[] => {
  const { name } = options;
  if (options.source === "legacy") {
    return [
      {
        kind: "legacy_mark",
        message: options.isExtension
          ? `${name} のマーカーの引数が今の書き方です。拡張と libraries のマーカーは、今の書き方の引数では描かないため、描くときに描きません。mdmark upgrade は書き換えずに移行の報告に挙げるので、引数を JSON のオブジェクトで記載し直してください。`
          : `${name} のマーカーの引数が今の書き方です。引数を JSON のオブジェクトで記載してください。mdmark upgrade で書き換えられます。`,
      },
    ];
  }
  if (options.isExtension) {
    return [];
  }
  const schema = MARK_SCHEMAS[name];
  const notes: MarkNote[] = options.unknownKeys.map((path) => {
    const usable =
      name === "features"
        ? Object.keys(DEFAULT_FEATURES).join("・")
        : schema === undefined
          ? ""
          : usableKeysAt(schema, path).join("・");
    return {
      kind: "unknown_mark_arg",
      message: `${name} のマーカーの ${path} はこのバージョンの mdmark が知らないキーで、描くときは無視しています。この場所で使用できるキーは ${usable} です。誤記ならキーを修正し、新しいバージョンのキーなら mdmark のバージョンを上げてください。`,
    };
  });
  if (name === "table") {
    notes.push(...unappliedTableNotes(options.options));
  }
  return notes;
};
