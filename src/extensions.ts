import { MARK_NAME_PATTERN } from "./config.ts";
import type { StandardSchemaV1 } from "./standard-schema.ts";

/** 印の引数を読み分けた値。拡張の `schema` と `draw` が受け取る */
export type MdmarkMarkArgs = {
  /** `キー=値` でない引数を書いた順に */
  args: string[];
  /** `キー=値` の引数。同じキーは後に書いた値 */
  keys: Record<string, string>;
  /** 印を範囲で書き、範囲に `json` のコードブロックを 1 つ置いたときの、その JSON を読んだ値。範囲が無い印では持たない */
  definition?: unknown;
};

/** `load` が返すモジュールの形 */
export type MdmarkExtensionModule = {
  /** 印の場所の要素に描く */
  draw: (slot: HTMLElement, value: MdmarkMarkArgs) => void | Promise<void>;
};

/** `registerExtension` に渡す拡張 */
export type MdmarkExtension = {
  /** 拡張の名前。知らせの枠・書き方の警告・`console.error` に出す */
  name: string;
  /** 印の名前 */
  directive: string;
  /** モジュールを読む関数 */
  load: () => Promise<MdmarkExtensionModule>;
  /** 引数を検査する Standard Schema */
  schema?: StandardSchemaV1<MdmarkMarkArgs> | undefined;
};

/** 書き方の警告に並べる 1 項目 */
export type WarningItem = {
  /** 項目の頭に `code` で出す文字。空なら出さない */
  label: string;
  /** 項目の本文 */
  message: string;
};

/** 拡張に使えない印の名前: `features` と記法の印 */
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

/** 拡張の登録表: `directive` から拡張を引く。ページに 1 つ */
const extensions = new Map<string, MdmarkExtension>();

/** 拡張の形を確かめて登録表に足す。合わない項目があれば `TypeError`、名前が重なれば `Error` を投げて登録しない */
export function registerExtension(extension: MdmarkExtension): void {
  if (typeof extension.name !== "string" || extension.name === "") {
    throw new TypeError("name が空");
  }
  if (
    typeof extension.directive !== "string" ||
    !MARK_NAME_PATTERN.test(extension.directive)
  ) {
    throw new TypeError(
      `directive が印の名前の書式に合わない: ${String(extension.directive)}`,
    );
  }
  if (typeof extension.load !== "function") {
    throw new TypeError("load が関数でない");
  }
  if (
    extension.schema !== undefined &&
    typeof extension.schema["~standard"]?.validate !== "function"
  ) {
    throw new TypeError("schema が ~standard.validate を持たない");
  }
  if (
    RESERVED_DIRECTIVES.has(extension.directive) ||
    extensions.has(extension.directive)
  ) {
    throw new Error(`directive が重なっている: ${extension.directive}`);
  }
  extensions.set(extension.directive, extension);
}

/** `directive` の拡張を返す。無ければ `undefined` */
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

/** issue の `path` が `args` と位置、`keys` とキーに届けばそれを示すラベルにし、`message` を本文にする */
export function formatIssue(
  issue: StandardSchemaV1.Issue,
  value: MdmarkMarkArgs,
): WarningItem {
  const [group, key] = (issue.path ?? []).map(keyOf);
  let label = "";
  if (group === "args" && key !== undefined) {
    const position = Number(key);
    const text = value.args[position];
    label = `${position + 1} つ目${text === undefined ? "" : `の ${text}`}`;
  } else if (group === "keys" && key !== undefined) {
    label = `${String(key)}=`;
  }
  return { label, message: issue.message };
}

/** `schema` で引数を検査し、合えば空、合わなければ issue ごとの項目を返す。`validate` の例外・拒否はそのまま投げる */
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
