import { type FilterKind, type FilterValue, type TotalCalc } from "../table-logic.ts";
/** 表の種類 */
export type TableKind = "default" | "data" | "plain";
/** 表の機能 */
export type TableFeature = "sort" | "pin" | "filter" | "count" | "columns" | "total" | "copy" | "rowlink";
/** 集計する列 */
export type TableTotal = {
    /** 列の位置 */
    column: number;
    /** 計算 */
    calc: TotalCalc;
};
/** コピーのボタンの状態 */
export type CopyState = "idle" | "copied" | "failed";
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
    /** 既定で隠す列の位置（`data-hide`。先頭の列は含まない） */
    hide?: number[];
    /** 今隠している列の位置（既定は `hide`） */
    hiddenColumns?: number[];
    /** 列の表示のメニューを開いているか */
    openColumns?: boolean;
    /** 集計する列（`data-total`） */
    totals?: TableTotal[];
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: CopyState;
    /** 本文の行ごとの `id`。行に `id` と行へのリンクを付ける */
    rowIds?: string[];
    /** URL の `#ID` が指す行の位置 */
    targetRow?: number;
    /** 表の代わりに置く HTML（`SLOT_MARKER` を渡せる） */
    body?: string;
    /** ドロワーの `id` の頭（既定 `mdmark-table`）。ビューの中の表のように、文書の中に表が 2 つ以上あるときに重ならない値を渡す */
    id?: string;
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
/** コピーのボタンの状態ごとの文言とアイコン */
export declare const COPY_STATES: {
    readonly idle: {
        readonly label: "表をコピー";
        readonly icon: "copy";
    };
    readonly copied: {
        readonly label: "コピーしました";
        readonly icon: "check";
    };
    readonly failed: {
        readonly label: "コピーできませんでした";
        readonly icon: "circle-alert";
    };
};
/** 表の上の帯（件数・列の表示のボタン・コピーのボタン）と列の表示のメニューの HTML を返す。付けた機能が無ければ空 */
export declare function renderTableBar(options: {
    /** メニューの id の頭 */
    id: string;
    /** 付ける機能 */
    features: string[];
    /** 列名 */
    labels: string[];
    /** 表示している行の数 */
    shown: number;
    /** 全ての行の数 */
    total: number;
    /** 隠している列の位置 */
    hiddenColumns: number[];
    /** メニューを開いているか（既定 `false`） */
    openColumns?: boolean;
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: CopyState;
}): {
    bar: string;
    menu: string;
};
/** 集計の行（`<tfoot>`）の HTML を返す。列の数だけセルを持ち、集計する列は題と値を出し、隠している列のセルは隠す */
export declare function renderTotalRow(options: {
    /** 列の数 */
    columns: number;
    /** 集計する列と計算と整えた値 */
    totals: Array<TableTotal & {
        value: string;
    }>;
    /** 隠している列の位置 */
    hiddenColumns: number[];
    /** 列名（`data-label`） */
    labels: string[];
}): string;
/** 行へのリンクの印を持つ先頭のセルの HTML を返す。`content` は先頭のセルの中身（`SLOT_MARKER` を渡して前後に分けられる） */
export declare function renderRowLink(content: string, id: string, label: string): string;
/** 表を囲む HTML を返す。`body` を渡すと囲みだけを作り、渡さなければ `columns`・`rows` から表を作る */
export declare function renderTable(options: TableOptions): string;
