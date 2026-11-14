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

/** 選べる値の誤りの文の値の文字にする（文字の値は引用符を付けず、ほかは JSON の文字にする） */
const showChoice = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

/** 誤りで取り除くと、持ち主のオブジェクトごと当てないキー（持ち主のキーの名前 → キー）。絞り込みの種類を読めない列には、別の種類の絞り込みを付けない */
const DECIDING_KEYS: Readonly<Record<string, readonly string[]>> = {
  filter: ["type"],
};

/** オブジェクトのスキーマの見本の値（最初のキーだけを持つ） */
const exampleObject = (resolved: MarkSchema, root: MarkSchema): unknown => {
  const [first] = Object.entries(resolved.properties ?? {});
  return first ? { [first[0]]: exampleOf(first[1], root) } : {};
};

/** スキーマの型から見本の値を作る */
const exampleOfType = (resolved: MarkSchema, root: MarkSchema): unknown => {
  switch (resolved.type) {
    case "object":
      return exampleObject(resolved, root);
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

/** スキーマから見本の値を作る */
const exampleOf = (node: MarkSchema, root: MarkSchema): unknown => {
  const resolved = resolve(node, root);
  if (resolved.anyOf?.[0]) {
    return exampleOf(resolved.anyOf[0], root);
  }
  if (resolved.enum?.[0] !== undefined) {
    return resolved.enum[0];
  }
  return exampleOfType(resolved, root);
};

/** 整数のスキーマが受け付ける値の説明 */
const expectedInteger = (resolved: MarkSchema): string => {
  const { minimum, maximum } = resolved;
  if (minimum !== undefined && maximum !== undefined) {
    return `${minimum}〜${maximum} の整数`;
  }
  return minimum !== undefined ? `${minimum} 以上の整数` : "整数";
};

/** オブジェクトのスキーマが受け付ける値の説明 */
const expectedObject = (resolved: MarkSchema): string => {
  const keys = Object.keys(resolved.properties ?? {});
  return keys.length > 0
    ? `${keys.map((key) => `\`${key}\``).join("・")} を持つオブジェクト`
    : "オブジェクト";
};

/** スキーマの型が受け付ける値の説明 */
const expectedOfType = (resolved: MarkSchema): string => {
  switch (resolved.type) {
    case "object":
      return expectedObject(resolved);
    case "array":
      return "配列";
    case "string":
      return resolved.minLength !== undefined && resolved.minLength > 0
        ? `${resolved.minLength} 文字以上の文字`
        : "文字";
    case "integer":
      return expectedInteger(resolved);
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

/** スキーマが受け付ける値の説明 */
const expectedOf = (node: MarkSchema, root: MarkSchema): string => {
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    return resolved.anyOf.map((item) => expectedOf(item, root)).join("か、");
  }
  if (resolved.enum) {
    return `${resolved.enum.map((value) => `\`${show(value)}\``).join("・")} のどれか`;
  }
  return expectedOfType(resolved);
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

/** 検証する場所（スキーマの根・値・キーのパス） */
type CheckAt = { root: MarkSchema; value: unknown; path: string };

/** 型・選べる値・範囲の誤りの文 */
const mismatchMessage = (node: MarkSchema, at: CheckAt): string => {
  const { root, value, path } = at;
  const resolved = resolve(node, root);
  if (resolved.enum && matchesType(resolved.type, value)) {
    const values = resolved.enum
      .map((item) => `\`${showChoice(item)}\``)
      .join("・");
    return `の \`${path}\` の \`${showChoice(value)}\` は選べる値にありません。選べる値は ${values} です。この設定を当てずに描いています。`;
  }
  return `の \`${path}\` には ${expectedOf(node, root)} を記載してください（例 \`${show(exampleOf(node, root))}\`）。この設定を当てずに描いています。`;
};

/** 値を取り除き、誤りの文を持つ結果 */
const invalidResult = (node: MarkSchema, at: CheckAt): Checked => ({
  value: REMOVED,
  problems: [{ path: at.path, message: mismatchMessage(node, at) }],
  unknownKeys: [],
});

/** 数・文字の値が、範囲・最短の長さから外れるか */
const outOfRange = (resolved: MarkSchema, value: unknown): boolean => {
  if (typeof value === "number") {
    return (
      (resolved.minimum !== undefined && value < resolved.minimum) ||
      (resolved.maximum !== undefined && value > resolved.maximum)
    );
  }
  return (
    typeof value === "string" &&
    resolved.minLength !== undefined &&
    value.length < resolved.minLength
  );
};

/** 値がスキーマの型・選べる値・定数・範囲に合わないか */
const violates = (resolved: MarkSchema, value: unknown): boolean =>
  !matchesType(resolved.type, value) ||
  (resolved.enum !== undefined && !resolved.enum.includes(value)) ||
  (resolved.const !== undefined && resolved.const !== value) ||
  outOfRange(resolved, value);

/** 候補のスキーマのうち、誤り無く合う最初の結果（無ければ取り除く） */
const checkAnyOf = (
  node: MarkSchema,
  context: { alternatives: MarkSchema[]; at: CheckAt },
): Checked => {
  for (const alternative of context.alternatives) {
    const result = check(alternative, context.at);
    if (result.value !== REMOVED && result.problems.length === 0) {
      return result;
    }
  }
  return invalidResult(node, context.at);
};

/** 値をスキーマで検証し、誤りと知らないキーを除いた値を返却する */
const check = (node: MarkSchema, at: CheckAt): Checked => {
  const { root, value, path } = at;
  const resolved = resolve(node, root);
  if (resolved.anyOf) {
    return checkAnyOf(node, { alternatives: resolved.anyOf, at });
  }
  if (violates(resolved, value)) {
    return invalidResult(node, at);
  }
  if (Array.isArray(value)) {
    return checkArray(resolved, { root, value, path });
  }
  if (isMarkOptions(value) && resolved.type === "object") {
    return checkObject(resolved, { root, value, path });
  }
  return { value, problems: [], unknownKeys: [] };
};

/** 配列の要素を検証し、取り除いた要素を詰める */
const checkArray = (
  node: MarkSchema,
  at: { root: MarkSchema; value: unknown[]; path: string },
): Checked => {
  const { root, value, path } = at;
  const out: unknown[] = [];
  const problems: MarkProblem[] = [];
  const unknownKeys: string[] = [];
  value.forEach((item, index) => {
    const result = node.items
      ? check(node.items, { root, value: item, path: childPath(path, index) })
      : { value: item, problems: [], unknownKeys: [] };
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value !== REMOVED) {
      out.push(result.value);
    }
  });
  return { value: out, problems, unknownKeys };
};

/** オブジェクトの値 */
type ObjectAt = { root: MarkSchema; value: MarkOptions; path: string };

/** キーのスキーマ（`properties` に無ければ `additionalProperties`） */
const propertySchemaOf = (
  node: MarkSchema,
  key: string,
): MarkSchema | undefined =>
  node.properties?.[key] ??
  (typeof node.additionalProperties === "object"
    ? node.additionalProperties
    : undefined);

/** オブジェクトのキーごとに検証し、知らないキーと誤りの値を除く */
const checkProperties = (
  node: MarkSchema,
  at: ObjectAt,
): Checked & { value: MarkOptions; removed: Set<string> } => {
  const { root, value, path } = at;
  const out: MarkOptions = {};
  const problems: MarkProblem[] = [];
  const unknownKeys: string[] = [];
  const removed = new Set<string>();
  for (const [key, child] of Object.entries(value)) {
    const schema = propertySchemaOf(node, key);
    if (schema === undefined) {
      unknownKeys.push(childPath(path, key));
      continue;
    }
    const result = check(schema, {
      root,
      value: child,
      path: childPath(path, key),
    });
    problems.push(...result.problems);
    unknownKeys.push(...result.unknownKeys);
    if (result.value === REMOVED) {
      removed.add(key);
    } else {
      out[key] = result.value;
    }
  }
  return { value: out, problems, unknownKeys, removed };
};

/** 必須のキーが欠けた誤り */
const missingProblems = (node: MarkSchema, at: ObjectAt): MarkProblem[] => {
  const { root, value, path } = at;
  return (node.required ?? [])
    .filter((key) => !Object.hasOwn(value, key))
    .map((key) => {
      const property = node.properties?.[key];
      const example = property
        ? ` \`${show({ [key]: exampleOf(property, root) })}\` のように記載してください。`
        : "";
      const owner = path === "" ? "" : `の \`${path}\` `;
      return {
        path: childPath(path, key),
        message: `${owner}に必須の \`${key}\` がありません。${example}この設定を当てずに描いています。`,
      };
    });
};

/** 誤りで取り除いたキーが必須か、オブジェクトの振る舞いを決めるキーなら、このオブジェクトも当てない */
const removesOwner = (
  node: MarkSchema,
  context: { path: string; removed: Set<string> },
): boolean => {
  const { path, removed } = context;
  if (path === "") {
    return false;
  }
  const owner =
    path
      .split(/\.|\[\d+\]/)
      .filter(Boolean)
      .at(-1) ?? "";
  return [...(node.required ?? []), ...(DECIDING_KEYS[owner] ?? [])].some(
    (key) => removed.has(key),
  );
};

/** オブジェクトのキーを検証し、知らないキーと誤りの値を除き、必須のキーが欠けたら取り除く */
const checkObject = (node: MarkSchema, at: ObjectAt): Checked => {
  const { path } = at;
  const { removed, ...checked } = checkProperties(node, at);
  const missing = missingProblems(node, at);
  checked.problems.push(...missing);
  // 引数そのもの（最上位）は取り除かない
  if (
    (missing.length > 0 && path !== "") ||
    removesOwner(node, { path, removed })
  ) {
    return { ...checked, value: REMOVED };
  }
  return checked;
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
  const result = checkObject(resolve(schema, schema), {
    root: schema,
    value: options.options,
    path: "",
  });
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

/** キーのパスの 1 段の子のスキーマ（配列は要素のスキーマ） */
const segmentSchemaOf = (
  node: MarkSchema,
  context: { schema: MarkSchema; segment: string },
): MarkSchema | undefined => {
  const resolved: MarkSchema = resolve(node, context.schema);
  const child =
    resolved.properties?.[context.segment] ??
    (typeof resolved.additionalProperties === "object"
      ? resolved.additionalProperties
      : resolved.items);
  return child?.items && !child.properties ? child.items : child;
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
    node = segmentSchemaOf(node, { schema, segment });
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
