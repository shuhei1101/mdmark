import type { MarkOptions } from "./mark-options.ts";
/** 書き出さない今の書き方の記載 1 つ */
export type DroppedLegacyArg = {
    /** 記載した文字（`total=数量:sum`・`filter=名前:range`） */
    text: string;
    /** 書き出さない理由 */
    reason: string;
};
/** 移行の報告の行 1 つ */
export type LegacyReportLine = {
    /** 文書の行（1 から） */
    line: number;
    /** マーカーの名前 */
    name: string;
    /** 記載した文字 */
    text: string;
    /** 書き出さない理由か書き換えない理由 */
    reason: string;
};
/** 変換の途中の結果 */
type Converted = {
    options: MarkOptions;
    dropped: DroppedLegacyArg[];
};
/** マーカーの名前ごとの対応で、今の書き方の引数の文字を JSON のオブジェクトにし、書き出さない記載を分ける */
export declare const convertLegacyArgs: (options: {
    name: string;
    text: string;
}) => Converted;
/** 文書の今の書き方のマーカーを JSON のオブジェクトに書き換え、書き出さない記載と書き換えないマーカーを報告の行にする */
export declare const rewriteLegacyMarks: (options: {
    markdown: string;
}) => {
    markdown: string;
    report: LegacyReportLine[];
};
export {};
