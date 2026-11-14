import { type MapData, parseMapData } from "./data.ts";
import { parseErDiagram } from "./er.ts";
import { mapLinkProblems, parseFlowchart } from "./flowchart.ts";
import { lucideIconNames } from "./lucide-names.ts";
import { parseSequence } from "./sequence.ts";
import {
  MAP_ARG_KEYS,
  type MapProblem,
  type ResolvedMapConfig,
} from "./spec.ts";
import { parseStateDiagram } from "./state-diagram.ts";
import {
  collectMapStructure,
  type MapKindName,
  type MapRangeSource,
} from "./structure.ts";

export {
  collectMapStructure,
  type MapKindName,
  type MapRangeSource,
  mapKindOf,
} from "./structure.ts";

/** 補足が指す無い ID の項目の、図の種類ごとの修正方法 */
const REF_HINTS = {
  flowchart: "Mermaid のノード・線・グループの ID にしてください。",
  sequenceDiagram:
    "Mermaid の参加者の ID か、メッセージ・ブロックの番号にしてください。",
  erDiagram:
    "テーブル名・`{テーブル}.{列}`・関連の記載順の `r{番号}`・分類の ID にしてください。",
  stateDiagram: "状態の ID か、遷移の ID を記載順の `t{番号}` にしてください。",
} as const;

/** ER 図の補足の groups の、無いテーブル・無い親・2 つの分類に入るテーブル・テーブル名と同じ分類の ID の項目 */
const groupProblems = (
  data: MapData,
  tables: Set<string>,
  lineOf: (path: string) => number | undefined,
): MapProblem[] => {
  const problems: MapProblem[] = [];
  const owner = new Map<string, string>();
  for (const [id, group] of Object.entries(data.groups)) {
    const path = `groups.${id}`;
    if (tables.has(id))
      problems.push({
        kind: "map_invalid_value",
        line: lineOf(path),
        message: `分類の ID \`${id}\` がテーブル名と同じです。分類の ID を付け直してください。`,
      });
    for (const table of group.tables) {
      const first = owner.get(table);
      if (!tables.has(table))
        problems.push({
          kind: "map_unknown_ref",
          line: lineOf(`${path}.tables`),
          message: `補足の \`${path}.tables\` の \`${table}\` が Mermaid のテーブルにありません。テーブル名にしてください。`,
        });
      else if (first !== undefined)
        problems.push({
          kind: "map_invalid_value",
          line: lineOf(`${path}.tables`),
          message: `テーブル \`${table}\` が分類 \`${first}\` と \`${id}\` の 2 つに入っています。1 つの分類にだけ入れてください。`,
        });
      else owner.set(table, id);
    }
    if (group.parent !== undefined && !(group.parent in data.groups))
      problems.push({
        kind: "map_unknown_ref",
        line: lineOf(`${path}.parent`),
        message: `補足の \`${path}.parent\` の \`${group.parent}\` が補足の分類にありません。分類の ID にしてください。`,
      });
  }
  return problems;
};

/** 項目の行を、範囲の開きのマーカーからの行にずらす（`offset` が無ければ行を持たせたまま） */
const shiftProblems = (
  items: MapProblem[],
  offset: number | undefined,
): MapProblem[] =>
  items.map((item) =>
    item.line === undefined || offset === undefined
      ? { ...item, line: item.line === undefined ? undefined : item.line }
      : { ...item, line: item.line + offset },
  );

/** Mermaid が持つ ID と、その読み取りの項目 */
type MermaidIds = {
  /** ノード・線・グループ・参加者などの ID */
  ids: Set<string>;
  /** 線・関連・遷移の ID */
  edgeIds: Set<string>;
  /** ノードのクラス */
  classes: Set<string>;
  /** ER 図のテーブル名 */
  tables: Set<string>;
  /** Mermaid の読み取りの項目（範囲の開きのマーカーからの行） */
  problems: MapProblem[];
  /** ノードのリンク先の項目 */
  linkProblems: MapProblem[];
};

/** 空の `MermaidIds` */
const emptyMermaidIds = (problems: MapProblem[]): MermaidIds => ({
  ids: new Set(),
  edgeIds: new Set(),
  classes: new Set(),
  tables: new Set(),
  problems,
  linkProblems: [],
});

/** フローチャートの ID */
const flowchartIds = (mermaid: string, line: number | undefined) => {
  const chart = parseFlowchart(mermaid);
  const found = emptyMermaidIds(shiftProblems(chart.problems, line));
  found.linkProblems.push(...mapLinkProblems(chart.links).problems);
  for (const node of chart.nodes) {
    found.ids.add(node.id);
    for (const name of node.classes) found.classes.add(name);
  }
  for (const group of chart.groups) found.ids.add(group.id);
  for (const edge of chart.edges) {
    found.ids.add(edge.id);
    found.edgeIds.add(edge.id);
  }
  return found;
};

/** ER 図の ID（補足の分類の ID を含む） */
const erIds = (
  mermaid: string,
  line: number | undefined,
  data: MapData,
): MermaidIds => {
  const er = parseErDiagram(mermaid);
  const found = emptyMermaidIds(shiftProblems(er.problems, line));
  for (const table of er.tables) {
    found.ids.add(table.name);
    found.tables.add(table.name);
    for (const column of table.columns)
      found.ids.add(`${table.name}.${column.name}`);
  }
  for (const relation of er.relations) {
    found.ids.add(relation.id);
    found.edgeIds.add(relation.id);
  }
  for (const id of Object.keys(data.groups)) found.ids.add(id);
  return found;
};

/** 状態遷移図の ID */
const stateIds = (mermaid: string, line: number | undefined): MermaidIds => {
  const diagram = parseStateDiagram(mermaid);
  const found = emptyMermaidIds(shiftProblems(diagram.problems, line));
  for (const state of diagram.states) found.ids.add(state.id);
  for (const composite of diagram.composites) found.ids.add(composite.id);
  for (const transition of diagram.transitions) {
    found.ids.add(transition.id);
    found.edgeIds.add(transition.id);
  }
  return found;
};

/** シーケンス図の ID（参加者の ID と、メッセージ・ブロックの番号） */
const sequenceIds = (mermaid: string, line: number | undefined): MermaidIds => {
  const sequence = parseSequence(mermaid);
  const found = emptyMermaidIds(shiftProblems(sequence.problems, line));
  for (const participant of sequence.participants)
    found.ids.add(participant.id);
  for (const index of sequence.messages.keys())
    found.ids.add(String(index + 1));
  for (const index of sequence.fragments.keys()) found.ids.add(String(index));
  return found;
};

/** 図の種類ごとに Mermaid を読み、ID を集める */
const mermaidIdsOf = (
  kind: MapKindName,
  source: { mermaid: string; line: number | undefined; data: MapData },
): MermaidIds => {
  const { mermaid, line, data } = source;
  switch (kind) {
    case "flowchart":
      return flowchartIds(mermaid, line);
    case "erDiagram":
      return erIds(mermaid, line, data);
    case "stateDiagram":
      return stateIds(mermaid, line);
    default:
      return sequenceIds(mermaid, line);
  }
};

/** 補足の項目を確かめるときに引く値 */
type DataContext = {
  kind: MapKindName;
  found: MermaidIds;
  data: MapData;
  config: ResolvedMapConfig;
  /** 補足の中のパスの行を、範囲の開きのマーカーからの行にする */
  lineOf: (path: string) => number | undefined;
  /** 補足の `path` が指す `id` が Mermaid に無ければ、項目を足す */
  ref: (path: string, id: string | undefined) => void;
  problems: MapProblem[];
};

/** 文書の注記の定義の ID を受けたときだけ、定義の無い注記の参照を確かめる */
const annotationProblems = (
  context: DataContext,
  annotationIds: ReadonlySet<string> | undefined,
): MapProblem[] => {
  if (annotationIds === undefined) return [];
  return Object.entries(context.data.notes).flatMap(([id, note]) =>
    (note.annotations ?? [])
      .filter((annotation) => !annotationIds.has(annotation))
      .map(
        (annotation): MapProblem => ({
          kind: "annotation_undefined",
          line: context.lineOf(`notes.${id}.annotations`),
          message: `補足の \`notes.${id}.annotations\` が指す注記 \`※[${annotation}]\` の定義がありません。\`※[${annotation}]: 本文\` を記載するか、ID を修正してください。`,
        }),
      ),
  );
};

/** ER 図・状態遷移図で、関連・遷移の ID と同じ名前のテーブル名・状態の ID の項目 */
const reservedIdProblems = (context: DataContext): MapProblem[] => {
  const { kind, found } = context;
  if (kind !== "erDiagram" && kind !== "stateDiagram") return [];
  return [...found.ids]
    .filter((id) => !found.edgeIds.has(id) && /^[rt]\d+$/.test(id))
    .map((id) => ({
      kind: "map_invalid_value",
      message: `\`${id}\` は関連・遷移の ID（記載順の \`r{番号}\`・\`t{番号}\`）と同じ名前です。テーブル名・状態の ID を付け直してください。`,
    }));
};

/** 補足の layout の項目（無い ID・ノードとグループの線だけのキー・設定に無い線の種類） */
const checkLayout = (context: DataContext): void => {
  const { found, data, config, lineOf, ref, problems } = context;
  const lineNames = new Set<string>();
  for (const [id, entry] of Object.entries(data.layout)) {
    ref(`layout.${id}`, id);
    ref(`layout.${id}.align`, entry.align);
    if (found.ids.has(id) && !found.edgeIds.has(id)) {
      problems.push(...edgeOnlyProblems({ id, entry, lineOf }));
    }
    if (
      entry.line !== undefined &&
      !(entry.line in config.lines) &&
      !lineNames.has(entry.line)
    ) {
      lineNames.add(entry.line);
      problems.push({
        kind: "map_unknown_line",
        message: `補足の \`layout.${id}.line\` の \`${entry.line}\` が設定の \`map.lines\` にありません。\`map.lines\` に記載するか、名前を修正してください。既定の線で描いています。`,
      });
    }
  }
};

/** ノードかグループの layout に、線の ID のときだけ記載できるキーがある項目 */
const edgeOnlyProblems = (item: {
  id: string;
  entry: MapData["layout"][string];
  lineOf: (path: string) => number | undefined;
}): MapProblem[] => {
  const { id, entry, lineOf } = item;
  return (["ends", "via"] as const)
    .filter((key) => entry[key] !== undefined)
    .map((key) => ({
      kind: "map_invalid_value",
      line: lineOf(`layout.${id}.${key}`),
      message: `補足の \`layout.${id}.${key}\` は線の ID のときだけ記載できます。\`${id}\` はノードかグループです。`,
    }));
};

/** 補足と Mermaid の中身・設定まで含めて、範囲の書き方の誤りを全て集める。`range.annotationIds` を指定すると、定義の無い注記の参照も確かめる */
export const collectMapProblems = (
  range: MapRangeSource & { annotationIds?: ReadonlySet<string> | undefined },
  config: ResolvedMapConfig,
  includeUnknownKeys: boolean,
): MapProblem[] => {
  const structure = collectMapStructure(range);
  if (structure.kind === undefined || range.mermaid === undefined)
    return structure.problems;
  const problems: MapProblem[] = [...structure.problems];
  const kind = structure.kind;
  if (includeUnknownKeys) {
    for (const key of structure.args.unknownKeys) {
      problems.push({
        kind: "map_unknown_key",
        message: `マーカーの引数に知らないキー \`${key}\` があります。使用できるキーは ${MAP_ARG_KEYS.map((name) => `\`${name}\``).join("・")} です。`,
      });
    }
  }
  const { data, problems: dataProblems, lines } = parseMapData(range.data);
  const found = mermaidIdsOf(kind, {
    mermaid: range.mermaid,
    line: range.mermaidLine,
    data,
  });
  problems.push(
    ...found.problems,
    ...shiftProblems(dataProblems, range.dataLine),
  );
  const lineOf = (path: string) => {
    const local = lines.get(path);
    return local === undefined || range.dataLine === undefined
      ? undefined
      : local + range.dataLine;
  };
  const ref = (path: string, id: string | undefined) => {
    if (id !== undefined && !found.ids.has(id)) {
      problems.push({
        kind: "map_unknown_ref",
        line: lineOf(path),
        message: `補足の \`${path}\` が指す \`${id}\` が Mermaid にありません。${REF_HINTS[kind]}`,
      });
    }
  };
  const context: DataContext = {
    kind,
    found,
    data,
    config,
    lineOf,
    ref,
    problems,
  };
  for (const id of Object.keys(data.notes)) ref(`notes.${id}`, id);
  problems.push(...annotationProblems(context, range.annotationIds));
  if (kind === "erDiagram")
    problems.push(...groupProblems(data, found.tables, lineOf));
  problems.push(...reservedIdProblems(context));
  data.walkthroughs.forEach((step, index) => {
    for (const id of step.nodes) ref(`walkthroughs[${index}].nodes`, id);
    for (const id of step.edges ?? []) ref(`walkthroughs[${index}].edges`, id);
    ref(`walkthroughs[${index}].enter`, step.enter);
  });
  checkLayout(context);
  problems.push(...found.linkProblems);
  for (const name of found.classes) {
    if (!(name in config.kinds)) {
      problems.push({
        kind: "map_unknown_class",
        message: `ノードのクラス \`${name}\` が設定の \`map.kinds\` にありません。\`map.kinds\` に記載するか、クラスを修正してください。種類の行の無いノードで描いています。`,
      });
    }
  }
  return problems;
};

/** 設定の map.kinds の icon のうち Lucide に無い名前を項目にする（Schema の検査は validateConfig） */
export const checkMapConfig = (
  map: unknown,
): Array<{ key: string; message: string }> => {
  const issues: Array<{ key: string; message: string }> = [];
  if (typeof map !== "object" || map === null) return issues;
  const kinds = (map as { kinds?: unknown }).kinds;
  if (typeof kinds !== "object" || kinds === null) return issues;
  for (const [name, kind] of Object.entries(kinds)) {
    const icon = (kind as { icon?: unknown } | null)?.icon;
    if (typeof icon === "string" && !lucideIconNames().has(icon)) {
      issues.push({
        key: `map.kinds.${name}.icon`,
        message: `\`${icon}\` は Lucide のアイコンの名前にありません。Lucide のアイコンの名前（\`database\` など）にしてください。`,
      });
    }
  }
  return issues;
};
