import { type MapData, parseMapData } from "./data.ts";
import { parseErDiagram } from "./er.ts";
import { parseFlowchart } from "./flowchart.ts";
import { lucideIconNames } from "./lucide-names.ts";
import { parseSequence } from "./sequence.ts";
import {
  MAP_ARG_KEYS,
  type MapProblem,
  type ResolvedMapConfig,
} from "./spec.ts";
import { parseStateDiagram } from "./state-diagram.ts";
import { collectMapStructure, type MapRangeSource } from "./structure.ts";

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

/** 補足と Mermaid の中身・設定まで含めて、範囲の書き方の誤りを全て集める */
export const collectMapProblems = (
  range: MapRangeSource,
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
  const shift = (items: MapProblem[], offset: number | undefined) =>
    items.map((item) =>
      item.line === undefined || offset === undefined
        ? { ...item, line: item.line === undefined ? undefined : item.line }
        : { ...item, line: item.line + offset },
    );
  const { data, problems: dataProblems, lines } = parseMapData(range.data);
  const ids = new Set<string>();
  const edgeIds = new Set<string>();
  const classes = new Set<string>();
  /** ER 図のテーブル名 */
  const tables = new Set<string>();
  if (structure.kind === "flowchart") {
    const chart = parseFlowchart(range.mermaid);
    problems.push(...shift(chart.problems, range.mermaidLine));
    for (const node of chart.nodes) {
      ids.add(node.id);
      for (const name of node.classes) classes.add(name);
    }
    for (const group of chart.groups) ids.add(group.id);
    for (const edge of chart.edges) {
      ids.add(edge.id);
      edgeIds.add(edge.id);
    }
  } else if (structure.kind === "erDiagram") {
    const er = parseErDiagram(range.mermaid);
    problems.push(...shift(er.problems, range.mermaidLine));
    for (const table of er.tables) {
      ids.add(table.name);
      tables.add(table.name);
      for (const column of table.columns)
        ids.add(`${table.name}.${column.name}`);
    }
    for (const relation of er.relations) {
      ids.add(relation.id);
      edgeIds.add(relation.id);
    }
    for (const id of Object.keys(data.groups)) ids.add(id);
  } else if (structure.kind === "stateDiagram") {
    const diagram = parseStateDiagram(range.mermaid);
    problems.push(...shift(diagram.problems, range.mermaidLine));
    for (const state of diagram.states) ids.add(state.id);
    for (const composite of diagram.composites) ids.add(composite.id);
    for (const transition of diagram.transitions) {
      ids.add(transition.id);
      edgeIds.add(transition.id);
    }
  } else {
    const sequence = parseSequence(range.mermaid);
    problems.push(...shift(sequence.problems, range.mermaidLine));
    for (const participant of sequence.participants) ids.add(participant.id);
    for (const index of sequence.messages.keys()) ids.add(String(index + 1));
    for (const index of sequence.fragments.keys()) ids.add(String(index));
  }
  problems.push(...shift(dataProblems, range.dataLine));
  /** 補足の中のパスの行を、範囲の開きのマーカーからの行にする */
  const lineOf = (path: string) => {
    const local = lines.get(path);
    return local === undefined || range.dataLine === undefined
      ? undefined
      : local + range.dataLine;
  };
  const ref = (path: string, id: string | undefined) => {
    if (id !== undefined && !ids.has(id)) {
      problems.push({
        kind: "map_unknown_ref",
        line: lineOf(path),
        message: `補足の \`${path}\` が指す \`${id}\` が Mermaid にありません。${REF_HINTS[kind]}`,
      });
    }
  };
  for (const id of Object.keys(data.notes)) ref(`notes.${id}`, id);
  if (structure.kind === "erDiagram")
    problems.push(...groupProblems(data, tables, lineOf));
  for (const id of ids) {
    if (edgeIds.has(id) || !/^[rt]\d+$/.test(id)) continue;
    if (structure.kind !== "erDiagram" && structure.kind !== "stateDiagram")
      continue;
    problems.push({
      kind: "map_invalid_value",
      message: `\`${id}\` は関連・遷移の ID（記載順の \`r{番号}\`・\`t{番号}\`）と同じ名前です。テーブル名・状態の ID を付け直してください。`,
    });
  }
  data.walkthroughs.forEach((step, index) => {
    for (const id of step.nodes) ref(`walkthroughs[${index}].nodes`, id);
    for (const id of step.edges ?? []) ref(`walkthroughs[${index}].edges`, id);
    ref(`walkthroughs[${index}].enter`, step.enter);
  });
  const lineNames = new Set<string>();
  for (const [id, entry] of Object.entries(data.layout)) {
    ref(`layout.${id}`, id);
    ref(`layout.${id}.align`, entry.align);
    if (ids.has(id) && !edgeIds.has(id)) {
      for (const key of ["ends", "via"] as const) {
        if (entry[key] === undefined) continue;
        problems.push({
          kind: "map_invalid_value",
          line: lineOf(`layout.${id}.${key}`),
          message: `補足の \`layout.${id}.${key}\` は線の ID のときだけ記載できます。\`${id}\` はノードかグループです。`,
        });
      }
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
  for (const name of classes) {
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
