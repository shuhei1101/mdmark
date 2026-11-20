import type { MapGroup } from "./data.ts";
import type {
  Direction,
  Flowchart,
  FlowEdge,
  FlowGroup,
  FlowNode,
} from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
import { MAP_ER, type MapErRelation, mapErNodeSize } from "./map.part.ts";
import { type MermaidStyles, readMermaidStyles } from "./mermaid-style.ts";
import type { MapProblem } from "./spec.ts";

/** 関連の片端の多重度 */
export type ErCardinality = "1" | "0..1" | "1..n" | "0..n";

/** テーブルの列 */
export type ErColumn = {
  type: string;
  name: string;
  /** `PK`・`FK`・`UK` の並び */
  keys: string[];
  comment: string | undefined;
};

/** テーブル */
export type ErTable = {
  name: string;
  /** 別名のテーブル（`{ID}["{名前}"]`）の名前 */
  label?: string;
  columns: ErColumn[];
};

/** `subgraph` のグループ */
export type ErGroup = {
  id: string;
  title: string;
  parent: string | undefined;
  direction: Direction | undefined;
  /** 中で宣言したテーブルの名前 */
  tables: string[];
};

/** 関連（id は記載順の `r{番号}`） */
export type ErRelation = {
  id: string;
  from: string;
  to: string;
  fromCardinality: ErCardinality;
  toCardinality: ErCardinality;
  dashed: boolean;
  label: string | undefined;
};

/** parseErDiagram の戻り値 */
export type ErDiagram = {
  tables: ErTable[];
  relations: ErRelation[];
  /** `subgraph` のグループ */
  groups?: ErGroup[];
  /** `direction` の向き */
  direction?: Direction;
  /** `readMermaidStyles` が読み取ったテーブルとグループの色 */
  styles?: MermaidStyles;
  problems: MapProblem[];
};

/** 2 つのテーブルの経路を 1 の側から多の側へたどる関連 */
export type ErFanout = { relation: string; from: string; to: string };

/** 関連の片端の記号と多重度 */
const CARDINALITY: Record<string, ErCardinality> = {
  "||": "1",
  "|o": "0..1",
  "o|": "0..1",
  "}|": "1..n",
  "|{": "1..n",
  "}o": "0..n",
  "o{": "0..n",
};

/** 多の側の多重度 */
const MANY = new Set<ErCardinality>(["1..n", "0..n"]);

/** テーブル名（引用符で囲んだ名前か、空白・記号を持たない名前） */
const TABLE = '(?:"([^"]*)"|([^\\s{}:"|\\[\\]]+))';
/** テーブル名の後ろの `:::{クラス}` */
const CLASS_SUFFIX = "(?::::[\\w-]+)?";
const TABLE_RE = new RegExp(
  `^${TABLE}(?:\\[(?:"([^"]*)"|([^\\]"]*))\\])?${CLASS_SUFFIX}\\s*(\\{)?$`,
);
const COLUMN_RE =
  /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/;
const SYMBOL_RELATION_RE = new RegExp(
  `^${TABLE}${CLASS_SUFFIX}\\s*([|}o][|o{])(--|\\.\\.)([|o][|{o])\\s*${TABLE}${CLASS_SUFFIX}$`,
);
/** 単語で記載した多重度 */
const WORD_CARDINALITY: Record<string, ErCardinality> = {
  "only one": "1",
  "1": "1",
  "zero or one": "0..1",
  "one or more": "1..n",
  "one or many": "1..n",
  "many(1)": "1..n",
  "1+": "1..n",
  "zero or more": "0..n",
  "zero or many": "0..n",
  "many(0)": "0..n",
  "0+": "0..n",
};
const WORDS = `(${Object.keys(WORD_CARDINALITY)
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[()+]/g, "\\$&"))
  .join("|")})`;
const WORD_RELATION_RE = new RegExp(
  `^${TABLE}${CLASS_SUFFIX}\\s+${WORDS}\\s+(to|optionally to)\\s+${WORDS}\\s+${TABLE}${CLASS_SUFFIX}$`,
);
const SUBGRAPH_RE = /^subgraph\s+(?:"([^"]*)"|([^\s[]+))(?:\s*\[([^\]]*)\])?$/;
const DIRECTION_RE = /^direction\s+(TB|TD|BT|LR|RL)$/;
/** 色を指定する行（`readMermaidStyles` が読む） */
const STYLE_RE = /^(classDef|class|style)\s/;
/** 参照先のコメント（`参照: {テーブル}.{列}`） */
const REFERENCE_RE = /^参照:\s*([^.\s]+)\./;

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の erDiagram の記法（\`{テーブル} ||--o{ {テーブル} : "{ラベル}"\` など）で記載してください。`,
});

/** テーブルの `{` の中の列の行を読む（読めなければ `undefined`） */
const readColumn = (text: string): ErColumn | undefined => {
  const column = COLUMN_RE.exec(text);
  if (!column?.[1] || !column[2]) return undefined;
  return {
    type: column[1],
    name: column[2],
    keys: column[3]?.split(/\s*,\s*/) ?? [],
    comment: column[4],
  };
};

/** 関連の端の記号の多重度（知らない記号は `undefined`） */
const cardinalityOf = (mark: string | undefined) =>
  mark ? CARDINALITY[mark] : undefined;

/** 関連の行を読む（読めなければ `undefined`。`id` は付けない） */
const readRelation = (text: string): Omit<ErRelation, "id"> | undefined => {
  // `:::{クラス}` の `:` はラベルの区切りにしない
  const split =
    /^((?:"[^"]*"|:::[\w-]+|[^:"])*)\s*:\s*(?:"([^"]*)"|(.*))$/.exec(text);
  if (!split?.[1]) return undefined;
  const label = (split[2] ?? split[3] ?? "").trim();
  const ends = relationEnds(split[1].trim());
  if (!ends) return undefined;
  return { ...ends, label: label === "" ? undefined : label };
};

/** 関連の記号か単語の多重度の部分を、両端のテーブルと多重度に読む */
const relationEnds = (
  text: string,
): Omit<ErRelation, "id" | "label"> | undefined => {
  const symbol = SYMBOL_RELATION_RE.exec(text);
  if (symbol) {
    const left = cardinalityOf(symbol[3]);
    const right = cardinalityOf(symbol[5]);
    const from = symbol[1] ?? symbol[2];
    const to = symbol[6] ?? symbol[7];
    if (!left || !right || from === undefined || to === undefined)
      return undefined;
    return {
      from,
      to,
      fromCardinality: left,
      toCardinality: right,
      dashed: symbol[4] === "..",
    };
  }
  const word = WORD_RELATION_RE.exec(text);
  if (!word) return undefined;
  const from = word[1] ?? word[2];
  const to = word[6] ?? word[7];
  const left = WORD_CARDINALITY[word[3] ?? ""];
  const right = WORD_CARDINALITY[word[5] ?? ""];
  if (!left || !right || from === undefined || to === undefined)
    return undefined;
  return {
    from,
    to,
    fromCardinality: left,
    toCardinality: right,
    dashed: word[4] === "optionally to",
  };
};

/** `{` を開いたテーブルと、その行 */
type OpenTable = { table: ErTable; line: number };

/** テーブルの `{` の中の行を読む。`}` なら閉じて `undefined` を返却し、読めない行は項目を足す */
const readInTable = (
  current: OpenTable,
  at: { text: string; line: number; raw: string; problems: MapProblem[] },
): OpenTable | undefined => {
  if (at.text === "}") return undefined;
  const column = readColumn(at.text);
  if (column) current.table.columns.push(column);
  else at.problems.push(unreadable(at.line, at.raw));
  return current;
};

/** `erDiagram` の Mermaid を、テーブル・列・関連と読めない行の項目に読む */
export const parseErDiagram = (source: string): ErDiagram => {
  const tables = new Map<string, ErTable>();
  const relations: ErRelation[] = [];
  const problems: MapProblem[] = [];
  const groups: ErGroup[] = [];
  const stack: ErGroup[] = [];
  let direction: Direction | undefined;
  const tableOf = (name: string): ErTable => {
    const found = tables.get(name);
    if (found) return found;
    const table: ErTable = { name, columns: [] };
    tables.set(name, table);
    stack.at(-1)?.tables.push(name);
    return table;
  };
  /** `subgraph`・`end`・`direction` の行（読んだら true） */
  const readStructure = (text: string): boolean => {
    const subgraph = SUBGRAPH_RE.exec(text);
    if (subgraph) {
      const id = subgraph[1] ?? subgraph[2] ?? "";
      const group: ErGroup = {
        id,
        title: subgraph[3]?.trim() ?? id,
        parent: stack.at(-1)?.id,
        direction: undefined,
        tables: [],
      };
      groups.push(group);
      stack.push(group);
      return true;
    }
    if (text === "end" && stack.length > 0) {
      stack.pop();
      return true;
    }
    const dir = DIRECTION_RE.exec(text);
    if (!dir?.[1]) return false;
    const value: Direction = dir[1] === "LR" || dir[1] === "RL" ? "LR" : "TB";
    const current = stack.at(-1);
    if (current) current.direction = value;
    else direction = value;
    return true;
  };
  let current: OpenTable | undefined;
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "") continue;
    const at = { text, line, raw, problems };
    if (current) {
      current = readInTable(current, at);
      continue;
    }
    if (STYLE_RE.test(text) || readStructure(text)) continue;
    const table = TABLE_RE.exec(text);
    if (table) {
      const found = tableOf(table[1] ?? table[2] ?? "");
      const label = table[3] ?? table[4];
      if (label !== undefined) found.label = label.trim();
      if (table[5] !== undefined) current = { table: found, line };
      continue;
    }
    const relation = readRelation(text);
    if (!relation) {
      problems.push(unreadable(line, raw));
      continue;
    }
    tableOf(relation.from);
    tableOf(relation.to);
    relations.push({ id: `r${relations.length + 1}`, ...relation });
  }
  if (current) {
    problems.push({
      kind: "map_invalid",
      line: current.line,
      message: `テーブル \`${current.table.name}\` の \`{\` に対応する \`}\` がありません。テーブルの最後の行の後に \`}\` を記載してください。`,
    });
  }
  return {
    tables: [...tables.values()],
    relations,
    groups,
    ...(direction === undefined ? {} : { direction }),
    styles: readMermaidStyles({
      lines: source.split("\n").slice(1),
      classTarget: "class",
    }),
    problems,
  };
};

/** テーブルが相手のテーブルとの関連の端をつなぐ列（参照のコメントの FK → 名前が相手で始まる FK → PK） */
export const erColumnFor = (
  table: ErTable,
  other: string,
): ErColumn | undefined =>
  table.columns.find(
    (column) =>
      column.keys.includes("FK") &&
      REFERENCE_RE.exec(column.comment ?? "")?.[1] === other,
  ) ??
  table.columns.find(
    (column) => column.keys.includes("FK") && column.name.startsWith(other),
  ) ??
  table.columns.find((column) => column.keys.includes("PK"));

/** 関連を無向の辺としてたどった、テーブルから各テーブルへの距離 */
const distances = (
  relations: ErRelation[],
  origin: string,
): Map<string, number> => {
  const dist = new Map([[origin, 0]]);
  const queue = [origin];
  for (let at = 0; at < queue.length; at++) {
    const table = queue[at] as string;
    const base = dist.get(table) ?? 0;
    for (const relation of relations) {
      const next =
        relation.from === table
          ? relation.to
          : relation.to === table
            ? relation.from
            : undefined;
      if (next !== undefined && !dist.has(next)) {
        dist.set(next, base + 1);
        queue.push(next);
      }
    }
  }
  return dist;
};

/** 2 つのテーブルをつなぐ最短の経路に乗る全ての関連と、1 の側から多の側へたどる関連 */
export const erFanouts = (
  relations: ErRelation[],
  a: string,
  b: string,
):
  | { tables: string[]; relations: string[]; fanouts: ErFanout[] }
  | undefined => {
  const fromA = distances(relations, a);
  const fromB = distances(relations, b);
  const total = fromA.get(b);
  if (total === undefined) return undefined;
  const tables = new Set<string>([a, b]);
  const onPath = new Set<string>();
  const fanouts: ErFanout[] = [];
  for (const relation of relations) {
    const ways: Array<[string, string, ErCardinality]> = [
      [relation.from, relation.to, relation.toCardinality],
      [relation.to, relation.from, relation.fromCardinality],
    ];
    for (const [u, v, cardinality] of ways) {
      const du = fromA.get(u);
      const dv = fromB.get(v);
      if (du === undefined || dv === undefined || du + 1 + dv !== total)
        continue;
      tables.add(u);
      tables.add(v);
      onPath.add(relation.id);
      if (MANY.has(cardinality))
        fanouts.push({ relation: relation.id, from: u, to: v });
    }
  }
  return {
    tables: [...tables],
    relations: relations
      .filter((relation) => onPath.has(relation.id))
      .map((relation) => relation.id),
    fanouts,
  };
};

/** テーブルをノード、補足の分類をグループ、関連を線にした構成図の入力（向きは LR、分類の中は TB） */
export const erToFlowchart = (
  er: ErDiagram,
  groups: Record<string, MapGroup>,
): Flowchart => {
  const owner = new Map<string, string>();
  for (const [id, group] of Object.entries(groups))
    for (const name of group.tables) if (!owner.has(name)) owner.set(name, id);
  // Mermaid の `subgraph` のグループ（補足の分類と同じ ID は補足を優先する）
  const subgraphs = (er.groups ?? []).filter((group) => !(group.id in groups));
  for (const group of subgraphs)
    for (const name of group.tables)
      if (!owner.has(name)) owner.set(name, group.id);
  const flowGroups: FlowGroup[] = [
    ...Object.entries(groups).map(([id, group]) => ({
      id,
      title: group.title,
      parent:
        group.parent !== undefined && group.parent in groups
          ? group.parent
          : undefined,
      direction: "TB" as const,
    })),
    ...subgraphs.map((group) => ({
      id: group.id,
      title: group.title,
      parent: group.parent,
      direction: group.direction ?? ("TB" as const),
    })),
  ];
  const nodes: FlowNode[] = er.tables.map((table) => ({
    id: table.name,
    label: table.label ?? table.name,
    shape: "rect",
    classes: [],
    parent: owner.get(table.name),
  }));
  const edges: FlowEdge[] = er.relations.map((relation) => ({
    id: relation.id,
    from: relation.from,
    to: relation.to,
    arrow: relation.dashed ? "-.->" : "---",
    both: false,
    label: undefined,
  }));
  return {
    direction: er.direction ?? "LR",
    nodes,
    groups: flowGroups,
    edges,
    links: {},
    linkLines: {},
    ...(er.styles === undefined ? {} : { styles: er.styles }),
    problems: er.problems,
  };
};

/** 部品『mapのER図』の関連。端をつなぐ列は erColumnFor で選ぶ */
export const erPartRelations = (er: ErDiagram): MapErRelation[] => {
  const tables = new Map(er.tables.map((table) => [table.name, table]));
  const columnOf = (name: string, other: string): string | undefined => {
    const table = tables.get(name);
    return table === undefined ? undefined : erColumnFor(table, other)?.name;
  };
  return er.relations.map((relation) => ({
    ...relation,
    fromColumn: columnOf(relation.from, relation.to),
    toColumn: columnOf(relation.to, relation.from),
  }));
};

/** テーブルの列の名前ごとの説明（補足の `{テーブル}.{列}` の説明、無ければ列のコメント） */
export const erColumnNotes = (
  table: ErTable,
  notes: Record<string, { text?: string | undefined }>,
): Record<string, string> =>
  Object.fromEntries(
    table.columns.flatMap((column) => {
      const text =
        notes[`${table.name}.${column.name}`]?.text ?? column.comment;
      return text === undefined ? [] : [[column.name, text]];
    }),
  );

/** テーブルのノードの幅と大きさ（列を閉じたテーブルはテーブル名の行だけ） */
export const erOverrides = (
  er: ErDiagram,
  collapsed: ReadonlySet<string>,
): Record<string, MapOverride> =>
  Object.fromEntries(
    er.tables.map((table) => [
      table.name,
      {
        width: MAP_ER.width,
        aside: MAP_ER.aside,
        sides: "horizontal",
        size: mapErNodeSize({
          columns: table.columns.length,
          collapsed: collapsed.has(table.name),
        }),
      },
    ]),
  );
