import type { WarningItem } from "../../extensions.ts";
/** 上のセルと結合するセルの文字 */
export declare const MERGE_UP = "^^";
/** 左のセルと結合するセルの文字 */
export declare const MERGE_LEFT = "<<";
/** 結合の計画の 1 つのセル */
export type PlannedCell = {
    /** 覆う行の数（覆わないときは 1） */
    rowspan: number;
    /** 覆う列の数（覆わないときは 1） */
    colspan: number;
    /** 結合したセルの向き */
    merged?: "up" | "left";
    /** 結合したセルの、始まりのセルの位置（行・列） */
    source?: [number, number];
};
/** 表のセルの文字の格子から決めた、セルごとの結合と、結合できない `^^`・`<<` の警告 */
export type CellMergePlan = {
    /** 行と列の位置ごとのセル */
    cells: PlannedCell[][];
    /** 本文の行に `^^` の結合を持つ列の位置（小さい順） */
    mergeColumns: number[];
    /** 結合する相手の無い `^^`・`<<` の項目 */
    warnings: WarningItem[];
};
/** 表のセルの文字の格子から、`^^`・`<<` の結合を決める */
export declare function planCellMerges(options: {
    cells: string[][];
    headRows: number;
}): CellMergePlan;
/** 見出しの結合の計画から、最下段の列ごとに、その列を覆う上の行の `colspan` を持つ見出しの `{行}:{位置}` を返却する（無ければ `undefined`） */
export declare function headerGroupsOf(options: {
    /** 見出しの行のセルの文字 */
    head: string[][];
    /** `planCellMerges` の結果 */
    plan: CellMergePlan;
}): Array<string | undefined>;
