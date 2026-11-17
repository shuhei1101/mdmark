import type { Flowchart, FlowEdge, FlowGroup, FlowNode } from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import { MAP_ARCH, type MapArchEdge, mapClosedGroupSize } from "./map.part.ts";
import type { MapKind, MapProblem } from "./spec.ts";

/** architecture-beta のアイコンの名前 */
export type ArchIcon = "cloud" | "database" | "disk" | "internet" | "server";

/** group */
export type ArchGroup = {
  id: string;
  icon: ArchIcon | undefined;
  title: string;
  parent: string | undefined;
};

/** service と junction */
export type ArchService = {
  id: string;
  icon: ArchIcon | undefined;
  label: string;
  parent: string | undefined;
  junction: boolean;
};

/** 線（`id` は記載順の `r{番号}`）。`head` は矢じりを付ける端 */
export type ArchEdge = MapArchEdge & {
  head: "none" | "end" | "start" | "both";
};

/** parseArchitecture の戻り値 */
export type ArchitectureDiagram = {
  groups: ArchGroup[];
  services: ArchService[];
  edges: ArchEdge[];
  problems: MapProblem[];
};

/** アイコンの名前ごとの Lucide のアイコンの名前 */
export const ARCH_LUCIDE_ICONS = {
  cloud: "cloud",
  database: "database",
  disk: "hard-drive",
  internet: "globe",
  server: "server",
} as const satisfies Record<ArchIcon, string>;

/** アーキテクチャ図のノードの種類（設定の map.kinds に重ねる。キーは設定と重ならない名前） */
export const MAP_ARCH_KINDS: Record<string, MapKind> = {
  "mdmark-arch-service": { shape: "rounded" },
  "mdmark-arch-junction": { shape: "rounded" },
  ...Object.fromEntries(
    Object.entries(ARCH_LUCIDE_ICONS).map(([name, icon]) => [
      `mdmark-arch-${name}`,
      { icon, shape: "rounded" as const },
    ]),
  ),
};

const ID = "[A-Za-z0-9_\\u0080-\\uffff-]+";
const SIDES = { L: "left", R: "right", T: "top", B: "bottom" } as const;
const ITEM_RE = new RegExp(
  `^(group|service)\\s+(${ID})(?:\\((\\w+)\\))?\\[([^\\]]*)\\](?:\\s+in\\s+(${ID}))?$`,
);
const JUNCTION_RE = new RegExp(`^junction\\s+(${ID})(?:\\s+in\\s+(${ID}))?$`);
const EDGE_RE = new RegExp(
  `^(${ID})(\\{group\\})?:([LRTB])\\s*(<?)--(>?)\\s*([LRTB]):(${ID})(\\{group\\})?$`,
);
/** 読んで捨てる行 */
const IGNORED_RE = /^(accTitle|accDescr|title)\b/;

/** 読めない行の項目 */
const invalid = (line: number, message: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message,
});

/** 読めない行の項目の文 */
const unreadableText = (line: number, raw: string): string =>
  `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の architecture-beta の記法（\`{ID}:R --> L:{ID}\` など）で記載してください。`;

/** 知らないアイコンの項目の文 */
const iconText = (line: number, icon: string): string =>
  `${line + 1} 行目のアイコン \`${icon}\` は描けません。\`cloud\`・\`database\`・\`disk\`・\`internet\`・\`server\` のどれかにしてください。`;

/** アイコンの名前（知らない名前は `undefined`） */
const iconOf = (name: string | undefined): ArchIcon | undefined =>
  name !== undefined && name in ARCH_LUCIDE_ICONS
    ? (name as ArchIcon)
    : undefined;

/** 矢じりを付ける端 */
const headOf = (tail: boolean, head: boolean): ArchEdge["head"] => {
  if (tail && head) return "both";
  if (head) return "end";
  return tail ? "start" : "none";
};

/** group・service の行を読む。読めた行なら `true` */
const readItem = (
  diagram: ArchitectureDiagram,
  context: { text: string; line: number },
): boolean => {
  const match = ITEM_RE.exec(context.text);
  if (!match?.[1] || !match[2]) return false;
  const icon = iconOf(match[3]);
  if (match[3] !== undefined && icon === undefined)
    diagram.problems.push(
      invalid(context.line, iconText(context.line, match[3])),
    );
  if (match[1] === "group")
    diagram.groups.push({
      id: match[2],
      icon,
      title: match[4] ?? match[2],
      parent: match[5],
    });
  else
    diagram.services.push({
      id: match[2],
      icon,
      label: match[4] ?? match[2],
      parent: match[5],
      junction: false,
    });
  return true;
};

/** 線の行を読む。読めた行なら `true` */
const readEdge = (diagram: ArchitectureDiagram, text: string): boolean => {
  const match = EDGE_RE.exec(text);
  if (!match?.[1] || !match[3] || !match[6] || !match[7]) return false;
  diagram.edges.push({
    id: `r${diagram.edges.length + 1}`,
    from: match[1],
    fromSide: SIDES[match[3] as keyof typeof SIDES],
    fromGroup: match[2] !== undefined,
    to: match[7],
    toSide: SIDES[match[6] as keyof typeof SIDES],
    toGroup: match[8] !== undefined,
    head: headOf(match[4] === "<", match[5] === ">"),
  });
  return true;
};

/** `in` が無い group を指す行の項目 */
const parentProblems = (
  diagram: ArchitectureDiagram,
  lines: Map<string, number>,
): MapProblem[] => {
  const groups = new Set(diagram.groups.map((group) => group.id));
  return [...diagram.groups, ...diagram.services].flatMap((item) => {
    if (item.parent === undefined || groups.has(item.parent)) return [];
    const line = lines.get(item.id) ?? 0;
    return [
      invalid(
        line,
        `${line + 1} 行目の \`in ${item.parent}\` が指す group がありません。group の ID を修正してください。`,
      ),
    ];
  });
};

/** `architecture-beta` の Mermaid を、group・service・junction・線と読めない行の項目に読む */
export const parseArchitecture = (source: string): ArchitectureDiagram => {
  const diagram: ArchitectureDiagram = {
    groups: [],
    services: [],
    edges: [],
    problems: [],
  };
  const lines = new Map<string, number>();
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "" || IGNORED_RE.test(text)) continue;
    const count = diagram.groups.length + diagram.services.length;
    const junction = JUNCTION_RE.exec(text);
    if (junction?.[1])
      diagram.services.push({
        id: junction[1],
        icon: undefined,
        label: "",
        parent: junction[2],
        junction: true,
      });
    else if (!readItem(diagram, { text, line }) && !readEdge(diagram, text))
      diagram.problems.push(invalid(line, unreadableText(line, raw)));
    const added = [...diagram.groups, ...diagram.services].slice(count);
    for (const item of added) lines.set(item.id, line);
  }
  diagram.problems.push(...parentProblems(diagram, lines));
  return diagram;
};

/** 左右の辺でつなぐ線か（右の辺を持つ側を元にする） */
const horizontal = (edge: ArchEdge): boolean =>
  (edge.fromSide === "left" || edge.fromSide === "right") &&
  (edge.toSide === "left" || edge.toSide === "right");

/** 上下の辺でつなぐ線か */
const vertical = (edge: ArchEdge): boolean =>
  (edge.fromSide === "top" || edge.fromSide === "bottom") &&
  (edge.toSide === "top" || edge.toSide === "bottom");

/** service と junction をノード、group をグループ、線を構成図の線にした左から右の構成図の入力と、段と並びの上書き */
export const architectureToFlowchart = (
  diagram: ArchitectureDiagram,
): { chart: Flowchart; overrides: Record<string, MapOverride> } => {
  const nodes: FlowNode[] = diagram.services.map((service) => ({
    id: service.id,
    label: service.label,
    shape: "round",
    classes: [
      service.junction
        ? "mdmark-arch-junction"
        : `mdmark-arch-${service.icon ?? "service"}`,
    ],
    parent: service.parent,
  }));
  const groups: FlowGroup[] = diagram.groups.map((group) => ({
    id: group.id,
    title: group.title,
    parent: group.parent,
    direction: undefined,
  }));
  // 閉じた group のノードは、アイコン・タイトル・「service {数} 件」が収まる大きさにする
  const overrides: Record<string, MapOverride> = Object.fromEntries(
    diagram.groups.map((group) => [
      group.id,
      { size: mapClosedGroupSize(`${group.title}　`) },
    ]),
  );
  for (const service of diagram.services)
    if (service.junction)
      overrides[service.id] = {
        size: { w: MAP_ARCH.junction, h: MAP_ARCH.junction },
      };
  let order = 0;
  const edges: FlowEdge[] = diagram.edges.map((edge) => {
    // 左右の辺でつなぐ 2 つは、右の辺を持つ側を左の段に置く
    const swap = horizontal(edge) && edge.fromSide === "left";
    if (vertical(edge)) {
      // 上下の辺でつなぐ 2 つは同じ段に並べ、下の辺を持つ側を上に置く
      const [upper, lower] =
        edge.fromSide === "bottom"
          ? [edge.from, edge.to]
          : [edge.to, edge.from];
      overrides[edge.id] = { rankless: true };
      overrides[upper] = {
        ...overrides[upper],
        order: overrides[upper]?.order ?? order++,
      };
      overrides[lower] = { ...overrides[lower], align: upper, order: order++ };
    }
    return {
      id: edge.id,
      from: swap ? edge.to : edge.from,
      to: swap ? edge.from : edge.to,
      arrow: "---",
      both: false,
      label: undefined,
    };
  });
  return {
    chart: {
      direction: "LR",
      nodes,
      groups,
      edges,
      links: {},
      linkLines: {},
      problems: diagram.problems,
    },
    overrides,
  };
};
