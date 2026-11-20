import { splitMermaidTitle } from "../mermaid-source.ts";
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
  | "stateDiagram"
  | "classDiagram"
  | "architecture"
  | "C4Context"
  | "C4Container"
  | "C4Component"
  | "C4Dynamic"
  | "C4Deployment"
  | "mindmap"
  | "gantt"
  | "timeline"
  | "gitGraph"
  | "journey"
  | "block";

/** Mermaid の 1 行目の最初の単語ごとの、描く図の種類 */
const KIND_OF_FIRST_WORD: Record<string, MapKindName> = {
  flowchart: "flowchart",
  graph: "flowchart",
  sequenceDiagram: "sequenceDiagram",
  erDiagram: "erDiagram",
  "stateDiagram-v2": "stateDiagram",
  stateDiagram: "stateDiagram",
  classDiagram: "classDiagram",
  "classDiagram-v2": "classDiagram",
  "architecture-beta": "architecture",
  C4Context: "C4Context",
  C4Container: "C4Container",
  C4Component: "C4Component",
  C4Dynamic: "C4Dynamic",
  C4Deployment: "C4Deployment",
  mindmap: "mindmap",
  gantt: "gantt",
  timeline: "timeline",
  gitGraph: "gitGraph",
  journey: "journey",
  "block-beta": "block",
  block: "block",
};

/** ソースの先頭の front matter（`---` で囲んだ行） */
const FRONT_MATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Mermaid の front matter と `%%` で始まる行を飛ばした最初の単語から図の種類を決める */
export const mapKindOf = (mermaid: string): MapKindName | undefined => {
  const body = mermaid.replace(FRONT_MATTER_RE, "");
  const line =
    body
      .split(/\r?\n/)
      .map((text) => text.trim())
      .find((text) => text !== "" && !text.startsWith("%%")) ?? "";
  const first = line.split(/\s/, 1)[0] ?? "";
  return Object.hasOwn(KIND_OF_FIRST_WORD, first)
    ? KIND_OF_FIRST_WORD[first]
    : undefined;
};

/** 範囲の外の map の図にする mermaid のコードブロックの中身 */
export type PlainMapSource = {
  kind: MapKindName;
  body: string;
  frontMatter: string | undefined;
  title: string | undefined;
  /** Git グラフの最初のブランチの名前（`mermaidMainBranchOf`） */
  mainBranchName: string | undefined;
};

/** `%%{init: …}%%` の中の `"mainBranchName": "…"`（引用符は `"`・`'`） */
const INIT_MAIN_BRANCH_RE =
  /^%%\{\s*init\s*:[\s\S]*?["']mainBranchName["']\s*:\s*["']([^"']+)["']/m;

/** front matter の `mainBranchName: …` */
const FRONT_MAIN_BRANCH_RE =
  /^\s*mainBranchName\s*:\s*["']?([^"'\r\n]+?)["']?\s*$/m;

/** Mermaid のソースの front matter の `config.gitGraph.mainBranchName` と `%%{init}` の `gitGraph.mainBranchName` から、Git グラフの最初のブランチの名前を返却する。両方にあれば `%%{init}` を優先する */
export const mermaidMainBranchOf = (source: string): string | undefined => {
  const init = INIT_MAIN_BRANCH_RE.exec(source)?.[1];
  if (init !== undefined) return init;
  const front = FRONT_MATTER_RE.exec(source)?.[1];
  if (front === undefined || !/^\s*gitGraph\s*:/m.test(front)) return undefined;
  return FRONT_MAIN_BRANCH_RE.exec(front)?.[1];
};

/** mermaid のコードブロックのソースから、範囲の外の map の図にする中身を返す。front matter と `%%{` で始まる設定の行は図に適用せず、map が描けない種類なら `undefined` */
export const plainMapSourceOf = (
  source: string,
): PlainMapSource | undefined => {
  const front = FRONT_MATTER_RE.exec(source);
  const rest = front ? source.slice(front[0].length) : source;
  const body = rest
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("%%{"))
    .join("\n");
  const kind = mapKindOf(body);
  if (kind === undefined) return undefined;
  return {
    kind,
    body: body.replace(/^(?:[ \t]*\r?\n)+/, ""),
    frontMatter: front ? front[0].replace(/\r?\n$/, "") : undefined,
    title: splitMermaidTitle(source).title,
    mainBranchName: mermaidMainBranchOf(source),
  };
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
      message: `この版の map で描ける図の種類は \`flowchart\`・\`sequenceDiagram\`・\`erDiagram\`・\`stateDiagram-v2\`・\`classDiagram\`・\`architecture-beta\`・\`C4Context\`・\`C4Container\`・\`C4Component\`・\`C4Dynamic\`・\`C4Deployment\`・\`mindmap\`・\`gantt\`・\`timeline\`・\`gitGraph\`・\`journey\`・\`block-beta\` です。\`${first}\` の図はコードブロックのまま表示しています。`,
    });
  }
  return { problems, kind, args: parsedArgs };
};
