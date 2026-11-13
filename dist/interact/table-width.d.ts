/** 列の幅を決めるときに測る本文の行の数の上限。表の先頭から数える */
export declare const MEASURE_ROWS = 200;
/** 表示している列 1 つを測った結果 */
export type ColumnMeasure = {
    /** 元の列の位置 */
    column: number;
    /** 最も長い行の幅（px。セルの余白と罫線を含む） */
    longest: number;
    /** 最も長い半角の単語の幅（px。セルの余白と罫線を含む） */
    longestWord: number;
    /** 見出しのセルの文字の大きさ（px） */
    em: number;
};
/** 表示している列ごとに、最も長い行の幅と最も長い半角の単語の幅を測って返却する */
export declare const measureColumns: (table: HTMLTableElement, headCells: HTMLTableCellElement[]) => ColumnMeasure[];
/** 列の幅を自動で決める処理の引数 */
export type AutoColumnWidthsOptions = {
    /** 表の囲み（`div.mdmark-table`） */
    wrapper: HTMLElement;
    /** 表を包む要素（`div.mdmark-table-scroll`） */
    scroller: HTMLElement;
    /** 列ごとの最下段の見出しのセル */
    headCells: HTMLTableCellElement[];
    /** 長文の列の最小の幅（em） */
    longColumnMin: number;
    /** 幅を入れた後に呼ぶ */
    onApply?: () => void;
};
/** 列の中身の幅を測って列の幅を決め、見出しのセルと表の CSS 変数に入れる */
export declare const attachAutoColumnWidths: (table: HTMLTableElement, options: AutoColumnWidthsOptions) => {
    refresh: () => void;
    columnsChanged: () => void;
    detach: () => void;
};
