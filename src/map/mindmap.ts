import { joinMarkdownStrings, plainMarkdownLabel } from "./flowchart.ts";
import type { MapProblem } from "./spec.ts";

/** マインドマップの項目の形状 */
export type MindmapShape =
  | "square"
  | "rounded"
  | "circle"
  | "bang"
  | "cloud"
  | "hexagon"
  | "plain";

/** マインドマップの項目 1 つ。親子は記載の順の番号で持つ */
export type MindmapItem = {
  /** 記載の順の番号（根が 0） */
  order: number;
  /** 形状の記号の前に記載した文字 */
  id: string | undefined;
  /** 表示する文字 */
  label: string;
  shape: MindmapShape;
  /** 親の `order`（根は無い） */
  parent: number | undefined;
  /** 子の `order`（記載の順） */
  children: number[];
  /** 補足とマーカーの引数の `focus` が指すキー */
  key: string;
  /** 状態の保存と描画が項目を区別するキー */
  stateKey: string;
};

/** `parseMindmap` の戻り値 */
export type Mindmap = {
  root: MindmapItem | undefined;
  /** 記載の順（根が先頭） */
  items: MindmapItem[];
  /** ID を持たない 2 つ以上の項目が使う表示する文字 */
  ambiguous: ReadonlySet<string>;
  problems: MapProblem[];
};

/** 形状の記号（外側の記号から順に照らす）。1 つ目の組が ID、2 つ目の組が表示する文字 */
const SHAPE_PATTERNS: ReadonlyArray<readonly [MindmapShape, RegExp]> = [
  ["circle", /^(.*?)\(\((.+)\)\)$/s],
  ["bang", /^(.*?)\)\)(.+)\(\($/s],
  ["cloud", /^(.*?)\)(.+)\($/s],
  ["hexagon", /^(.*?)\{\{(.+)\}\}$/s],
  ["rounded", /^(.*?)\((.+)\)$/s],
  ["square", /^(.*?)\[(.+)\]$/s],
];

/** 描かずに読み飛ばす行（`::icon()` と `:::` のクラス） */
const SKIPPED_LINE_RE = /^(::icon\(|:::)/;

/** 行の文字を形状・ID・表示する文字にする */
const readShape = (
  raw: string,
): { shape: MindmapShape; id: string | undefined; label: string } => {
  // 後ろの `:::{クラス}` は色の指定のため、表示する文字に含めない
  const text = raw.replace(/:::[\w\s-]+$/, "").trim();
  for (const [shape, pattern] of SHAPE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const id = (match[1] ?? "").trim();
    return {
      shape,
      id: id === "" ? undefined : id,
      label: labelOf(match[2] ?? ""),
    };
  }
  return { shape: "plain", id: undefined, label: labelOf(text) };
};

/** 表示する文字（引用符と Markdown の文字の記号を除く） */
const labelOf = (text: string): string =>
  plainMarkdownLabel(text.trim().replace(/^"([\s\S]*)"$/, "$1")).trim();

/** 2 つ目の根の行の項目 */
const secondRoot = (line: number, text: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${text}\` は根より浅いか同じ字下げのため、2 つ目の根になります。マインドマップの根は 1 つにし、この行を根より深く字下げしてください。`,
});

/** ID を持たない項目の表示する文字のうち、2 つ以上の項目が使うもの */
const ambiguousLabels = (items: MindmapItem[]): Set<string> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.id === undefined)
      counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  }
  return new Set(
    [...counts].flatMap(([label, count]) => (count > 1 ? [label] : [])),
  );
};

/** 読み取りの途中の値 */
type ParseState = {
  items: MindmapItem[];
  problems: MapProblem[];
  /** 字下げの浅い順に並べた、親になりうる項目と字下げ */
  stack: Array<{ item: MindmapItem; indent: number }>;
  rootIndent: number | undefined;
};

/** 項目の行でない（1 行目・空の行・コメント・`::icon()`・`:::`）か */
const isSkipped = (line: number, text: string): boolean =>
  line === 0 ||
  text === "" ||
  text.startsWith("%%") ||
  SKIPPED_LINE_RE.test(text);

/** 字下げがより浅い最も近い項目（より深いか同じ字下げの項目は親の候補から除く） */
const parentAt = (
  state: ParseState,
  indent: number,
): MindmapItem | undefined => {
  while ((state.stack.at(-1)?.indent ?? -1) >= indent) state.stack.pop();
  return state.stack.at(-1)?.item;
};

/** 項目の行 1 つを、直前までの項目のうち字下げがより浅い最も近い項目の子にする */
const readItemLine = (state: ParseState, raw: string, line: number): void => {
  const text = raw.trim();
  if (isSkipped(line, text)) return;
  const indent = raw.length - raw.trimStart().length;
  if (state.rootIndent !== undefined && indent <= state.rootIndent) {
    state.problems.push(secondRoot(line, text));
    return;
  }
  const parent = parentAt(state, indent);
  const shape = readShape(text);
  const item: MindmapItem = {
    order: state.items.length,
    ...shape,
    parent: parent?.order,
    children: [],
    key: shape.id ?? shape.label,
    stateKey: shape.id ?? shape.label,
  };
  parent?.children.push(item.order);
  state.rootIndent ??= indent;
  state.items.push(item);
  state.stack.push({ item, indent });
};

/** `mindmap` の Mermaid を、字下げで親子を決めた項目の木と、読めない行の項目に読む */
export const parseMindmap = (source: string): Mindmap => {
  const state: ParseState = {
    items: [],
    problems: [],
    stack: [],
    rootIndent: undefined,
  };
  joinMarkdownStrings(source.split(/\r?\n/)).forEach((raw, line) => {
    readItemLine(state, raw, line);
  });
  const { items, problems } = state;
  const ambiguous = ambiguousLabels(items);
  for (const item of items) {
    if (item.id === undefined && ambiguous.has(item.label))
      item.stateKey = `n${item.order}`;
  }
  return { root: items[0], items, ambiguous, problems };
};

/** 補足とマーカーの引数の `focus` のキーが指す項目 */
export const mindmapItemOf = (options: {
  mindmap: Mindmap;
  key: string;
}):
  | { kind: "found"; item: MindmapItem }
  | { kind: "ambiguous" }
  | { kind: "missing" } => {
  const { mindmap, key } = options;
  const byId = mindmap.items.find((item) => item.id === key);
  if (byId) return { kind: "found", item: byId };
  if (mindmap.ambiguous.has(key)) return { kind: "ambiguous" };
  const byLabel = mindmap.items.find(
    (item) => item.id === undefined && item.label === key,
  );
  return byLabel ? { kind: "found", item: byLabel } : { kind: "missing" };
};
