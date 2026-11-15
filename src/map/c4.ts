import type { Flowchart, FlowEdge, FlowGroup, FlowNode } from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import type { MapKind, MapProblem } from "./spec.ts";

/** 境界の種類 */
export type C4BoundaryKind = "enterprise" | "system" | "boundary";

/** 要素の種類 */
export type C4ElementKind = "person" | "system" | "system_db" | "system_queue";

/** 境界 */
export type C4Boundary = {
  id: string;
  label: string;
  kind: C4BoundaryKind;
  parent: string | undefined;
};

/** 要素 */
export type C4Element = {
  id: string;
  label: string;
  description: string | undefined;
  kind: C4ElementKind;
  external: boolean;
  parent: string | undefined;
};

/** 関係の向きの指定 */
export type C4Direction = "up" | "down" | "left" | "right";

/** 関係（`id` は記載順の `r{番号}`） */
export type C4Relation = {
  id: string;
  from: string;
  to: string;
  label: string | undefined;
  technology: string | undefined;
  both: boolean;
  direction: C4Direction | undefined;
};

/** parseC4Context の戻り値 */
export type C4Diagram = {
  title: string | undefined;
  boundaries: C4Boundary[];
  elements: C4Element[];
  relations: C4Relation[];
  problems: MapProblem[];
};

/** 要素の寸法（px）。高さは名前の行に説明の行の数を足して見積もる（描いた後に測り直す） */
export const MAP_C4 = {
  width: 220,
  head: 60,
  descriptionLine: 17,
  /** 説明の 1 行に入る文字の数の見積もり */
  descriptionChars: 16,
  foot: 8,
} as const;

/** 要素の大きさの見積もり */
const elementSize = (element: C4Element): { w: number; h: number } => {
  const lines = Math.ceil(
    (element.description?.length ?? 0) / MAP_C4.descriptionChars,
  );
  return {
    w: MAP_C4.width,
    h: MAP_C4.head + lines * MAP_C4.descriptionLine + MAP_C4.foot,
  };
};

/** 種類の行 */
const C4_LABELS = {
  person: "[Person]",
  system: "[Software System]",
} as const;

/** C4 図のノードの種類（設定の map.kinds に重ねる。キーは設定と重ならない名前） */
export const MAP_C4_KINDS = {
  "mdmark-c4-person": {
    label: C4_LABELS.person,
    icon: "user",
    shape: "rounded",
  },
  "mdmark-c4-person-ext": {
    label: "[External Person]",
    icon: "user",
    shape: "rounded",
    color: "gray",
  },
  "mdmark-c4-system": { label: C4_LABELS.system, shape: "rect" },
  "mdmark-c4-system-ext": {
    label: "[External Software System]",
    shape: "rect",
    color: "gray",
  },
  "mdmark-c4-system_db": {
    label: C4_LABELS.system,
    icon: "database",
    shape: "rect",
  },
  "mdmark-c4-system_db-ext": {
    label: "[External Software System]",
    icon: "database",
    shape: "rect",
    color: "gray",
  },
  "mdmark-c4-system_queue": { label: C4_LABELS.system, shape: "pill" },
  "mdmark-c4-system_queue-ext": {
    label: "[External Software System]",
    shape: "pill",
    color: "gray",
  },
} satisfies Record<string, MapKind>;

/** 境界の関数ごとの種類 */
const BOUNDARIES: Record<string, C4BoundaryKind> = {
  Enterprise_Boundary: "enterprise",
  System_Boundary: "system",
  Boundary: "boundary",
};

/** 要素の関数ごとの種類 */
const ELEMENTS: Record<string, C4ElementKind> = {
  Person: "person",
  System: "system",
  SystemDb: "system_db",
  SystemQueue: "system_queue",
};

/** 関係の関数の向きの名前ごとの向き */
const DIRECTIONS: Record<string, C4Direction> = {
  U: "up",
  Up: "up",
  D: "down",
  Down: "down",
  L: "left",
  Left: "left",
  R: "right",
  Right: "right",
};

const CALL_RE = /^(\w+)\((.*)\)\s*(\{)?$/;
const RELATION_RE = /^(Bi)?Rel(?:_(U|Up|D|Down|L|Left|R|Right|Back))?$/;
/** 読んで捨てる行 */
const IGNORED_RE =
  /^(accTitle|accDescr|UpdateLayoutConfig|UpdateElementStyle|UpdateRelStyle|UpdateBoundaryStyle|AddElementTag|AddRelTag)\b/;

/** 関数の引数の並び（`"…"` と識別子をカンマで分ける） */
const argumentsOf = (text: string): string[] =>
  [...text.matchAll(/"([^"]*)"|([^,\s][^,]*)/g)].map((match) =>
    (match[1] ?? match[2] ?? "").trim(),
  );

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の C4Context の記法（\`Person(…)\`・\`System(…)\`・\`Rel(…)\` など）で記載してください。`,
});

/** 読み取りの途中の状態 */
type C4Reading = {
  diagram: C4Diagram;
  stack: Array<{ boundary: C4Boundary; line: number }>;
};

/** 関数の行 1 つ */
type C4Call = { name: string; values: string[]; open: boolean; line: number };

/** 境界の関数なら境界を足し、`{` で開いていれば境界の中に入る。読めた行なら `true` */
const readBoundary = (reading: C4Reading, call: C4Call): boolean => {
  const kind = BOUNDARIES[call.name];
  const [id, label] = call.values;
  if (kind === undefined || id === undefined) return false;
  const boundary = {
    id,
    label: label ?? id,
    kind,
    parent: reading.stack.at(-1)?.boundary.id,
  };
  reading.diagram.boundaries.push(boundary);
  if (call.open) reading.stack.push({ boundary, line: call.line });
  return true;
};

/** 要素の関数なら要素を足す。読めた行なら `true` */
const readElement = (reading: C4Reading, call: C4Call): boolean => {
  const external = call.name.endsWith("_Ext");
  const kind = ELEMENTS[external ? call.name.slice(0, -4) : call.name];
  const [id, label, description] = call.values;
  if (kind === undefined || id === undefined) return false;
  reading.diagram.elements.push({
    id,
    label: label ?? id,
    description,
    kind,
    external,
    parent: reading.stack.at(-1)?.boundary.id,
  });
  return true;
};

/** 関係の関数なら関係を足す。読めた行なら `true` */
const readRelation = (reading: C4Reading, call: C4Call): boolean => {
  const relation = RELATION_RE.exec(call.name);
  const [from, to, label, technology] = call.values;
  if (!relation || from === undefined || to === undefined) return false;
  const { relations } = reading.diagram;
  relations.push({
    id: `r${relations.length + 1}`,
    from,
    to,
    label,
    technology,
    both: relation[1] !== undefined,
    direction: relation[2] === undefined ? undefined : DIRECTIONS[relation[2]],
  });
  return true;
};

/** 関数の行 1 つを読む。読めた行なら `true` */
const readCall = (reading: C4Reading, call: C4Call): boolean =>
  readBoundary(reading, call) ||
  readElement(reading, call) ||
  readRelation(reading, call);

/** 行 1 つを読む。読めた行なら `true` */
const readLine = (reading: C4Reading, text: string, line: number): boolean => {
  if (text === "}") return reading.stack.pop() !== undefined;
  const heading = /^title\s+(.+)$/.exec(text);
  if (heading?.[1]) {
    reading.diagram.title = heading[1].trim();
    return true;
  }
  const call = CALL_RE.exec(text);
  if (!call?.[1]) return false;
  return readCall(reading, {
    name: call[1],
    values: argumentsOf(call[2] ?? ""),
    open: call[3] !== undefined,
    line,
  });
};

/** `C4Context` の Mermaid を、タイトル・境界・要素・関係と読めない行の項目に読む */
export const parseC4Context = (source: string): C4Diagram => {
  const reading: C4Reading = {
    diagram: {
      title: undefined,
      boundaries: [],
      elements: [],
      relations: [],
      problems: [],
    },
    stack: [],
  };
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "" || IGNORED_RE.test(text)) continue;
    if (!readLine(reading, text, line))
      reading.diagram.problems.push(unreadable(line, raw));
  }
  for (const open of reading.stack)
    reading.diagram.problems.push({
      kind: "map_invalid",
      line: open.line,
      message: `境界 \`${open.boundary.id}\` の \`{\` に対応する \`}\` がありません。境界の最後の行の後に \`}\` を記載してください。`,
    });
  return reading.diagram;
};

/** 要素をノード、境界をグループ、関係を線にした上から下の構成図の入力と、段と並びの上書き */
export const c4ToFlowchart = (
  diagram: C4Diagram,
): { chart: Flowchart; overrides: Record<string, MapOverride> } => {
  const nodes: FlowNode[] = diagram.elements.map((element) => ({
    id: element.id,
    label: element.label,
    shape: "rect",
    classes: [`mdmark-c4-${element.kind}${element.external ? "-ext" : ""}`],
    parent: element.parent,
  }));
  const groups: FlowGroup[] = diagram.boundaries.map((boundary) => ({
    id: boundary.id,
    title: boundary.label,
    parent: boundary.parent,
    direction: "TB",
  }));
  const overrides: Record<string, MapOverride> = Object.fromEntries(
    diagram.elements.map((element) => [
      element.id,
      { size: elementSize(element) },
    ]),
  );
  let order = 0;
  const edges: FlowEdge[] = diagram.relations.map((relation) => {
    const sideways =
      relation.direction === "left" || relation.direction === "right";
    if (sideways) {
      // 左右の向きの関係は同じ段に並べ、`Rel_R` は先を元の右、`Rel_L` は左に置く
      const [first, second] =
        relation.direction === "right"
          ? [relation.from, relation.to]
          : [relation.to, relation.from];
      overrides[relation.id] = { rankless: true };
      overrides[first] = {
        ...overrides[first],
        order: overrides[first]?.order ?? order++,
      };
      overrides[second] = {
        ...overrides[second],
        align: first,
        order: order++,
      };
    }
    const label = [
      relation.label,
      relation.technology === undefined
        ? undefined
        : `[${relation.technology}]`,
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" ");
    const up = relation.direction === "up";
    return {
      id: relation.id,
      from: up ? relation.to : relation.from,
      to: up ? relation.from : relation.to,
      arrow: "-->",
      both: relation.both,
      label: label === "" ? undefined : label,
    };
  });
  return {
    chart: {
      direction: "TB",
      nodes,
      groups,
      edges,
      links: {},
      problems: diagram.problems,
    },
    overrides,
  };
};
