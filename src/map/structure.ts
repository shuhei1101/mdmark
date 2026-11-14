import { type MapProblem, parseMapArgs } from "./spec.ts";

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
export type MapKindName =
  | "flowchart"
  | "sequenceDiagram"
  | "erDiagram"
  | "stateDiagram";

/** Mermaid の 1 行目の最初の単語から図の種類を決める */
export const mapKindOf = (mermaid: string): MapKindName | undefined => {
  const first = mermaid.trimStart().split(/\s/, 1)[0] ?? "";
  if (first === "flowchart" || first === "graph") return "flowchart";
  if (first === "sequenceDiagram") return "sequenceDiagram";
  if (first === "erDiagram") return "erDiagram";
  if (first === "stateDiagram-v2" || first === "stateDiagram")
    return "stateDiagram";
  return undefined;
};

/** 範囲の mermaid のブロックと補足の数・図の種類・マーカーの引数だけを確かめる（Mermaid と補足の中身は読まない） */
export const collectMapStructure = (range: MapRangeSource) => {
  const parsedArgs = parseMapArgs(range.args);
  const problems: MapProblem[] = [...parsedArgs.problems];
  if (range.mermaidCount !== 1 || range.mermaid === undefined) {
    problems.unshift({
      kind: "map_invalid",
      message:
        range.mermaidCount === 0
          ? "map の範囲に mermaid のコードブロックがありません。範囲の中に mermaid のコードブロックを 1 つ配置してください。"
          : "map の範囲に mermaid のコードブロックが 2 つ以上あります。1 つの範囲には 1 つだけ配置してください。",
    });
    return { problems, kind: undefined, args: parsedArgs };
  }
  if (range.dataCount > 1) {
    problems.unshift({
      kind: "map_invalid",
      message:
        "map の範囲に補足が 2 つ以上あります。1 つの範囲には 1 つだけ配置してください。",
    });
    return { problems, kind: undefined, args: parsedArgs };
  }
  const kind = mapKindOf(range.mermaid);
  if (kind === undefined) {
    const first = range.mermaid.trimStart().split(/\s/, 1)[0] ?? "";
    problems.unshift({
      kind: "map_invalid",
      message: `この版の map で描ける図の種類は \`flowchart\`・\`sequenceDiagram\`・\`erDiagram\`・\`stateDiagram-v2\` です。\`${first}\` の図はコードブロックのまま表示しています。`,
    });
  }
  return { problems, kind, args: parsedArgs };
};
