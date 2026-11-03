/** 絞り込みの種類 */
export type FilterKind = "select" | "text" | "date";
/** `filter=` に書ける絞り込みの種類。省いたときは先頭 */
export declare const FILTER_KINDS: readonly FilterKind[];
/** 列 1 つに当てた絞り込み */
export type FilterValue = {
    /** 列の位置 */
    column: number;
    /** `select` の選んだ値 */
    values?: string[] | undefined;
    /** `text` の含む文字 */
    text?: string | undefined;
    /** `date` の開始日（`YYYY-MM-DD`） */
    from?: string | undefined;
    /** `date` の終了日（`YYYY-MM-DD`） */
    to?: string | undefined;
};
/** セルの文字の前後の空白と `,` を除いて数にする。空か数として読めなければ `undefined` */
export declare function parseNumberCell(text: string): number | undefined;
/** 並べ替えの比較。両方が数値なら数の大きさ、それ以外は辞書の順で比べる */
export declare function compareCells(a: string, b: string): number;
/** セルが絞り込みに合うか。値が空の絞り込みは全てに合う */
export declare function matchesFilter(cell: string, kind: FilterKind, value: FilterValue): boolean;
/** 集計の計算 */
export type TotalCalc = "sum" | "avg" | "count";
/** `total=列名:計算` に書ける計算。集計の行の題は `TOTAL_LABELS` */
export declare const TOTAL_CALCS: readonly TotalCalc[];
/** 集計の行に出す題 */
export declare const TOTAL_LABELS: Readonly<Record<TotalCalc, string>>;
/** セルの文字を集計して表示する文字にする。`sum`・`avg` は数として読めるセルだけ、`count` は空でないセルを数える */
export declare function computeTotal(cells: string[], calc: TotalCalc): string;
/** 集計する列と計算 */
export type TotalSpec = {
    column: number;
    calc: TotalCalc;
};
/** 数として読めない値を持つ、集計する列と計算 */
export type UnreadableTotal = {
    column: number;
    calc: "sum" | "avg";
    /** 読めないセルの文字（重なりを除いて現れた順） */
    values: string[];
};
/** `sum`・`avg` の列ごとに、空でなく数として読めないセルの文字を集める。読めないセルが無い列と計算、`count` は返さない */
export declare function findUnreadableTotals(options: {
    rows: string[][];
    totals: TotalSpec[];
}): UnreadableTotal[];
/** 行ごとのセルの文字を、セルをタブで、行を改行で区切った文字にする。セルの中のタブと改行は空白 1 つにする */
export declare function tableToTsv(rows: string[][]): string;
/** 行ごとのセルの文字を、先頭の行を見出しの行にした Markdown の表にする。セルの中の `|` は `\|` にし、改行は空白 1 つにする */
export declare function tableToMarkdown(rows: string[][]): string;
/** 描く先の要素の中身の幅（px）がこの値未満のときだけ最終列を畳む */
export declare const FOLD_MAX_WIDTH = 720;
/** 最終列を畳むか。幅が `FOLD_MAX_WIDTH` 未満で、表示している最終列が先頭の列でなく、そのセルのどれかが 1 行に収まらないときだけ `true` */
export declare function shouldFold(options: {
    width: number;
    lastColumn: number;
    wraps: boolean;
}): boolean;
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
/** `animation-timeline` を持つブラウザで、CSS のアニメーションが使う動く範囲（px）を求める。集計の行が無ければ `footMax`・`footEnd` は 0 */
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
/** `location.hash` の最後の `#` の後ろを戻した文字を返す。戻せないときはそのまま、`#` が無ければ空文字 */
export declare function rowIdFromHash(hash: string): string;
