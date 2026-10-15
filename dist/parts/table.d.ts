import { type FilterKind, type FilterValue } from "../table-logic.ts";
/** 表の種類 */
export type TableKind = "default" | "data" | "plain";
/** 表の機能 */
export type TableFeature = "sort" | "pin" | "filter";
/** 絞り込みを付ける列 */
export type TableFilter = {
    /** 列の位置 */
    column: number;
    /** 絞り込みの種類 */
    kind: FilterKind;
};
/** 表の部品の引数 */
export type TableOptions = {
    /** 表の種類（既定 `default`） */
    kind?: TableKind;
    /** 付ける機能 */
    features: string[];
    /** 列の見出しの HTML。`body` を渡すときは省く */
    columns?: string[];
    /** 行ごとのセルの HTML。`body` を渡すときは省く */
    rows?: string[][];
    /** 絞り込みを付ける列 */
    filters?: TableFilter[];
    /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
    collapse?: "none" | "closed" | "open";
    /** 並べ替えた列と向き */
    sort?: {
        column: number;
        direction: "ascending" | "descending";
    };
    /** 表が幅からはみ出しているか。`true` のときだけピン止めのボタンを出す */
    overflow?: boolean;
    /** 左端に留める列の数 */
    pinned?: number;
    /** 開いた絞り込みのドロワーの列の位置 */
    openFilter?: number;
    /** 当てている絞り込み */
    filterValues?: FilterValue[];
    /** 表の代わりに置く HTML（`SLOT_MARKER` を渡せる） */
    body?: string;
};
/** 見出しのボタンとドロワーを作る引数 */
export type TableToolsOptions = {
    /** ドロワーの id の頭 */
    id: string;
    /** 列の位置 */
    column: number;
    /** 列名 */
    label: string;
    /** 機能 */
    features: string[];
    /** 絞り込み（`select` は候補の値） */
    filter?: {
        kind: FilterKind;
        values: string[];
    } | undefined;
    /** 絞り込みを当てているか */
    active?: boolean;
    /** ドロワーを開いているか */
    open?: boolean;
    /** 当てている絞り込み */
    value?: FilterValue | undefined;
    /** ピン止めのボタンを出すか（既定 `false`。`mount` が幅を測って決める） */
    pinVisible?: boolean;
    /** この列までを留めているか */
    pinPressed?: boolean;
};
/** 列 1 つの見出しの中身（並べ替え・絞り込み・ピン止めのボタン）と、その列の絞り込みのドロワーの HTML を返す */
export declare function renderTableTools(options: TableToolsOptions): {
    header: string;
    drawer: string;
};
/** 表を囲む HTML を返す。`body` を渡すと囲みだけを作り、渡さなければ `columns`・`rows` から表を作る */
export declare function renderTable(options: TableOptions): string;
