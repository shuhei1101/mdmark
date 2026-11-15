import {
  type MapClassEnd,
  type MapClassNode,
  mapClassNodeSize,
} from "../parts/map.ts";
import type { Flowchart, FlowEdge, FlowGroup, FlowNode } from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import type { MapKind, MapProblem } from "./spec.ts";

/** クラスのメンバー */
export type ClassMember = MapClassNode["members"][number];

/** クラス（`generic` は `~T~` の中身。`id` に含めない） */
export type ClassItem = {
  id: string;
  generic: string | undefined;
  annotation: string | undefined;
  namespace: string | undefined;
  members: ClassMember[];
};

/** 関係の端の形 */
export type ClassEndShape = NonNullable<MapClassEnd["shape"]>;

/** 関係（`id` は記載順の `r{番号}`） */
export type ClassRelation = {
  id: string;
  from: string;
  to: string;
  fromCardinality: string | undefined;
  toCardinality: string | undefined;
  fromEnd: ClassEndShape | undefined;
  toEnd: ClassEndShape | undefined;
  dashed: boolean;
  label: string | undefined;
};

/** ノート（`id` は記載順の `note_{番号}`） */
export type ClassNote = { id: string; of: string; text: string };

/** parseClassDiagram の戻り値 */
export type ClassDiagram = {
  classes: ClassItem[];
  namespaces: string[];
  relations: ClassRelation[];
  notes: ClassNote[];
  problems: MapProblem[];
};

/** クラス図のノードの種類（設定の map.kinds に重ねる。キーは設定と重ならない名前） */
export const MAP_CLASS_KINDS = {
  "mdmark-class": { label: "クラス", shape: "rect" },
  "mdmark-class-annotated": { shape: "rect" },
  "mdmark-memo": { label: "ノート", shape: "rect" },
} satisfies Record<string, MapKind>;

/** 関係の記号ごとの、破線かと左右の端の形 */
const RELATION_SYMBOLS: Record<
  string,
  { dashed: boolean; left?: ClassEndShape; right?: ClassEndShape }
> = {
  "<|--": { dashed: false, left: "triangle" },
  "--|>": { dashed: false, right: "triangle" },
  "*--": { dashed: false, left: "diamond-filled" },
  "--*": { dashed: false, right: "diamond-filled" },
  "o--": { dashed: false, left: "diamond-open" },
  "--o": { dashed: false, right: "diamond-open" },
  "-->": { dashed: false, right: "arrow" },
  "<--": { dashed: false, left: "arrow" },
  "..>": { dashed: true, right: "arrow" },
  "<..": { dashed: true, left: "arrow" },
  "..|>": { dashed: true, right: "triangle" },
  "<|..": { dashed: true, left: "triangle" },
  "--": { dashed: false },
  "..": { dashed: true },
};

const ID = "[A-Za-z0-9_\\u0080-\\uffff]+";
const NAME = `(${ID})(?:~([^~]+)~)?`;
const RELATION_RE = new RegExp(
  `^${NAME}\\s+(?:"([^"]*)"\\s+)?(${Object.keys(RELATION_SYMBOLS)
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[|*.]/g, "\\$&"))
    .join("|")})\\s+(?:"([^"]*)"\\s+)?${NAME}(?:\\s*:\\s*(.+))?$`,
);
const NAMESPACE_RE = new RegExp(`^namespace\\s+(${ID})\\s*\\{$`);
const CLASS_OPEN_RE = new RegExp(`^class\\s+${NAME}\\s*\\{$`);
const CLASS_RE = new RegExp(`^class\\s+${NAME}$`);
const ANNOTATION_RE = new RegExp(`^<<(.+)>>\\s+(${ID})$`);
const MEMBER_RE = new RegExp(`^(${ID})\\s*:\\s*(.+)$`);
const NOTE_RE = new RegExp(`^note\\s+for\\s+(${ID})\\s+"([^"]*)"$`);
/** 読んで捨てる行 */
const IGNORED_RE =
  /^(direction|classDef|cssClass|style|click|callback|link|accTitle|accDescr|title)\b/;

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の classDiagram の記法（\`{クラス} <|-- {クラス}\` など）で記載してください。`,
});

/** メンバーの 1 行を、可視性・名前・型・静的・抽象・メソッドに読む */
const parseMember = (text: string): ClassMember => {
  let body = text.trim();
  const visibility = /^[+\-#~]/.test(body) ? body.slice(0, 1) : "";
  if (visibility !== "") body = body.slice(1);
  // 静的の `$` と抽象の `*` は、行の末尾か、名前（メソッドは `)`）の直後に付く
  const marker = /([$*])$|^([^\s(]+|[^)]*\))([$*])(?=\s|$)/.exec(body);
  const sign = marker?.[1] ?? marker?.[3];
  const isStatic = sign === "$";
  const isAbstract = sign === "*";
  if (marker?.[1]) body = body.slice(0, -1).trimEnd();
  else if (marker?.[2] !== undefined)
    body = `${marker[2]}${body.slice(marker[0].length)}`;
  const method = /^([^(]+)\(([^)]*)\)\s*(.*)$/.exec(body);
  if (method) {
    const name = (method[1] ?? "").trim();
    const type = method[3] ?? "";
    return {
      visibility,
      name,
      text: `${name}(${method[2] ?? ""})${type === "" ? "" : ` ${type}`}`,
      method: true,
      isStatic,
      isAbstract,
    };
  }
  return {
    visibility,
    name: body.split(/\s+/, 1)[0] ?? body,
    text: body,
    method: false,
    isStatic,
    isAbstract,
  };
};

/** 読み取りの途中の状態 */
type ClassReading = {
  classes: Map<string, ClassItem>;
  namespaces: string[];
  relations: ClassRelation[];
  notes: ClassNote[];
  space: { id: string; line: number } | undefined;
  open: { item: ClassItem; line: number } | undefined;
};

/** クラスを返却する（無ければ今の `namespace` の中に作る） */
const ensureClass = (
  reading: ClassReading,
  id: string,
  generic?: string,
): ClassItem => {
  const found = reading.classes.get(id);
  const item = found ?? {
    id,
    generic: undefined,
    annotation: undefined,
    namespace: reading.space?.id,
    members: [],
  };
  if (!found) reading.classes.set(id, item);
  if (generic !== undefined) item.generic = generic;
  return item;
};

/** クラスの区間の中の行（`}`・注釈・メンバー） */
const readInside = (reading: ClassReading, text: string): void => {
  const current = reading.open?.item;
  if (!current) return;
  if (text === "}") {
    reading.open = undefined;
    return;
  }
  const annotation = /^<<(.+)>>$/.exec(text);
  if (annotation?.[1]) current.annotation = annotation[1];
  else current.members.push(parseMember(text));
};

/** 関係の行なら、関係を足す */
const readRelation = (reading: ClassReading, text: string): boolean => {
  const match = RELATION_RE.exec(text);
  if (!match?.[1] || !match[4] || !match[6]) return false;
  const symbol = RELATION_SYMBOLS[match[4]] ?? { dashed: false };
  const label = match[8]?.trim();
  reading.relations.push({
    id: `r${reading.relations.length + 1}`,
    from: ensureClass(reading, match[1], match[2]).id,
    to: ensureClass(reading, match[6], match[7]).id,
    fromCardinality: match[3],
    toCardinality: match[5],
    fromEnd: symbol.left,
    toEnd: symbol.right,
    dashed: symbol.dashed,
    label: label === "" ? undefined : label,
  });
  return true;
};

/** 行の読み方（先に当たった読み方で読む） */
const READERS: Array<
  (reading: ClassReading, text: string, line: number) => boolean
> = [
  (reading, text, line) => {
    const match = NAMESPACE_RE.exec(text);
    if (!match?.[1]) return false;
    reading.namespaces.push(match[1]);
    reading.space = { id: match[1], line };
    return true;
  },
  (reading, text, line) => {
    const match = CLASS_OPEN_RE.exec(text);
    if (!match?.[1]) return false;
    reading.open = { item: ensureClass(reading, match[1], match[2]), line };
    return true;
  },
  (reading, text) => {
    const match = CLASS_RE.exec(text);
    if (!match?.[1]) return false;
    ensureClass(reading, match[1], match[2]);
    return true;
  },
  (reading, text) => {
    const match = ANNOTATION_RE.exec(text);
    if (!match?.[1] || !match[2]) return false;
    ensureClass(reading, match[2]).annotation = match[1];
    return true;
  },
  (reading, text) => {
    const match = NOTE_RE.exec(text);
    if (!match?.[1] || match[2] === undefined) return false;
    reading.notes.push({
      id: `note_${reading.notes.length + 1}`,
      of: match[1],
      text: match[2],
    });
    return true;
  },
  readRelation,
  (reading, text) => {
    const match = MEMBER_RE.exec(text);
    if (!match?.[1] || !match[2]) return false;
    ensureClass(reading, match[1]).members.push(parseMember(match[2]));
    return true;
  },
  (reading, text) => {
    if (text !== "}" || reading.space === undefined) return false;
    reading.space = undefined;
    return true;
  },
];

/** 閉じの無いクラスと `namespace` の項目 */
const unclosedProblems = (reading: ClassReading): MapProblem[] => {
  const opened = [
    ...(reading.open
      ? [{ kind: "クラス", id: reading.open.item.id, line: reading.open.line }]
      : []),
    ...(reading.space
      ? [{ kind: "namespace", id: reading.space.id, line: reading.space.line }]
      : []),
  ];
  return opened.map(
    (item): MapProblem => ({
      kind: "map_invalid",
      line: item.line,
      message: `${item.kind} \`${item.id}\` の \`{\` に対応する \`}\` がありません。最後の行の後に \`}\` を記載してください。`,
    }),
  );
};

/** `classDiagram` の Mermaid を、クラス・メンバー・関係・`namespace`・ノートと読めない行の項目に読む */
export const parseClassDiagram = (source: string): ClassDiagram => {
  const reading: ClassReading = {
    classes: new Map(),
    namespaces: [],
    relations: [],
    notes: [],
    space: undefined,
    open: undefined,
  };
  const problems: MapProblem[] = [];
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "") continue;
    if (reading.open) {
      readInside(reading, text);
      continue;
    }
    if (IGNORED_RE.test(text)) continue;
    if (!READERS.some((read) => read(reading, text, line)))
      problems.push(unreadable(line, raw));
  }
  problems.push(...unclosedProblems(reading));
  return {
    classes: [...reading.classes.values()],
    namespaces: reading.namespaces,
    relations: reading.relations,
    notes: reading.notes,
    problems,
  };
};

/** クラスをノード、`namespace` をグループ、関係を線、ノートを破線でつないだノードにした、左から右の構成図の入力 */
export const classToFlowchart = (diagram: ClassDiagram): Flowchart => {
  const namespaceOf = new Map(
    diagram.classes.map((item) => [item.id, item.namespace]),
  );
  const nodes: FlowNode[] = diagram.classes.map((item) => ({
    id: item.id,
    label: item.generic === undefined ? item.id : `${item.id}<${item.generic}>`,
    shape: "rect",
    classes: [
      item.annotation === undefined ? "mdmark-class" : "mdmark-class-annotated",
    ],
    parent: item.namespace,
  }));
  const edges: FlowEdge[] = diagram.relations.map((relation) => ({
    id: relation.id,
    from: relation.from,
    to: relation.to,
    arrow: relation.dashed ? "-.->" : "---",
    both: false,
    label: relation.label,
  }));
  diagram.notes.forEach((note, index) => {
    nodes.push({
      id: note.id,
      label: note.text,
      shape: "rect",
      classes: ["mdmark-memo"],
      parent: namespaceOf.get(note.of),
    });
    edges.push({
      id: `n${index + 1}`,
      from: note.of,
      to: note.id,
      arrow: "-.->",
      both: false,
      label: undefined,
    });
  });
  const groups: FlowGroup[] = diagram.namespaces.map((id) => ({
    id,
    title: id,
    parent: undefined,
    direction: "TB",
  }));
  return {
    direction: "LR",
    nodes,
    groups,
    edges,
    links: {},
    problems: diagram.problems,
  };
};

/** 部品に指定するクラスの中身・関係の端と、クラスの幅とメンバーの行の数と開閉で決まる大きさの上書き */
export const classPartInputs = (
  diagram: ClassDiagram,
  collapsed: ReadonlySet<string>,
): {
  classes: MapClassNode[];
  ends: MapClassEnd[];
  overrides: Record<string, MapOverride>;
} => {
  const overrides: Record<string, MapOverride> = {};
  for (const item of diagram.classes) {
    const methods = item.members.filter((member) => member.method).length;
    overrides[item.id] = {
      size: mapClassNodeSize({
        attributes: item.members.length - methods,
        methods,
        collapsed: collapsed.has(item.id),
      }),
    };
  }
  const ends: MapClassEnd[] = diagram.relations.flatMap((relation) =>
    (
      [
        ["from", relation.fromEnd, relation.fromCardinality],
        ["to", relation.toEnd, relation.toCardinality],
      ] as const
    ).flatMap(([at, shape, card]) =>
      shape === undefined && card === undefined
        ? []
        : [{ wire: relation.id, at, shape, card }],
    ),
  );
  return {
    classes: diagram.classes.map((item) => ({
      id: item.id,
      annotation: item.annotation,
      members: item.members,
    })),
    ends,
    overrides,
  };
};
