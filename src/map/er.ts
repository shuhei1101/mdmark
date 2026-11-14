import { MAP_ER, type MapErRelation, mapErNodeSize } from "../parts/map.ts";
import type { MapGroup } from "./data.ts";
import type { Flowchart, FlowEdge, FlowGroup, FlowNode } from "./flowchart.ts";
import type { MapOverride } from "./layout.ts";
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
export type ErTable = { name: string; columns: ErColumn[] };

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

const NAME = '[^\\s{}:"|]+';
const TABLE_OPEN_RE = new RegExp(`^(${NAME})\\s*\\{$`);
const COLUMN_RE =
  /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/;
const RELATION_RE = new RegExp(
  `^(${NAME})\\s+([|}o][|o])(--|\\.\\.)([|o][|{o])\\s+(${NAME})\\s*:\\s*(?:"([^"]*)"|(.*))$`,
);
/** 参照先のコメント（`参照: {テーブル}.{列}`） */
const REFERENCE_RE = /^参照:\s*([^.\s]+)\./;

/** 読めない行の項目 */
const unreadable = (line: number, raw: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${raw.trim()}\` を読めません。Mermaid の erDiagram の記法（\`{テーブル} ||--o{ {テーブル} : "{ラベル}"\` など）で記載してください。`,
});

/** `erDiagram` の Mermaid を、テーブル・列・関連と読めない行の項目に読む */
export const parseErDiagram = (source: string): ErDiagram => {
  const tables = new Map<string, ErTable>();
  const relations: ErRelation[] = [];
  const problems: MapProblem[] = [];
  const tableOf = (name: string): ErTable => {
    const found = tables.get(name);
    if (found) return found;
    const table: ErTable = { name, columns: [] };
    tables.set(name, table);
    return table;
  };
  let current: { table: ErTable; line: number } | undefined;
  for (const [line, raw] of source.split("\n").entries()) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (line === 0 || text === "") continue;
    if (current) {
      if (text === "}") {
        current = undefined;
        continue;
      }
      const column = COLUMN_RE.exec(text);
      if (column?.[1] && column[2]) {
        current.table.columns.push({
          type: column[1],
          name: column[2],
          keys: column[3]?.split(/\s*,\s*/) ?? [],
          comment: column[4],
        });
      } else problems.push(unreadable(line, raw));
      continue;
    }
    const open = TABLE_OPEN_RE.exec(text);
    if (open?.[1]) {
      current = { table: tableOf(open[1]), line };
      continue;
    }
    const relation = RELATION_RE.exec(text);
    const left = relation?.[2] ? CARDINALITY[relation[2]] : undefined;
    const right = relation?.[4] ? CARDINALITY[relation[4]] : undefined;
    if (!relation?.[1] || !relation[5] || !left || !right) {
      problems.push(unreadable(line, raw));
      continue;
    }
    tableOf(relation[1]);
    tableOf(relation[5]);
    const label = (relation[6] ?? relation[7] ?? "").trim();
    relations.push({
      id: `r${relations.length + 1}`,
      from: relation[1],
      to: relation[5],
      fromCardinality: left,
      toCardinality: right,
      dashed: relation[3] === "..",
      label: label === "" ? undefined : label,
    });
  }
  if (current) {
    problems.push({
      kind: "map_invalid",
      line: current.line,
      message: `テーブル \`${current.table.name}\` の \`{\` に対応する \`}\` がありません。テーブルの最後の行の後に \`}\` を記載してください。`,
    });
  }
  return { tables: [...tables.values()], relations, problems };
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
  const flowGroups: FlowGroup[] = Object.entries(groups).map(([id, group]) => ({
    id,
    title: group.title,
    parent:
      group.parent !== undefined && group.parent in groups
        ? group.parent
        : undefined,
    direction: "TB",
  }));
  const nodes: FlowNode[] = er.tables.map((table) => ({
    id: table.name,
    label: table.name,
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
    direction: "LR",
    nodes,
    groups: flowGroups,
    edges,
    links: {},
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
        size: mapErNodeSize({
          columns: table.columns.length,
          collapsed: collapsed.has(table.name),
        }),
      },
    ]),
  );
