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
/** 行ごとのセルの文字を、セルをタブで、行を改行で区切った文字にする。セルの中のタブと改行は空白 1 つにする */
export declare function tableToTsv(rows: string[][]): string;
/** `location.hash` の最後の `#` の後ろを戻した文字を返す。戻せないときはそのまま、`#` が無ければ空文字 */
export declare function rowIdFromHash(hash: string): string;
