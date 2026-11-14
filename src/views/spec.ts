import { FILTER_KINDS, type FilterKind } from "../table-logic.ts";

/** ボードの列の見出しに使用できるアイコンの名前 */
export const VIEW_ICON_NAMES = [
  "circle",
  "circle-dashed",
  "circle-dot",
  "circle-pause",
  "circle-check",
  "circle-x",
  "inbox",
  "archive",
  "clock",
  "flag",
  "star",
  "bug",
  "eye",
  "lock",
  "zap",
  "ban",
] as const;

/** ボードの列の見出しに使用できるアイコンの名前 */
export type ViewIconName = (typeof VIEW_ICON_NAMES)[number];

/** ボードの列の値から参照する既定のアイコン。無い値は `FALLBACK_VALUE_ICON` */
export const DEFAULT_VALUE_ICONS: Readonly<Record<string, ViewIconName>> = {
  未着手: "circle-dashed",
  進行中: "circle-dot",
  保留: "circle-pause",
  完了: "circle-check",
  中止: "circle-x",
};

/** 既定の対応にも `icons` にも無い値のアイコン */
export const FALLBACK_VALUE_ICON: ViewIconName = "circle";

/** `mountView` に指定する項目と表示の指定 */
export type MdmarkViewOptions = {
  /** 列名。表形式の列の並びと、ボードの項目に出す値の並び */
  columns: string[];
  /** 列名をキーにした項目の値。並びは表の行の順 */
  items: Record<string, string>[];
  /** ボードで列に分ける列名 */
  group?: string | undefined;
  /** 描いた直後に出すビュー */
  default?: "board" | "table" | undefined;
  /** 表形式で絞り込みを付ける列と種類 */
  filter?: Record<string, FilterKind> | undefined;
  /** ボードの列の見出しの値からアイコンの名前を参照する対応。既定の対応に重ねる */
  icons?: Record<string, ViewIconName> | undefined;
};

/** `mountView` の Promise の値 */
export type MdmarkViewHandle = {
  /** 要素の中を空にし、ビューの操作と `document` の受け取りを解除する。2 回目以降は何もしない */
  destroy: () => void;
};

/** `render` が `div.mdmark-view` の `data-view` に JSON で記載し、`attachView` が読み込む指定 */
export type ViewSpec = {
  /** ボードで分ける列の位置。`group=` が無いか表に無ければ `null` */
  group: number | null;
  /** 描いた直後に出すビュー */
  mode: "board" | "table";
  /** `group=` の列が表に無いときの記載の警告の `id`。それ以外は空 */
  boardDisabled: string;
  /** `icons=` の読み込めた対応 */
  icons: Record<string, ViewIconName>;
};

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** アイコンの名前として使用できるか */
export function isViewIconName(name: string): name is ViewIconName {
  return (VIEW_ICON_NAMES as readonly string[]).includes(name);
}

/** 空でなく重ならない文字列を 1 つ以上並べた配列か */
function isColumnList(columns: unknown): columns is string[] {
  return (
    Array.isArray(columns) &&
    columns.length > 0 &&
    columns.every((column) => typeof column === "string" && column !== "") &&
    new Set(columns).size === columns.length
  );
}

/** 文字列の値だけを持つオブジェクトの配列か */
function isItemList(items: unknown): boolean {
  return (
    Array.isArray(items) &&
    items.every(
      (item) =>
        isRecord(item) &&
        Object.values(item).every((v) => typeof v === "string"),
    )
  );
}

/** 列名のどれかか（省略を含む） */
function isGroupOption(group: unknown, names: string[]): boolean {
  return (
    group === undefined || (typeof group === "string" && names.includes(group))
  );
}

/** 列名をキーに絞り込みの種類を値にしたオブジェクトか（省略を含む） */
function isFilterOption(filter: unknown, names: string[]): boolean {
  return (
    filter === undefined ||
    (isRecord(filter) &&
      Object.entries(filter).every(
        ([name, kind]) =>
          names.includes(name) && FILTER_KINDS.includes(kind as FilterKind),
      ))
  );
}

/** `board` か `table`（`board` は `group` があるときだけ）か（省略を含む） */
function isModeOption(mode: unknown, group: unknown): boolean {
  if (mode === undefined || mode === "table") {
    return true;
  }
  return mode === "board" && group !== undefined;
}

/** 値からアイコンの名前を参照するオブジェクトか（省略を含む） */
function isIconsOption(icons: unknown): boolean {
  return (
    icons === undefined ||
    (isRecord(icons) &&
      Object.values(icons).every(
        (name) => typeof name === "string" && isViewIconName(name),
      ))
  );
}

/** `mountView` の引数がインターフェース定義のとおりかを確認し、合わなければ誤った引数の名前を含む `TypeError` を投げる */
export function checkViewOptions(
  el: unknown,
  opts: unknown,
): asserts opts is MdmarkViewOptions {
  if (!(el instanceof HTMLElement)) {
    throw new TypeError("el は HTMLElement で指定してください");
  }
  if (!isRecord(opts)) {
    throw new TypeError("opts はオブジェクトで指定してください");
  }
  const { columns, items, group, filter, icons } = opts;
  if (!isColumnList(columns)) {
    throw new TypeError(
      "opts.columns は、空でなく重ならない文字列を 1 つ以上並べた配列で指定してください",
    );
  }
  if (!isItemList(items)) {
    throw new TypeError(
      "opts.items は、列名をキーに文字列の値を持つオブジェクトの配列で指定してください",
    );
  }
  if (!isGroupOption(group, columns)) {
    throw new TypeError(
      "opts.group は opts.columns のどれかで指定してください",
    );
  }
  if (!isFilterOption(filter, columns)) {
    throw new TypeError(
      `opts.filter は、opts.columns のどれかをキーに ${FILTER_KINDS.join("・")} のどれかを値にしたオブジェクトで指定してください`,
    );
  }
  if (!isModeOption(opts.default, group)) {
    throw new TypeError(
      "opts.default は board か table で指定してください（board は opts.group があるときだけ）",
    );
  }
  if (!isIconsOption(icons)) {
    throw new TypeError(
      `opts.icons は、値からアイコンの名前を参照するオブジェクトで指定してください。使用できるアイコンは ${VIEW_ICON_NAMES.join("・")} です`,
    );
  }
}
