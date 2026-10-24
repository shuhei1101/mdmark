import { type FilterKind } from "../table-logic.ts";
/** ボードの列の見出しに使えるアイコンの名前 */
export declare const VIEW_ICON_NAMES: readonly ["circle", "circle-dashed", "circle-dot", "circle-pause", "circle-check", "circle-x", "inbox", "archive", "clock", "flag", "star", "bug", "eye", "lock", "zap", "ban"];
/** ボードの列の見出しに使えるアイコンの名前 */
export type ViewIconName = (typeof VIEW_ICON_NAMES)[number];
/** ボードの列の値から引く既定のアイコン。無い値は `FALLBACK_VALUE_ICON` */
export declare const DEFAULT_VALUE_ICONS: Readonly<Record<string, ViewIconName>>;
/** 既定の対応にも `icons` にも無い値のアイコン */
export declare const FALLBACK_VALUE_ICON: ViewIconName;
/** `mountView` に渡す項目と表示の指定 */
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
    /** ボードの列の見出しの値からアイコンの名前を引く対応。既定の対応に重ねる */
    icons?: Record<string, ViewIconName> | undefined;
};
/** `mountView` の Promise の値 */
export type MdmarkViewHandle = {
    /** 要素の中を空にし、ビューの操作と `document` の受け取りを外す。2 回目以降は何もしない */
    destroy: () => void;
};
/** `render` が `div.mdmark-view` の `data-view` に JSON で書き、`attachView` が読む指定 */
export type ViewSpec = {
    /** ボードで分ける列の位置。`group=` が無いか表に無ければ `null` */
    group: number | null;
    /** 描いた直後に出すビュー */
    mode: "board" | "table";
    /** `group=` の列が表に無いときの書き方の警告の `id`。それ以外は空 */
    boardDisabled: string;
    /** `icons=` の読めた対応 */
    icons: Record<string, ViewIconName>;
};
/** アイコンの名前として使えるか */
export declare function isViewIconName(name: string): name is ViewIconName;
/** `mountView` の引数がインターフェース定義のとおりかを確かめ、合わなければ誤った引数の名前を含む `TypeError` を投げる */
export declare function checkViewOptions(el: unknown, opts: unknown): asserts opts is MdmarkViewOptions;
