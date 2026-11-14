import { type MapProblem } from "./spec.ts";
/** 範囲の中身（マーカーの引数・mermaid のブロック・補足とその数）。line は範囲の開きのマーカーからの行 */
export type MapRangeSource = {
    args: string;
    mermaid: string | undefined;
    mermaidCount: number;
    data?: string | undefined;
    dataCount: number;
    /** mermaid のブロックの中身の 1 行目の、範囲の開きのマーカーからの行 */
    mermaidLine?: number | undefined;
    /** 補足の YAML の 1 行目の、範囲の開きのマーカーからの行 */
    dataLine?: number | undefined;
};
/** 描ける図の種類 */
export type MapKindName = "flowchart" | "sequenceDiagram" | "erDiagram" | "stateDiagram";
/** Mermaid の 1 行目の最初の単語から図の種類を決める */
export declare const mapKindOf: (mermaid: string) => MapKindName | undefined;
/** 範囲の mermaid のブロックと補足の数・図の種類・マーカーの引数だけを確かめる（Mermaid と補足の中身は読まない） */
export declare const collectMapStructure: (range: MapRangeSource) => {
    problems: MapProblem[];
    kind: MapKindName | undefined;
    args: {
        args: import("./spec.ts").MapArgs;
        normalized: string;
        problems: MapProblem[];
        unknownKeys: string[];
    };
};
