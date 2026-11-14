import { parseDefinitionJson } from "../diagram/definition.ts";
import { findDiagramBlocks } from "../render/syntax/diagrams.ts";
import type { MapKind, MapLine } from "./spec.ts";

/** 廃止したフロー図の定義（変換が参照する項目だけ） */
export type RetiredFlowDefinition = {
  title?: string | undefined;
  scope?: string | undefined;
  updated?: string | undefined;
  frame?: { title: string; hint?: string } | undefined;
  lanes?: Array<{ label: string; y: number; h: number; hint?: string }>;
  nodes: Array<{
    id: string;
    kind: string;
    y?: number;
    name: string;
    tag?: string;
    sub?: string;
    io?: { in: string; do: string; out: string };
    hint?: string;
    href?: string;
  }>;
  wires: Array<{
    from: string;
    to: string;
    line: string;
    label?: string;
    tip?: string;
  }>;
  stickyTitles?: boolean | undefined;
};

/** 廃止したシーケンス図の定義（変換が参照する項目だけ） */
export type RetiredSequenceDefinition = {
  title?: string | undefined;
  scope?: string | undefined;
  updated?: string | undefined;
  participants: Array<{ id: string; name: string }>;
  steps: Array<{
    from: string;
    to: string;
    label: string;
    reply?: boolean;
    tip?: string;
  }>;
  loop?: { label: string } | undefined;
};

/** 変換の報告の行 */
export type ConvertReportLine = {
  /** 範囲の開きのマーカーの行（1 から） */
  line: number;
  /** マーカーの名前 */
  name: "flow" | "sequence";
  /** 写さない値・書き換えない範囲 */
  item: string;
  /** 理由 */
  reason: string;
};

/** 変換した結果 */
export type ConvertResult = {
  /** 書き換えた本文（書き換える範囲が無ければ元のまま） */
  markdown: string;
  /** 写さない値と書き換えない範囲（行の順） */
  report: ConvertReportLine[];
  /** 文書が使用していたノードの種類 */
  kinds: Record<string, MapKind>;
  /** 文書が使用していた `flow` 以外の線の種類 */
  lines: Record<string, MapLine>;
};

/** 廃止した図のノードの種類ごとに、設定の `map.kinds` へ書き足す値と、Mermaid に記載するノードの形 */
export const RETIRED_KIND_STYLES = {
  llm: {
    label: "LLM",
    icon: "bot",
    shape: "rounded",
    color: "purple",
    mermaid: "[]",
  },
  dm: {
    label: "意思決定モデル",
    icon: "split",
    shape: "rounded",
    color: "orange",
    mermaid: "[]",
  },
  script: {
    label: "スクリプト",
    icon: "code-xml",
    shape: "rect",
    color: "blue",
    mermaid: "[]",
  },
  mcp: {
    label: "MCP",
    icon: "plug",
    shape: "rounded",
    color: "green",
    mermaid: "[]",
  },
  data: {
    label: "データ",
    icon: "database",
    shape: "double",
    color: "yellow",
    mermaid: "[()]",
  },
  external: {
    label: "外部",
    icon: "globe",
    shape: "rounded",
    color: "gray",
    mermaid: "[]",
  },
  start: {
    label: "開始",
    icon: "play",
    shape: "pill",
    color: "green",
    mermaid: "([])",
  },
  question: {
    label: "質問",
    icon: "circle-question-mark",
    shape: "double",
    color: "orange",
    mermaid: "{}",
  },
  action: {
    label: "アクション",
    icon: "wrench",
    shape: "rect",
    color: "blue",
    mermaid: "[]",
  },
  result: {
    label: "結果",
    icon: "flag",
    shape: "pill",
    color: "purple",
    mermaid: "([])",
  },
} as const satisfies Record<string, MapKind & { mermaid: string }>;

/** `flow` 以外の線の種類ごとに、設定の `map.lines` へ書き足す値 */
export const RETIRED_LINE_STYLES = {
  read: { dash: "dashed", width: "normal", head: "open" },
  write: { dash: "solid", width: "thick", head: "filled" },
  reply: { dash: "dotted", width: "normal", head: "open" },
  loop: { dash: "long-dash", width: "normal", head: "open" },
} as const satisfies Record<string, MapLine>;

/** 元の `id` をそのまま Mermaid の ID にできる形 */
export const SAFE_ID = /^[A-Za-z0-9_\u0080-￿]+$/;

/** ID にできない Mermaid の予約語（大文字と小文字を区別しない） */
export const MERMAID_RESERVED: ReadonlySet<string> = new Set([
  "end",
  "subgraph",
  "direction",
  "click",
  "class",
  "classdef",
  "style",
  "linkstyle",
  "graph",
  "flowchart",
  "participant",
  "actor",
  "loop",
  "alt",
  "else",
  "opt",
  "par",
  "and",
  "critical",
  "option",
  "break",
  "rect",
  "note",
  "activate",
  "deactivate",
  "autonumber",
  "link",
  "links",
  "box",
  "create",
  "destroy",
]);

/** 廃止した図の種類の名前 */
const DIRECTIVE_NAMES = { flow: "フロー図", sequence: "シーケンス図" };

/** 写す先の無い値の理由 */
const NO_TARGET_REASON =
  "map の範囲に写す先がありません。必要なら本文に記載してください";

/** 置き換えた ID の理由 */
const ID_REASON =
  "map の ID として読めない文字を含むか Mermaid の予約語のため、置き換えました";

/** flowchart のラベルで文字の参照にする記号 */
const FLOW_SYMBOLS = /[#"[\](){}|<>;]/g;

/** sequenceDiagram の名前とラベルで文字の参照にする記号 */
const SEQUENCE_SYMBOLS = /[#;]/g;

/** 記号を `decodeEntities` が戻す文字の参照にする（`"` は `#quot;`、ほかは `#{10 進の番号};`） */
const entity = (char: string): string =>
  char === '"' ? "#quot;" : `#${char.codePointAt(0)};`;

/** 用語の印の `{{単語}}` を `単語` にする（map は用語を本文と同じく照合する） */
const unwrapTerms = (text: string): string =>
  text.replace(/\{\{(.+?)\}\}/g, "$1");

/** flowchart のノードの名前・線のラベル・グループのタイトルの文字（改行は `<br>`） */
const flowText = (text: string): string =>
  unwrapTerms(text).replace(FLOW_SYMBOLS, entity).replaceAll("\n", "<br>");

/** sequenceDiagram の名前・メッセージ・繰り返しのラベルの文字 */
const sequenceText = (text: string): string =>
  text.replace(SEQUENCE_SYMBOLS, entity).replaceAll("\n", " ");

/** 1 行の JSON にする（`": "`・`", "` で区切る）。HTML のコメントを閉じないよう `--` を `--` にする */
const inlineJson = (value: unknown): string => {
  const serialize = (item: unknown): string => {
    if (Array.isArray(item)) {
      return `[${item.map(serialize).join(", ")}]`;
    }
    if (typeof item === "object" && item !== null) {
      return `{${Object.entries(item)
        .map(([key, child]) => `${JSON.stringify(key)}: ${serialize(child)}`)
        .join(", ")}}`;
    }
    return JSON.stringify(item);
  };
  return serialize(value).replaceAll("--", "-\\u002d");
};

/** 値がオブジェクト（配列を除く）か */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 値の並びの要素ごとに、文字の項目が揃っているかを確かめ、無ければ読めない理由を返却する */
const missingText = (
  items: unknown,
  path: string,
  keys: string[],
): string | undefined => {
  if (!Array.isArray(items)) {
    return `${path} が配列ではありません`;
  }
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) {
      return `${path}[${index}] がオブジェクトではありません`;
    }
    for (const key of keys) {
      if (typeof item[key] !== "string") {
        return `${path}[${index}].${key} が文字ではありません`;
      }
    }
  }
  return undefined;
};

/** 線・メッセージの端が、ノード・相手の `id` を指しているかを確かめる */
const missingEnd = (
  links: Array<{ from: string; to: string; id?: unknown }>,
  target: { ids: Set<string>; noun: string; owner: string },
): string | undefined => {
  const { ids, noun, owner } = target;
  for (const [index, link] of links.entries()) {
    const end = [link.from, link.to].find((item) => !ids.has(item));
    if (end === undefined) continue;
    const name = typeof link.id === "string" ? link.id : `${index + 1} 番目`;
    return `${owner} ${name} の端の${noun} ${end} がありません。${noun}の id で記載してください`;
  }
  return undefined;
};

/** 廃止した図の定義を読んだ結果 */
type RetiredRead =
  | {
      ok: true;
      definition: RetiredFlowDefinition | RetiredSequenceDefinition;
    }
  | { ok: false; reason: string };

/** フロー図の定義の誤り（無ければ `undefined`） */
const flowProblem = (source: Record<string, unknown>): string | undefined => {
  const problem =
    missingText(source.nodes, "nodes", ["id", "kind", "name"]) ??
    missingText(source.wires, "wires", ["from", "to", "line"]);
  if (problem !== undefined) return problem;
  const definition = source as RetiredFlowDefinition;
  const node = definition.nodes.find(
    (item) => !Object.hasOwn(RETIRED_KIND_STYLES, item.kind),
  );
  if (node)
    return `ノード「${node.name}」の種類 ${node.kind} は使用できません。使用できる種類は ${Object.keys(RETIRED_KIND_STYLES).join("・")} です`;
  const wire = definition.wires.find(
    (item) =>
      item.line !== "flow" && !Object.hasOwn(RETIRED_LINE_STYLES, item.line),
  );
  if (wire)
    return `線の種類 ${wire.line} は使用できません。使用できる種類は flow・${Object.keys(RETIRED_LINE_STYLES).join("・")} です`;
  return missingEnd(definition.wires, {
    ids: new Set(definition.nodes.map((item) => item.id)),
    noun: "ノード",
    owner: "線",
  });
};

/** シーケンス図の定義の誤り（無ければ `undefined`） */
const sequenceProblem = (
  source: Record<string, unknown>,
): string | undefined => {
  const problem =
    missingText(source.participants, "participants", ["id", "name"]) ??
    missingText(source.steps, "steps", ["from", "to", "label"]);
  if (problem !== undefined) return problem;
  const definition = source as RetiredSequenceDefinition;
  return missingEnd(definition.steps, {
    ids: new Set(definition.participants.map((participant) => participant.id)),
    noun: "相手",
    owner: "メッセージ",
  });
};

/** JSON として読めない定義の理由 */
const unparsedReason = (
  name: string,
  parsed: { line: number; after: string; missing: string },
): string => {
  const where = `${parsed.line} 行目の ${parsed.after} の後`;
  return parsed.missing === ""
    ? `${name}の部品の定義を JSON として読み込めません（${where}が読み込めません）`
    : `${name}の部品の定義を JSON として読み込めません（${where}に ${parsed.missing} がありません）`;
};

/** 範囲の `json` のコードブロックを読み、廃止した図の定義の必須の項目と線の端の `id` を確かめる */
export const readRetiredDefinition = (
  directive: "flow" | "sequence",
  blocks: string[],
): RetiredRead => {
  const name = DIRECTIVE_NAMES[directive];
  const [block] = blocks;
  if (blocks.length !== 1 || block === undefined) {
    return {
      ok: false,
      reason: `${name}の部品の定義を読み込めません。マーカーの範囲に json のコードブロックを 1 つだけ配置してください`,
    };
  }
  const parsed = parseDefinitionJson(block);
  if (!parsed.ok) return { ok: false, reason: unparsedReason(name, parsed) };
  const source = parsed.value;
  const problem = !isRecord(source)
    ? "定義がオブジェクトではありません"
    : directive === "flow"
      ? flowProblem(source)
      : sequenceProblem(source);
  if (problem !== undefined)
    return {
      ok: false,
      reason: `${name}の部品の定義を読み込めません。${problem}`,
    };
  return {
    ok: true,
    definition: source as RetiredFlowDefinition | RetiredSequenceDefinition,
  };
};

/** map で読めない ID と予約語の ID を、ほかの ID と重ならない `{頭}{番号}` に置き換える対応を作る */
const replaceIds = (
  ids: string[],
  prefix: string,
): { map: Map<string, string>; dropped: string[] } => {
  const taken = new Set(ids);
  const map = new Map<string, string>();
  const dropped: string[] = [];
  let counter = 1;
  for (const id of ids) {
    if (map.has(id)) {
      continue;
    }
    if (SAFE_ID.test(id) && !MERMAID_RESERVED.has(id.toLowerCase())) {
      map.set(id, id);
      continue;
    }
    while (taken.has(`${prefix}${counter}`)) {
      counter += 1;
    }
    const replaced = `${prefix}${counter}`;
    taken.add(replaced);
    map.set(id, replaced);
    dropped.push(`id ${id} → ${replaced}`);
  }
  return { map, dropped };
};

/** 題の行の範囲・更新日（と記載した `stickyTitles`）の写さない値の項目 */
const headDropped = (definition: {
  scope?: string | undefined;
  updated?: string | undefined;
  stickyTitles?: boolean | undefined;
}): string[] => [
  ...(definition.scope === undefined ? [] : [`scope: ${definition.scope}`]),
  ...(definition.updated === undefined
    ? []
    : [`updated: ${definition.updated}`]),
  ...(definition.stickyTitles === undefined
    ? []
    : [`stickyTitles: ${definition.stickyTitles}`]),
];

/** map の範囲の行（マーカー・mermaid のブロック・補足） */
const mapRangeLines = (
  title: string | undefined,
  mermaid: string[],
  data: Record<string, unknown>,
): string[] => [
  title === undefined
    ? "<!-- map -->"
    : `<!-- map: ${inlineJson({ title })} -->`,
  "",
  "```mermaid",
  ...mermaid,
  "```",
  "",
  `<!-- map-data: ${inlineJson({ version: 1, ...data })} -->`,
  "",
  "<!-- /map -->",
];

/** フロー図のノード */
type RetiredNode = RetiredFlowDefinition["nodes"][number];

/** フロー図のレーン（グループの ID を付けたもの） */
type RetiredLane = NonNullable<RetiredFlowDefinition["lanes"]>[number] & {
  id: string;
};

/** フロー図を写すときに繰り返し引く値 */
type FlowContext = {
  definition: RetiredFlowDefinition;
  /** 元の ID から map の ID */
  idOf: (id: string) => string;
  /** 説明を補足の notes に足す（空なら足さない） */
  note: (id: string, text: string | undefined) => void;
  /** 写したノードの種類 */
  kinds: string[];
  /** 枠のグループの ID */
  frameId: string | undefined;
  lanes: RetiredLane[];
};

/** ノードの mermaid の行（種類を `kinds` に足す） */
const flowNodeLine = (context: FlowContext, node: RetiredNode): string => {
  const style =
    RETIRED_KIND_STYLES[node.kind as keyof typeof RETIRED_KIND_STYLES];
  if (!context.kinds.includes(node.kind)) context.kinds.push(node.kind);
  const half = style.mermaid.length / 2;
  const label =
    node.tag === undefined
      ? flowText(node.name)
      : `${flowText(node.tag)}<br>${flowText(node.name)}`;
  return `${context.idOf(node.id)}${style.mermaid.slice(0, half)}${label}${style.mermaid.slice(half)}:::${node.kind}`;
};

/** ノードが入るレーン */
const flowLaneOf = (
  lanes: RetiredLane[],
  node: RetiredNode,
): RetiredLane | undefined => {
  const { y } = node;
  if (y === undefined) return undefined;
  return lanes.find((lane) => y >= lane.y && y < lane.y + lane.h);
};

/** 行の頭の字下げ */
const pad = (level: number) => "  ".repeat(level);

/** 枠・レーンのグループと、ノードの mermaid の行 */
const flowNodeLines = (context: FlowContext): string[] => {
  const { definition, frameId, lanes } = context;
  const outside = definition.nodes.filter(
    (node) => definition.frame !== undefined && node.kind === "external",
  );
  const inside = definition.nodes.filter((node) => !outside.includes(node));
  const depth = definition.frame ? 2 : 1;
  const out: string[] = [];
  if (definition.frame && frameId) {
    out.push(
      `${pad(1)}subgraph ${frameId}["${flowText(definition.frame.title)}"]`,
    );
  }
  for (const lane of lanes) {
    out.push(`${pad(depth)}subgraph ${lane.id}["${flowText(lane.label)}"]`);
    for (const node of inside.filter(
      (item) => flowLaneOf(lanes, item) === lane,
    )) {
      out.push(`${pad(depth + 1)}${flowNodeLine(context, node)}`);
    }
    out.push(`${pad(depth)}end`);
  }
  for (const node of inside.filter(
    (item) => flowLaneOf(lanes, item) === undefined,
  )) {
    out.push(`${pad(depth)}${flowNodeLine(context, node)}`);
  }
  if (definition.frame) out.push(`${pad(1)}end`);
  for (const node of outside)
    out.push(`${pad(1)}${flowNodeLine(context, node)}`);
  return out;
};

/** ノードの補足の説明（下の行・入出力・説明） */
const flowNodeNote = (node: RetiredNode): string | undefined => {
  const io = node.io
    ? `入力: ${node.io.in}\n処理: ${node.io.do}\n出力: ${node.io.out}`
    : undefined;
  const text = [node.sub, io, node.hint].filter(
    (item): item is string => item !== undefined && item !== "",
  );
  return text.length === 0 ? undefined : text.join("\n");
};

/** 線の mermaid の行と、線の種類を上書きする layout・使った線の種類 */
const flowWireLines = (
  context: FlowContext,
): {
  lines: string[];
  layout: Record<string, { line: string }>;
  lineKinds: string[];
} => {
  const { definition, idOf, note } = context;
  const lines: string[] = [];
  const layout: Record<string, { line: string }> = {};
  const lineKinds: string[] = [];
  const edgeCounts = new Map<string, number>();
  for (const wire of definition.wires) {
    const from = idOf(wire.from);
    const to = idOf(wire.to);
    const base = `${from}->${to}`;
    const count = (edgeCounts.get(base) ?? 0) + 1;
    edgeCounts.set(base, count);
    const edgeId = count === 1 ? base : `${base}#${count}`;
    lines.push(
      wire.label === undefined || wire.label === ""
        ? `${pad(1)}${from} --> ${to}`
        : `${pad(1)}${from} -->|${flowText(wire.label)}| ${to}`,
    );
    if (wire.line !== "flow") {
      layout[edgeId] = { line: wire.line };
      if (!lineKinds.includes(wire.line)) lineKinds.push(wire.line);
    }
    note(edgeId, wire.tip);
  }
  return { lines, layout, lineKinds };
};

/** 枠とレーンのグループの ID を、ノードの ID と重ならないように付ける */
const flowGroupsOf = (
  definition: RetiredFlowDefinition,
  context: { nodeIds: Set<string>; note: FlowContext["note"] },
): { frameId: string | undefined; lanes: RetiredLane[] } => {
  const { nodeIds, note } = context;
  const groupId = (base: string): string => {
    let id = base;
    while (nodeIds.has(id)) id += "_";
    nodeIds.add(id);
    return id;
  };
  const frameId = definition.frame ? groupId("frame") : undefined;
  if (definition.frame && frameId) note(frameId, definition.frame.hint);
  const lanes = (definition.lanes ?? []).map((lane, index) => {
    const id = groupId(`lane${index + 1}`);
    note(id, lane.hint);
    return { ...lane, id };
  });
  return { frameId, lanes };
};

/** フロー図を map の範囲の行にする */
export const flowToMap = (
  definition: RetiredFlowDefinition,
): {
  lines: string[];
  kinds: string[];
  lineKinds: string[];
  dropped: string[];
} => {
  const replaced = replaceIds(
    definition.nodes.map((node) => node.id),
    "n",
  );
  const idOf = (id: string): string => replaced.map.get(id) ?? id;
  const notes: Record<string, { text: string }> = {};
  const note = (id: string, text: string | undefined) => {
    if (text !== undefined && text !== "") notes[id] = { text };
  };
  const groups = flowGroupsOf(definition, {
    nodeIds: new Set(replaced.map.values()),
    note,
  });
  const context: FlowContext = {
    definition,
    idOf,
    note,
    kinds: [],
    ...groups,
  };
  const mermaid = ["flowchart TB", ...flowNodeLines(context)];
  for (const node of definition.nodes) note(idOf(node.id), flowNodeNote(node));
  const wires = flowWireLines(context);
  mermaid.push(...wires.lines);
  for (const node of definition.nodes) {
    if (node.href !== undefined)
      mermaid.push(`${pad(1)}click ${idOf(node.id)} "${node.href}"`);
  }
  const data: Record<string, unknown> = {};
  if (Object.keys(notes).length > 0) data.notes = notes;
  if (Object.keys(wires.layout).length > 0) data.layout = wires.layout;
  return {
    lines: mapRangeLines(definition.title, mermaid, data),
    kinds: context.kinds,
    lineKinds: wires.lineKinds,
    dropped: [...headDropped(definition), ...replaced.dropped],
  };
};

/** シーケンス図を map の範囲の行にする */
export const sequenceToMap = (
  definition: RetiredSequenceDefinition,
): { lines: string[]; dropped: string[] } => {
  const replaced = replaceIds(
    definition.participants.map((participant) => participant.id),
    "p",
  );
  const idOf = (id: string): string => replaced.map.get(id) ?? id;
  const mermaid = ["sequenceDiagram"];
  for (const participant of definition.participants) {
    mermaid.push(
      `  participant ${idOf(participant.id)} as ${sequenceText(participant.name)}`,
    );
  }
  const indent = definition.loop ? "    " : "  ";
  if (definition.loop) {
    mermaid.push(`  loop ${sequenceText(definition.loop.label)}`);
  }
  const notes: Record<string, { text: string }> = {};
  definition.steps.forEach((step, index) => {
    const arrow = step.reply ? "-->>" : "->>";
    mermaid.push(
      `${indent}${idOf(step.from)}${arrow}${idOf(step.to)}: ${sequenceText(step.label)}`,
    );
    if (step.tip !== undefined && step.tip !== "") {
      notes[String(index + 1)] = { text: step.tip };
    }
  });
  if (definition.loop) {
    mermaid.push("  end");
  }
  return {
    lines: mapRangeLines(
      definition.title,
      mermaid,
      Object.keys(notes).length > 0 ? { notes } : {},
    ),
    dropped: [...headDropped(definition), ...replaced.dropped],
  };
};

/** 写さない値の項目の理由 */
const reasonOf = (item: string): string =>
  item.startsWith("id ") ? ID_REASON : NO_TARGET_REASON;

/** フロー図を map の範囲の行にし、使ったノードと線の種類を設定に足す */
const convertFlow = (
  definition: RetiredFlowDefinition,
  styles: {
    kinds: Record<string, MapKind>;
    lineStyles: Record<string, MapLine>;
  },
): { lines: string[]; dropped: string[] } => {
  const flow = flowToMap(definition);
  for (const kind of flow.kinds) {
    const { mermaid: _mermaid, ...style } =
      RETIRED_KIND_STYLES[kind as keyof typeof RETIRED_KIND_STYLES];
    styles.kinds[kind] = { ...style };
  }
  for (const kind of flow.lineKinds) {
    styles.lineStyles[kind] = {
      ...RETIRED_LINE_STYLES[kind as keyof typeof RETIRED_LINE_STYLES],
    };
  }
  return flow;
};

/** 書き換える廃止した範囲の名前（`flow`・`sequence` のほかと、`skip` の名前は `undefined`） */
const retiredNameOf = (
  directive: string,
  skip: Set<string>,
): "flow" | "sequence" | undefined =>
  (directive === "flow" || directive === "sequence") && !skip.has(directive)
    ? directive
    : undefined;

/** 本文の廃止した `flow`・`sequence` の範囲（コードブロックと行内のコードの中と、`skip` の名前の範囲を除く）を、map の範囲に書き換える。読めない範囲は書き換えず、報告に挙げる */
export const convertRetiredDiagrams = (options: {
  markdown: string;
  skip: Set<string>;
}): ConvertResult => {
  const { markdown, skip } = options;
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(eol);
  const report: ConvertReportLine[] = [];
  const kinds: Record<string, MapKind> = {};
  const lineStyles: Record<string, MapLine> = {};
  const replacements: Array<{ start: number; end: number; lines: string[] }> =
    [];
  for (const found of findDiagramBlocks(markdown)) {
    const name = retiredNameOf(found.directive, skip);
    if (name === undefined) continue;
    const read = readRetiredDefinition(name, found.blocks);
    if (!read.ok) {
      report.push({
        line: found.line,
        name,
        item: "範囲",
        reason: read.reason,
      });
      continue;
    }
    const converted =
      name === "flow"
        ? convertFlow(read.definition as RetiredFlowDefinition, {
            kinds,
            lineStyles,
          })
        : sequenceToMap(read.definition as RetiredSequenceDefinition);
    for (const item of converted.dropped) {
      report.push({ line: found.line, name, item, reason: reasonOf(item) });
    }
    replacements.push({
      start: found.line - 1,
      end: found.end - 1,
      lines: converted.lines,
    });
  }
  // 後ろの範囲から置き換えて、前の範囲の行の番号をずらさない
  for (const { start, end, lines: replacement } of replacements.reverse()) {
    lines.splice(start, end - start + 1, ...replacement);
  }
  return {
    markdown: replacements.length === 0 ? markdown : lines.join(eol),
    report,
    kinds,
    lines: lineStyles,
  };
};
