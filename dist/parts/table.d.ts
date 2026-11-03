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
/** コピーの形式 */
export type CopyFormat = "markdown" | "tsv";
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
    /** 折り畳みの見出し（既定は `表（{本文の行の数} 行）`） */
    title?: string | undefined;
    /** `rows` を省いたときの本文の行の数。折り畳みの見出しに使う */
    rowCount?: number;
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
    /** 出している集計の行の計算（既定は `totals` の全ての計算） */
    shownTotals?: TotalCalc[];
    /** 集計のメニューを開いているか */
    openTotals?: boolean;
    /** コピーの形式のメニューを開いているか */
    openCopy?: boolean;
    /** クリップボードに書けなかったときに手でコピーさせるパネルの中身 */
    copyFallback?: {
        format: CopyFormat;
        text: string;
    };
    /** `targetRow` の行の URL をコピーした結果 */
    rowLinkNotice?: "copied" | "failed";
    /** 最終列を畳んでいるか */
    folded?: boolean;
    /** 畳んだ最終列を開いている本文の行の位置 */
    unfoldedRows?: number[];
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
/** コピーのボタンの中身（状態のアイコン・文言・形式のメニューを開くことを示す下向きの矢印）の HTML */
export declare function renderCopyButtonContent(state: CopyState): string;
/** コピーの形式の名前と使いどころ */
export declare const COPY_FORMATS: {
    readonly markdown: {
        readonly name: "Markdown の表";
        readonly note: "文書に貼るとそのまま表になる";
    };
    readonly tsv: {
        readonly name: "TSV";
        readonly note: "表計算ソフトに貼るとセルに分かれる";
    };
};
/** 表の上の帯（件数・列の表示・集計・コピーのボタン）と、列の表示・集計・コピーの形式のメニューの HTML を返す。付けた機能が無ければ空 */
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
    /** 列の表示のメニューを開いているか（既定 `false`） */
    openColumns?: boolean;
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: CopyState;
    /** 集計する計算 */
    totals?: TotalCalc[];
    /** 出している集計の行の計算（既定は `totals` の全て） */
    shownTotals?: TotalCalc[];
    /** 集計のメニューを開いているか（既定 `false`） */
    openTotals?: boolean;
    /** コピーの形式のメニューを開いているか（既定 `false`） */
    openCopy?: boolean;
}): {
    bar: string;
    menus: string;
};
/** 集計の行（`<tfoot>`）の HTML を返す。計算ごとに 1 行（`sum`・`avg`・`count` の順）で、列の数だけセルを持つ。先頭のセルに計算の名前、集計する列のセルに値を出し、隠している列のセルと出さない計算の行は隠す */
export declare function renderTotalRows(options: {
    /** 列の数 */
    columns: number;
    /** 集計する列と計算と整えた値 */
    totals: Array<TableTotal & {
        value: string;
    }>;
    /** 出す計算（既定は全て） */
    shown?: TotalCalc[];
    /** 隠している列の位置 */
    hiddenColumns: number[];
    /** 列名（`data-label`） */
    labels: string[];
}): string;
/** 手でコピーさせるパネルの形式。`tree` はファイルツリーの元の罫線のテキスト */
export type CopyPanelFormat = CopyFormat | "tree";
/** クリップボードに書けなかったときに、帯の直後へ置く手でコピーさせるパネルの HTML を返す */
export declare function renderCopyPanel(options: {
    /** 題の id の頭 */
    id: string;
    /** コピーの形式 */
    format: CopyPanelFormat;
    /** コピーする文字 */
    text: string;
}): string;
/** 最終列を畳んだ表の本文の行 1 つについて、先頭のセルに置く開閉のボタンと、行の直後に置く開閉の行の HTML を返す */
export declare function renderFoldedColumn(options: {
    /** 開閉の行の id（ボタンの `aria-controls` が指す） */
    id: string;
    /** 表の列の数 */
    columns: number;
    /** 行の先頭のセルの文字 */
    label: string;
    /** 最終列の見出しの文字 */
    name: string;
    /** 行の最終列のセルの中身の HTML */
    html: string;
    /** 開いているか（既定 `false`） */
    open?: boolean;
}): {
    toggle: string;
    row: string;
};
/** 行へのリンクの印を持つ先頭のセルの HTML を返す。`content` は先頭のセルの中身（`SLOT_MARKER` を渡して前後に分けられる）。`notice` を渡すと、URL をコピーした結果を印の横の知らせに出す */
export declare function renderRowLink(content: string, id: string, label: string, notice?: "copied" | "failed"): string;
/** 表を囲む HTML を返す。`body` を渡すと囲みだけを作り、渡さなければ `columns`・`rows` から表を作る */
export declare function renderTable(options: TableOptions): string;
