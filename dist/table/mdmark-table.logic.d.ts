import { type FilterKind } from "./table.logic.ts";
import type { TableOptions } from "./table.part.ts";
/** 行の値の型 */
export type MdmarkTableValue = string | number | null;
/** 列の定義（`<mdmark-table>` の `columns` の要素） */
export type MdmarkTableColumn = {
    /** 列のキー */
    key: string;
    /** 列名 */
    title: string;
    /** 描いた直後にピン止めする */
    pinned?: boolean;
    /** 描いた直後に隠す */
    hidden?: boolean;
    /** 絞り込み */
    filter?: {
        type?: FilterKind;
    };
    /** 列の幅。意味は表のマーカーの設定の `columns.{列名}.width` */
    width?: {
        mode?: "auto" | "wrap" | "nowrap";
        min?: number;
        max?: number;
    };
    /** 編集できる列 */
    editable?: boolean;
    /** セルの中身の描き方 */
    render?: (value: MdmarkTableValue, row: MdmarkTableRow) => Node | string;
};
/** 行のデータ（`<mdmark-table>` の `rows` の要素） */
export type MdmarkTableRow = {
    /** 行のキー */
    key: string;
    /** 列のキーごとの値 */
    values: Record<string, MdmarkTableValue>;
};
/** 受け付ける機能 */
export declare const TABLE_ELEMENT_FEATURES: readonly ["sort", "pin", "filter", "resize", "count", "columns", "reorder", "add"];
/** 機能の名前 */
export type MdmarkTableFeatureName = (typeof TABLE_ELEMENT_FEATURES)[number];
/** 表の機能（`<mdmark-table>` の `features`） */
export type MdmarkTableFeatures = Partial<Record<MdmarkTableFeatureName, {
    enabled?: boolean;
}>>;
/** 指定の誤り */
export type TableSpecIssue = {
    /** 誤った指定の名前 */
    path: string;
    /** 誤りの内容と修正方法 */
    reason: string;
};
/** 確認済みの指定 */
export type TableSpec = {
    columns: MdmarkTableColumn[];
    rows: MdmarkTableRow[];
    features: MdmarkTableFeatures | undefined;
};
/** `columns`・`rows`・`features` を確認し、最初に見つけた誤りを返却する（誤りが無ければ `undefined`） */
export declare const checkTableSpec: (spec: {
    columns: unknown;
    rows: unknown;
    features: unknown;
}) => TableSpecIssue | undefined;
/** 行の値をセルに出す文字にする */
export declare const cellText: (value: MdmarkTableValue | undefined) => string;
/** 確認済みの指定を `renderTable` の引数にする */
export declare const toTableOptions: (spec: TableSpec) => TableOptions;
