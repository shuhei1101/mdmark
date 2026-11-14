import { MARK_NAME_PATTERN } from "./config.ts";
import type { StandardSchemaV1 } from "./standard-schema.ts";

/** マーカーの引数。拡張の `schema` と `draw` が受け取る */
export type MdmarkMarkArgs = {
  /** マーカーの名前の後ろの JSON のオブジェクト（引数の無いマーカーは `{}`） */
  options: Record<string, unknown>;
  /** マーカーを範囲で記載し、範囲に `json` のコードブロックを 1 つ配置したときの、その JSON を読み込んだ値。範囲が無いマーカーでは持たない */
  definition?: unknown;
};

/** `load` が返却するモジュールの構造 */
export type MdmarkExtensionModule = {
  /** マーカーの場所の要素に描く */
  draw: (slot: HTMLElement, value: MdmarkMarkArgs) => void | Promise<void>;
};

/** `registerExtension` に指定する拡張 */
export type MdmarkExtension = {
  /** 拡張の名前。通知ブロック・記載の警告・`console.error` に出す */
  name: string;
  /** マーカーの名前 */
  directive: string;
  /** モジュールを読み込む関数 */
  load: () => Promise<MdmarkExtensionModule>;
  /** 引数を検査する Standard Schema */
  schema?: StandardSchemaV1<MdmarkMarkArgs> | undefined;
};

/** 記載の警告に並べる 1 項目 */
export type WarningItem = {
  /** 項目の頭に `code` で出す文字。空なら出さない */
  label: string;
  /** 項目の本文 */
  message: string;
};

/** 拡張に使用できないマーカーの名前: `features` と記法のマーカー */
export const RESERVED_DIRECTIVES: ReadonlySet<string> = new Set([
  "features",
  "table",
  "tabs",
  "steps",
  "section",
  "row-detail",
  "fig",
  "toc",
  "glossary",
]);

/** 拡張の登録表: `directive` から拡張を参照する。ページに 1 つ */
const extensions = new Map<string, MdmarkExtension>();

/** 拡張の `name`・`directive`・`load`・`schema` が型に合わなければ、合わないところの文言 */
function shapeError(extension: MdmarkExtension): string | undefined {
  if (typeof extension.name !== "string" || extension.name === "") {
    return "name が空";
  }
  if (
    typeof extension.directive !== "string" ||
    !MARK_NAME_PATTERN.test(extension.directive)
  ) {
    return `directive がマーカーの名前の書式に合わない: ${String(extension.directive)}`;
  }
  if (typeof extension.load !== "function") {
    return "load が関数でない";
  }
  if (
    extension.schema !== undefined &&
    typeof extension.schema["~standard"]?.validate !== "function"
  ) {
    return "schema が ~standard.validate を持たない";
  }
  return undefined;
}

/** 拡張の構造を確認して登録表に追加する。合わない項目があれば `TypeError`、名前が重なれば `Error` を投げて登録しない */
export function registerExtension(extension: MdmarkExtension): void {
  const error = shapeError(extension);
  if (error !== undefined) {
    throw new TypeError(error);
  }
  if (
    RESERVED_DIRECTIVES.has(extension.directive) ||
    extensions.has(extension.directive)
  ) {
    throw new Error(`directive が重なっている: ${extension.directive}`);
  }
  extensions.set(extension.directive, extension);
}

/** `directive` の拡張を返却する。無ければ `undefined` */
export function extensionFor(directive: string): MdmarkExtension | undefined {
  return extensions.get(directive);
}

/** 単体テストの前に登録表を空にする。公開の入口からは export しない */
export function resetExtensions(): void {
  extensions.clear();
}

/** issue の `path` の要素から、キーを取り出す */
function keyOf(segment: PropertyKey | StandardSchemaV1.PathSegment): unknown {
  return typeof segment === "object" ? segment.key : segment;
}

/** キーの並びを `.`（数の要素は `[位置]`）でつないだパスにする */
function pathOf(keys: unknown[]): string {
  return keys
    .map((key, index) =>
      typeof key === "number" || /^\d+$/.test(String(key))
        ? `[${String(key)}]`
        : `${index === 0 ? "" : "."}${String(key)}`,
    )
    .join("");
}

/** issue の `path` が `options` の中のキーに届けば `options` の後ろのキーのパス、`definition` の中に届けば `definition.{パス}` をラベルにし、`message` を本文にする */
export function formatIssue(
  issue: StandardSchemaV1.Issue,
  _value: MdmarkMarkArgs,
): WarningItem {
  const [group, ...keys] = (issue.path ?? []).map(keyOf);
  let label = "";
  if (group === "options" && keys.length > 0) {
    label = pathOf(keys);
  } else if (group === "definition" && keys.length > 0) {
    label = `definition.${pathOf(keys)}`;
  }
  return { label, message: issue.message };
}

/** `schema` で引数を検査し、合えば空、合わなければ issue ごとの項目を返却する。`validate` の例外・拒否はそのまま投げる */
export async function validateMarkArgs(
  schema: StandardSchemaV1<MdmarkMarkArgs>,
  value: MdmarkMarkArgs,
): Promise<WarningItem[]> {
  const result = await schema["~standard"].validate(value);
  if (!result.issues) {
    return [];
  }
  return result.issues.map((issue) => formatIssue(issue, value));
}
