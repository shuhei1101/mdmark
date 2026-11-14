import type { FilterValue } from "../table-logic.ts";
import { type TableFilter } from "./table.ts";
/** 使用できるアイコンと切り替えの `board`・`table` の、24 の格子の lucide の svg の中身 */
export declare const VIEW_ICON_PATHS: Readonly<Record<string, string>>;
/** 「ボード」「表」の切り替えの HTML を返却する */
export declare function renderViewSwitch(props: {
    /** 出すビュー */
    mode: "board" | "table";
    /** ボードにできない理由の記載の警告の `id` */
    boardDisabled?: string | undefined;
}): string;
/** 値ごとの列に項目を並べたボードの HTML を返却する。`group` が列の位置でなければ空のボード */
export declare function renderViewBoard(props: {
    /** 列名 */
    columns: string[];
    /** 項目ごとの値（`columns` と同じ並び） */
    items: string[][];
    /** 分ける列の位置 */
    group: number;
    /** 値からアイコンの名前を参照する上書きの対応 */
    icons: Record<string, string>;
    /** 隠すか（既定 `false`） */
    hidden?: boolean;
}): string;
/** 項目の表を、`group` の列の値ごとに並べたボードと、表形式で切り替えて出す HTML を返却する */
export declare function renderView(props: {
    /** 列名 */
    columns: string[];
    /** 項目ごとの値（`columns` と同じ並び） */
    items: string[][];
    /** ボードで分ける列名。無ければ切り替えを配置せず、表形式だけを出す */
    group?: string | undefined;
    /** 出しているビュー（既定は `group` があればボード） */
    mode?: "board" | "table" | undefined;
    /** 表形式で絞り込みを付ける列 */
    filters?: TableFilter[] | undefined;
    /** 表形式に適用している絞り込み */
    filterValues?: FilterValue[] | undefined;
    /** 開いた絞り込みのドロワーの列の位置 */
    openFilter?: number | undefined;
    /** ボードの列の見出しのアイコンの上書き */
    icons?: Record<string, string> | undefined;
    /** ボードにできない理由の記載の警告の `id` */
    boardDisabled?: string | undefined;
    /** ビューの要素の `id` の頭 */
    id: string;
}): string;
