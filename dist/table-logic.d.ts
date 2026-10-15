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
