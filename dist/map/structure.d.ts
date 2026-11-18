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
export type MapKindName = "flowchart" | "sequenceDiagram" | "erDiagram" | "stateDiagram" | "classDiagram" | "architecture" | "C4Context" | "C4Container" | "C4Component" | "C4Dynamic" | "C4Deployment" | "mindmap" | "gantt" | "timeline" | "gitGraph" | "journey" | "block";
/** Mermaid の 1 行目の最初の単語から図の種類を決める */
export declare const mapKindOf: (mermaid: string) => MapKindName | undefined;
/** 範囲の外の map の図にする mermaid のコードブロックの中身 */
export type PlainMapSource = {
    kind: MapKindName;
    body: string;
    frontMatter: string | undefined;
    title: string | undefined;
};
/** mermaid のコードブロックのソースから、範囲の外の map の図にする中身を返す。front matter の `config`・`%%{` の行を持つか、map が描けない種類なら `undefined` */
export declare const plainMapSourceOf: (source: string) => PlainMapSource | undefined;
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
