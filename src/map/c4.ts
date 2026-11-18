import type { Flowchart, FlowEdge, FlowGroup, FlowNode } from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import { mapC4BoundaryTitle, mapClosedGroupSize } from "./map.part.ts";
import type { MapKind, MapProblem } from "./spec.ts";

/** 境界の種類 */
export type C4BoundaryKind =
  | "enterprise"
  | "system"
  | "container"
  | "boundary"
  | "deployment";

/** 図の種類（Mermaid の 1 行目） */
export type C4DiagramKind =
  | "C4Context"
  | "C4Container"
  | "C4Component"
  | "C4Dynamic"
  | "C4Deployment";

/** 要素の種類 */
export type C4ElementKind =
  | "person"
  | "system"
  | "system_db"
  | "system_queue"
  | "container"
  | "container_db"
  | "container_queue"
  | "component"
  | "component_db"
  | "component_queue";

/** 境界と配置先のノード */
export type C4Boundary = {
  id: string;
  label: string;
  kind: C4BoundaryKind;
  /** 配置先のノードの種類の引数 */
  technology?: string | undefined;
  parent: string | undefined;
  /** `Node_L` は left、`Node_R` は right */
  side?: "left" | "right" | undefined;
};

/** 要素 */
export type C4Element = {
  id: string;
  label: string;
  description: string | undefined;
  /** コンテナ・コンポーネントの技術の引数 */
  technology?: string | undefined;
  kind: C4ElementKind;
  external: boolean;
  parent: string | undefined;
};

/** 関係の向きの指定 */
export type C4Direction = "up" | "down" | "left" | "right" | "back";

/** 関係（`id` は記載順の `r{番号}`） */
export type C4Relation = {
  id: string;
  from: string;
  to: string;
  label: string | undefined;
  technology: string | undefined;
  both: boolean;
  direction: C4Direction | undefined;
  /** `C4Dynamic` の記載順の番号（1 から） */
  index?: number | undefined;
};

/** parseC4 の戻り値 */
export type C4Diagram = {
  kind: C4DiagramKind;
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
  container: "[Container]",
  component: "[Component]",
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
  ...Object.fromEntries(
    (["container", "component"] as const).flatMap((base) =>
      (
        [
          ["", { shape: "rect" }],
          ["_db", { icon: "database", shape: "rect" }],
          ["_queue", { shape: "pill" }],
        ] as const
      ).flatMap(([suffix, look]) => [
        [`mdmark-c4-${base}${suffix}`, { label: C4_LABELS[base], ...look }],
        [
          `mdmark-c4-${base}${suffix}-ext`,
          {
            label: C4_LABELS[base].replace("[", "[External "),
            ...look,
            color: "gray",
          },
        ],
      ]),
    ),
  ),
} satisfies Record<string, MapKind>;

/** 技術の引数を持つ要素の種類の行（`[Container: Node.js]`） */
const kindLabelOf = (element: C4Element): string | undefined => {
  const base = element.kind.split("_")[0];
  if (
    element.technology === undefined ||
    (base !== "container" && base !== "component")
  )
    return undefined;
  const label = C4_LABELS[base].slice(1, -1);
  return `[${element.external ? "External " : ""}${label}: ${element.technology}]`;
};

/** 境界の関数ごとの種類 */
const BOUNDARIES: Record<string, C4BoundaryKind> = {
  Enterprise_Boundary: "enterprise",
  System_Boundary: "system",
  Container_Boundary: "container",
  Boundary: "boundary",
  Deployment_Node: "deployment",
  Node: "deployment",
  Node_L: "deployment",
  Node_R: "deployment",
};

/** 要素の関数ごとの種類 */
const ELEMENTS: Record<string, C4ElementKind> = {
  Person: "person",
  System: "system",
  SystemDb: "system_db",
  SystemQueue: "system_queue",
  Container: "container",
  ContainerDb: "container_db",
  ContainerQueue: "container_queue",
  Component: "component",
  ComponentDb: "component_db",
  ComponentQueue: "component_queue",
};

/** 図の種類（1 行目の最初の単語） */
const DIAGRAM_KINDS = new Set<string>([
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
]);

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
  Back: "back",
};

const CALL_RE = /^(\w+)\((.*)\)\s*(\{)?$/;
const RELATION_RE = /^(Bi)?Rel(?:_(U|Up|D|Down|L|Left|R|Right|Back)|(Index))?$/;
/** 読んで捨てる行 */
const IGNORED_RE =
  /^(accTitle|accDescr|UpdateLayoutConfig|UpdateElementStyle|UpdateRelStyle|UpdateBoundaryStyle|AddElementTag|AddRelTag)\b/;

/** 関数の引数の並び（`"…"` と識別子をカンマで分ける） */
const argumentsOf = (text: string): string[] =>
  [...text.matchAll(/"([^"]*)"|([^,\s][^,]*)/g)].map((match) =>
    (match[1] ?? match[2] ?? "").trim(),
  );

/** 別名として読める文字（空白・引用符を含まない） */
const ALIAS_RE = /^[^\s"'(),{}]+$/;

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の C4 の記法（\`Person(…)\`・\`Container(…)\`・\`Rel(…)\` など）で記載してください。`,
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
  const [id, label, technology] = call.values;
  if (kind === undefined || id === undefined || !ALIAS_RE.test(id))
    return false;
  const boundary: C4Boundary = {
    id,
    label: label ?? id,
    kind,
    parent: reading.stack.at(-1)?.boundary.id,
  };
  if (kind === "deployment") {
    boundary.technology = technology;
    if (call.name === "Node_L") boundary.side = "left";
    if (call.name === "Node_R") boundary.side = "right";
  }
  reading.diagram.boundaries.push(boundary);
  if (call.open) reading.stack.push({ boundary, line: call.line });
  return true;
};

/** 要素の関数なら要素を足す。読めた行なら `true` */
const readElement = (reading: C4Reading, call: C4Call): boolean => {
  const external = call.name.endsWith("_Ext");
  const kind = ELEMENTS[external ? call.name.slice(0, -4) : call.name];
  const [id, label] = call.values;
  if (kind === undefined || id === undefined || !ALIAS_RE.test(id))
    return false;
  reading.diagram.elements.push({
    id,
    label: label ?? id,
    ...detailsOf(kind, call.values),
    kind,
    external,
    parent: reading.stack.at(-1)?.boundary.id,
  });
  return true;
};

/** 要素の 3 つ目からの引数（コンテナ・コンポーネントは技術・説明、ほかは説明） */
const detailsOf = (
  kind: C4ElementKind,
  values: string[],
): { description: string | undefined; technology?: string } => {
  const [, , third, fourth] = values;
  if (!kind.startsWith("container") && !kind.startsWith("component"))
    return { description: third };
  return third === undefined || third === ""
    ? { description: fourth }
    : { description: fourth, technology: third };
};

/** 関係の関数なら関係を足す。読めた行なら `true` */
const readRelation = (reading: C4Reading, call: C4Call): boolean => {
  const relation = RELATION_RE.exec(call.name);
  // RelIndex の第 1 引数（番号）は Mermaid と同じく読まない
  const values =
    relation?.[3] === undefined ? call.values : call.values.slice(1);
  const [from, to, label, technology] = values;
  if (
    !relation ||
    from === undefined ||
    to === undefined ||
    !ALIAS_RE.test(from) ||
    !ALIAS_RE.test(to)
  )
    return false;
  const { relations } = reading.diagram;
  relations.push({
    id: `r${relations.length + 1}`,
    from,
    to,
    label,
    technology,
    both: relation[1] !== undefined,
    direction: relation[2] === undefined ? undefined : DIRECTIONS[relation[2]],
    ...(reading.diagram.kind === "C4Dynamic"
      ? { index: relations.length + 1 }
      : {}),
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

/** C4 の 5 種類の図の Mermaid を、種類・タイトル・境界と配置先のノード・要素・関係と読めない行の項目に読む */
export const parseC4 = (source: string): C4Diagram => {
  const first = source.trimStart().split(/\s/, 1)[0] ?? "";
  const reading: C4Reading = {
    diagram: {
      kind: (DIAGRAM_KINDS.has(first) ? first : "C4Context") as C4DiagramKind,
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
      message: `${open.boundary.kind === "deployment" ? "配置先のノード" : "境界"} \`${open.boundary.id}\` の \`{\` に対応する \`}\` がありません。境界の最後の行の後に \`}\` を記載してください。`,
    });
  return reading.diagram;
};

/** 関係の線のラベル（`C4Dynamic` は前に番号、後ろに技術） */
const relationLabel = (relation: C4Relation): string =>
  [
    relation.index === undefined ? undefined : `${relation.index}:`,
    relation.label,
    relation.technology === undefined ? undefined : `[${relation.technology}]`,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join(" ");

/** 要素をノード、境界をグループ、関係を線にした上から下の構成図の入力と、段と並びの上書き */
export const c4ToFlowchart = (
  diagram: C4Diagram,
): {
  chart: Flowchart;
  overrides: Record<string, MapOverride>;
  reversed: string[];
  /** 技術の引数を持つ要素ごとの種類（種類の行を `[Container: {技術}]` にする） */
  kinds: Record<string, MapKind>;
} => {
  const kinds: Record<string, MapKind> = {};
  const nodes: FlowNode[] = diagram.elements.map((element) => {
    const base = `mdmark-c4-${element.kind}${element.external ? "-ext" : ""}`;
    const label = kindLabelOf(element);
    const name = label === undefined ? base : `${base}--${element.id}`;
    if (label !== undefined)
      kinds[name] = {
        ...MAP_C4_KINDS[base as keyof typeof MAP_C4_KINDS],
        label,
      };
    return {
      id: element.id,
      label: element.label,
      shape: "rect",
      classes: [name],
      parent: element.parent,
    };
  });
  const groups: FlowGroup[] = diagram.boundaries.map((boundary) => ({
    id: boundary.id,
    title:
      boundary.kind === "deployment" &&
      boundary.technology !== undefined &&
      boundary.technology !== ""
        ? `${boundary.label}［${boundary.technology}］`
        : boundary.label,
    parent: boundary.parent,
    direction: "TB",
  }));
  const overrides: Record<string, MapOverride> = Object.fromEntries(
    diagram.elements.map((element) => [
      element.id,
      { size: elementSize(element) },
    ]),
  );
  // 閉じた境界のノードは、種類を含むタイトルと「{数} 件」が収まる大きさにする
  for (const boundary of diagram.boundaries)
    overrides[boundary.id] = {
      size: mapClosedGroupSize(
        mapC4BoundaryTitle(boundary.label, boundary.kind),
      ),
    };
  // 両端が読めた要素か境界の関係だけを線にする（読めない行の要素を指す関係は描かない）
  const ids = new Set([
    ...diagram.elements.map((element) => element.id),
    ...diagram.boundaries.map((boundary) => boundary.id),
  ]);
  const relations = diagram.relations.filter(
    (relation) => ids.has(relation.from) && ids.has(relation.to),
  );
  // 矢じりを線の元の側に描く線（`Rel_U` は段のために元と先を入れ替え、`Rel_Back` は元へ向ける）
  const reversed = relations
    .filter(
      (relation) =>
        !relation.both &&
        (relation.direction === "up" || relation.direction === "back"),
    )
    .map((relation) => relation.id);
  let order = 0;
  /** `first` の後ろの同じ段に `second` を並べる */
  const placeAfter = (first: string, second: string) => {
    overrides[first] = {
      ...overrides[first],
      order: overrides[first]?.order ?? order++,
    };
    overrides[second] = { ...overrides[second], align: first, order: order++ };
  };
  const edges: FlowEdge[] = relations.map((relation) => {
    if (relation.direction === "left" || relation.direction === "right") {
      // 左右の向きの関係は同じ段に並べ、`Rel_R` は先を元の右、`Rel_L` は左に置く
      overrides[relation.id] = { rankless: true };
      if (relation.direction === "right")
        placeAfter(relation.from, relation.to);
      else placeAfter(relation.to, relation.from);
    }
    const label = relationLabel(relation);
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
  // Node_L・Node_R の兄弟の配置先のノードは、Node_L を前・Node_R を後の同じ段に並べる
  for (const left of diagram.boundaries.filter((item) => item.side === "left"))
    for (const right of diagram.boundaries.filter(
      (item) => item.side === "right" && item.parent === left.parent,
    ))
      placeAfter(left.id, right.id);
  return {
    kinds,
    chart: {
      direction: "TB",
      nodes,
      groups,
      edges,
      links: {},
      linkLines: {},
      problems: diagram.problems,
    },
    overrides,
    reversed,
  };
};
