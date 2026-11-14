import type { TablePinMode } from "./config.ts";
/** 絞り込みの種類 */
export type FilterKind = "select" | "text" | "date";
/** `filter=` に記載できる絞り込みの種類。省いたときは先頭 */
export declare const FILTER_KINDS: readonly FilterKind[];
/** 列 1 つに適用した絞り込み */
export type FilterValue = {
    /** 列の位置 */
    column: number;
    /** `select` の選んだ値 */
    values?: string[] | undefined;
    /** `text` のキーワード */
    text?: string | undefined;
    /** `date` の開始日（`YYYY-MM-DD`） */
    from?: string | undefined;
    /** `date` の終了日（`YYYY-MM-DD`） */
    to?: string | undefined;
};
/** セルの文字の前後の空白と `,` を除いて数にする。空か数として読み込めなければ `undefined` */
export declare function parseNumberCell(text: string): number | undefined;
/** 並べ替えの比較。両方が数値なら数の大きさ、それ以外は辞書の順で比べる */
export declare function compareCells(a: string, b: string): number;
/** セルが絞り込みに合うか。値が空の絞り込みは全てに合う */
export declare function matchesFilter(cell: string, kind: FilterKind, value: FilterValue): boolean;
/** 集計の計算 */
export type TotalCalc = "sum" | "avg" | "count";
/** `total=列名:計算` に記載できる計算。集計の行のタイトルは `TOTAL_LABELS` */
export declare const TOTAL_CALCS: readonly TotalCalc[];
/** 集計の行に出すタイトル */
export declare const TOTAL_LABELS: Readonly<Record<TotalCalc, string>>;
/** セルの文字を集計して表示する文字にする。`sum`・`avg` は数として読み込めるセルだけ、`count` は空でないセルを数える */
export declare function computeTotal(cells: string[], calc: TotalCalc): string;
/** 集計する列と計算 */
export type TotalSpec = {
    column: number;
    calc: TotalCalc;
};
/** 数として読み込めない値を持つ、集計する列と計算 */
export type UnreadableTotal = {
    column: number;
    calc: "sum" | "avg";
    /** 読み込めないセルの文字（重なりを除いて現れた順） */
    values: string[];
};
/** `sum`・`avg` の列ごとに、空でなく数として読み込めないセルの文字を集める。読み込めないセルが無い列と計算、`count` は返却しない */
export declare function findUnreadableTotals(options: {
    rows: string[][];
    totals: TotalSpec[];
}): UnreadableTotal[];
/** 行ごとのセルの文字を、セルをタブで、行を改行で区切った文字にする。セルの中のタブと改行は空白 1 つにする */
export declare function tableToTsv(rows: string[][]): string;
/** 行ごとのセルの文字を、先頭の行を見出しの行にした Markdown の表にする。セルの中の `|` は `\|` にし、改行は空白 1 つにする */
export declare function tableToMarkdown(rows: string[][]): string;
/** `animation-timeline` を持たないブラウザで、見出し行を下げる量（0 以上）と集計の行を動かす量（0 以下。集計の行が無ければ 0）を、ずらす前の位置から求める */
export declare function stickyShift(options: {
    stickyTop: number;
    viewportBottom: number;
    headTop: number;
    headBottom: number;
    bodyTop: number;
    bodyBottom: number;
    footTop?: number | undefined;
    footBottom?: number | undefined;
}): {
    head: number;
    foot: number;
};
/** `animation-timeline` を持つブラウザで、CSS のアニメーションが使用する動く範囲（px）を求める。集計の行が無ければ `footMax`・`footEnd` は 0 */
export declare function stickyRange(options: {
    tableTop: number;
    tableBottom: number;
    headTop: number;
    headBottom: number;
    bodyTop: number;
    bodyBottom: number;
    footTop?: number | undefined;
    footBottom?: number | undefined;
}): {
    headStart: number;
    headMax: number;
    footMax: number;
    footEnd: number;
};
/** `location.hash` の最後の `#` の後ろを戻した文字を返却する。戻せないときはそのまま、`#` が無ければ空文字 */
export declare function rowIdFromHash(hash: string): string;
/** 見出しの行ごとのセルの `rowspan`・`colspan` から、列ごとに、その列だけを覆い最下段まで届くセルの位置を返却する。複数の列をまたぐセルしか無い列は `undefined` */
export declare function bottomHeadCells(rows: Array<Array<{
    rowSpan: number;
    colSpan: number;
}>>): Array<{
    row: number;
    cell: number;
} | undefined>;
/** 表示している行の結合する列の値から、列ごとに隣り合う同じ値の範囲の `rowspan` を決める。範囲の始まりは覆う行の数、続く行は 0。左にある結合する列の範囲の切れ目でも切る */
export declare function mergeSpans(options: {
    values: string[][];
    columns: number[];
}): number[][];
/** `data-pin` の位置・行見出しの列の数・ピン止めの動きから、描いた直後に留める列の位置を小さい順に返却する */
export declare const initialPinnedColumns: (options: {
    /** `data-pin` の位置（無ければ空） */
    pin: number[];
    /** `th scope="row"` の行見出しの列の数 */
    rowHeadCount: number;
    /** ピン止めの動き */
    mode: TablePinMode;
    /** `data-unpin` の位置（既定で留める列から除く。無ければ空） */
    unpin?: number[];
}) => number[];
/** ピン止めのボタンを押した列と今の留める列から、新しい留める列の位置を小さい順に返却する（指定された配列は書き換えない） */
export declare const togglePinnedColumn: (options: {
    /** 今の留める列 */
    pinned: number[];
    /** 押した列の位置 */
    column: number;
    /** ピン止めの動き */
    mode: TablePinMode;
}) => number[];
/** 列ごとの幅と留める列から、留める列ごとにそれより左で留めた列の幅の合計（`start`）と右で留めた列の幅の合計（`end`）を返却する */
export declare const pinOffsets: (options: {
    /** 列ごとの幅（隠した列は 0） */
    widths: number[];
    /** 留める列の位置 */
    pinned: number[];
}) => Map<number, {
    start: number;
    end: number;
}>;
/** 選んだ列を左から順に幅を足し、表の見えている幅に収まる列（`fitted`）と、見えている幅を超える列から右の列（`unpinned`）に分けて返却する */
export declare const fitPinnedColumns: (options: {
    /** 列ごとの幅（隠した列は 0） */
    widths: number[];
    /** 選んだ列の位置 */
    pinned: number[];
    /** 表を包む要素の `clientWidth` */
    visibleWidth: number;
}) => {
    fitted: number[];
    unpinned: number[];
};
/** 列の幅を、列の最小幅から上限までに収めた値を返却する。上限が最小幅より小さいときは最小幅を返す */
export declare const clampColumnWidth: (options: {
    /** 指定したい幅（px） */
    width: number;
    /** 列の最小幅（px） */
    min: number;
    /** 上限（px） */
    max: number;
}) => number;
/** 表の見えている幅から、ほかに留めている列の幅の合計を引いた幅を返却する。表がはみ出していないときは見えている幅をそのまま返す */
export declare const columnWidthLimit: (options: {
    /** 表を包む要素の `clientWidth` */
    visibleWidth: number;
    /** 表がはみ出しているか */
    overflowing: boolean;
    /** 列ごとの幅（隠した列は 0） */
    widths: number[];
    /** 留めている列の位置 */
    pinned: number[];
    /** 幅を変える列の位置 */
    column: number;
}) => number;
/** 改行で分けた 1 行がこの文字数（コードポイントの数）以上のセルを持つ列を長文の列にする */
export declare const LONG_COLUMN_CHARS = 20;
/** 設定の `table.long_column_min` が無いか読み込めないときの、長文の列の最小の幅（em） */
export declare const DEFAULT_LONG_COLUMN_MIN_EM = 45;
/** セルの文字が、空・数値・日付・✓ のどれかなら `true` */
export declare const isCompactCellText: (text: string) => boolean;
/** 列ごとのセルを改行で分けた行（`findLongColumns` の引数） */
export type ColumnLines = {
    /** 見出しのセルの行 */
    head: string[];
    /** 本文のセルごとの行と、短い値だけのセルか */
    cells: {
        lines: string[];
        compact: boolean;
    }[];
};
/** 本文のセルが全て短い値でなく、見出しか本文のセルの行のどれかが `LONG_COLUMN_CHARS` 文字以上の列の位置を、小さい順に返却する */
export declare const findLongColumns: (columns: ColumnLines[]) => number[];
/** `filter.type` を省いた列の絞り込みの種類。長文の列なら `text`、ほかは `select` */
export declare const defaultFilterKind: (long: boolean) => FilterKind;
/** 列の折り返すかと最小の幅・望む幅（px） */
export type ColumnBounds = {
    wraps: boolean;
    min: number;
    wanted: number;
};
/** 列が折り返すかと最小の幅・望む幅を決める（読者がつまみで幅を変えた列は呼ぶ側で除く） */
export declare const columnBounds: (options: {
    /** `width.mode` が `nowrap` か */
    nowrap: boolean;
    /** 長文の列か */
    long: boolean;
    /** `data-width` の範囲（em） */
    range?: {
        min?: number;
        max?: number;
    };
    /** 最も長い行の幅（px。セルの余白と罫線を含む） */
    longest: number;
    /** 最も長い半角の単語の幅（px。セルの余白と罫線を含む） */
    longestWord: number;
    /** 表の文字の大きさ（px） */
    em: number;
    /** 長文の列の最小の幅（em） */
    longColumnMin: number;
}) => ColumnBounds;
/** 列ごとの最小の幅・望む幅と表の見える幅から、列の幅（px）と横にスクロールさせるかを返却する */
export declare const distributeColumnWidths: (columns: Array<ColumnBounds & {
    fixed?: boolean;
}>, available: number) => {
    widths: number[];
    overflow: boolean;
};
/** 列が属する結合した見出しの範囲とピン止めの側 */
export type ColumnPlace = {
    /** 結合した見出しの範囲（`{行}:{位置}`。範囲の外は `undefined`） */
    group: string | undefined;
    /** ピン止めした列か */
    pinned: boolean;
};
/** 動かす列と動かす先の列が同じ結合した見出しの範囲で、ピン止めの同じ側にあるときだけ `true` を返却する */
export declare function canMoveColumn(options: {
    from: ColumnPlace;
    to: ColumnPlace;
}): boolean;
/** 列の順（元の列の位置の並び）の `column` を `target` の前か後ろへ動かした新しい並びを返却する */
export declare function moveColumn(options: {
    /** 今の列の順 */
    order: number[];
    /** 動かす列（元の列の位置） */
    column: number;
    /** 動かす先の列（元の列の位置） */
    target: number;
    /** `target` の前か後ろか */
    side: "before" | "after";
}): number[];
