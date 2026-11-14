import { parseMapData } from "./data.ts";
import { mapLinkProblems, parseFlowchart } from "./flowchart.ts";
import { lucideIconNames } from "./lucide-names.ts";
import { parseSequence } from "./sequence.ts";
import {
  MAP_ARG_KEYS,
  type MapProblem,
  type ResolvedMapConfig,
} from "./spec.ts";
import { collectMapStructure, type MapRangeSource } from "./structure.ts";

export {
  collectMapStructure,
  type MapKindName,
  type MapRangeSource,
  mapKindOf,
} from "./structure.ts";

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
  const linkProblems: MapProblem[] = [];
  if (structure.kind === "flowchart") {
    const chart = parseFlowchart(range.mermaid);
    problems.push(...shift(chart.problems, range.mermaidLine));
    linkProblems.push(...mapLinkProblems(chart.links).problems);
    for (const node of chart.nodes) {
      ids.add(node.id);
      for (const name of node.classes) classes.add(name);
    }
    for (const group of chart.groups) ids.add(group.id);
    for (const edge of chart.edges) {
      ids.add(edge.id);
      edgeIds.add(edge.id);
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
        message: `補足の \`${path}\` が指す \`${id}\` が Mermaid にありません。Mermaid のノード・線・グループの ID にしてください。`,
      });
    }
  };
  for (const id of Object.keys(data.notes)) ref(`notes.${id}`, id);
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
  problems.push(...linkProblems);
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
