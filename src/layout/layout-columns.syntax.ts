import type { StateCore, Token } from "markdown-it";
import type { Mark } from "../render/marks.ts";
import { SLOT_MARKER, splitSlots } from "../shared/own.logic.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "../shared/syntax-warning.syntax.ts";
import {
  featureOn,
  markOf,
  tabBoundaryBlock,
} from "../shared/tokens.syntax.ts";
import { renderLayoutColumns } from "./layout-columns.part.ts";

/** 並べられる列の数の下限と上限 */
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 3;

/** 外側の columns の範囲 1 つ */
type ColumnsRange = {
  open: number;
  close: number;
  separators: number[];
  nested: number[];
};

/** columns の範囲を集める途中の状態 */
type RangeCollector = {
  ranges: ColumnsRange[];
  current: ColumnsRange | undefined;
  depth: number;
};

/** columns の開きのマーカーを読む。外側の範囲の中なら入れ子の開きにする */
const openRange = (collector: RangeCollector, index: number): void => {
  if (collector.current === undefined) {
    collector.current = { open: index, close: -1, separators: [], nested: [] };
  } else {
    collector.current.nested.push(index);
  }
  collector.depth += 1;
};

/** columns の閉じのマーカーを読む。外側の範囲の閉じなら範囲を集め終える */
const closeRange = (collector: RangeCollector, index: number): void => {
  const current = collector.current;
  if (!current) {
    return;
  }
  collector.depth -= 1;
  if (collector.depth === 0) {
    current.close = index;
    collector.ranges.push(current);
    collector.current = undefined;
  }
};

/** 外側の columns の範囲を、区切りと入れ子の開きの位置とあわせて集める */
const collectRanges = (tokens: Token[]): ColumnsRange[] => {
  const collector: RangeCollector = {
    ranges: [],
    current: undefined,
    depth: 0,
  };
  for (const [index, token] of tokens.entries()) {
    const mark = markOf(token);
    if (mark?.name === "columns") {
      if (mark.closing) {
        closeRange(collector, index);
      } else {
        openRange(collector, index);
      }
    } else if (mark?.name === "column" && collector.depth === 1) {
      collector.current?.separators.push(index);
    }
  }
  if (collector.current) {
    collector.ranges.push(collector.current);
  }
  return collector.ranges;
};

/** 列の数が 2〜3 でない範囲の警告 */
const countWarning = (mark: Mark, count: number): SyntaxWarning => ({
  mark: mark.raw,
  message:
    count < MIN_COLUMNS
      ? `の範囲が ${count} 列です。横に並べられるのは ${MIN_COLUMNS}〜${MAX_COLUMNS} 列です。\`<!-- column -->\` で区切ってください。中身を記載した順に表示しています。`
      : `の範囲が ${count} 列です。横に並べられるのは ${MIN_COLUMNS}〜${MAX_COLUMNS} 列です。\`<!-- column -->\` を減らしてください。中身を記載した順に表示しています。`,
});

/** 範囲が閉じていないか、列の数が 2〜3 でなければ、開きのマーカーに配置する警告を返却する */
const rangeProblem = (
  range: ColumnsRange,
  mark: Mark,
): SyntaxWarning | undefined => {
  if (range.close < 0) {
    return unclosedWarning(mark);
  }
  const count = range.separators.length + 1;
  return count < MIN_COLUMNS || count > MAX_COLUMNS
    ? countWarning(mark, count)
    : undefined;
};

/** 段組みで囲む範囲の、開き・区切り・閉じのマーカーの代わりに配置する段組みの境界のトークン */
const columnsBoundaries = (
  state: StateCore,
  range: ColumnsRange,
): Array<[number, Token[]]> => {
  const tokens = state.tokens;
  const count = range.separators.length + 1;
  const pieces = splitSlots(
    renderLayoutColumns({ columns: Array(count).fill(SLOT_MARKER) }),
  );
  const boundary = (
    index: number,
    html: string,
    kind: "start" | "between" | "end",
  ): [number, Token[]] => [
    index,
    [
      tabBoundaryBlock({
        state,
        html,
        boundary: kind,
        source: tokens[index],
      }),
    ],
  ];
  // 列の間は、前の列の終わりと次の列の始まり
  const between = pieces[1] ?? "";
  return [
    boundary(range.open, pieces[0] ?? "", "start"),
    ...range.separators.map((separator) =>
      boundary(separator, between, "between"),
    ),
    boundary(range.close, pieces.at(-1) ?? "", "end"),
  ];
};

/** 範囲 1 つの、マーカーの位置ごとに代わりに配置するトークン（空の配列はマーカーを取り除く） */
const rangeReplacements = (
  state: StateCore,
  range: ColumnsRange,
): Array<[number, Token[]]> => {
  const tokens = state.tokens;
  const mark = markOf(tokens[range.open]) as Mark;
  const nested = range.nested.map((index): [number, Token[]] => [
    index,
    [
      warningBlock(state, {
        mark: (markOf(tokens[index]) as Mark).raw,
        message:
          "の columns の範囲は、columns の範囲の中に入れ子にできません。内側の範囲は横に並べずに、中身を記載した順に表示しています。",
      }),
    ],
  ]);
  const problem = rangeProblem(range, mark);
  if (problem === undefined) {
    return [...nested, ...columnsBoundaries(state, range)];
  }
  return [
    ...nested,
    [range.open, [warningBlock(state, problem)]],
    ...range.separators.map((separator): [number, Token[]] => [separator, []]),
  ];
};

/** `columns` がオンなら、`<!-- columns -->` 〜 `<!-- /columns -->` を `<!-- column -->` で区切り、2〜3 列なら段組みで囲む。列の数が合わない範囲と入れ子の内側は警告を差し込んで囲まない */
export const buildLayoutColumns = (state: StateCore): void => {
  if (!featureOn(state, "columns")) {
    return;
  }
  const tokens = state.tokens;
  const replace = new Map<number, Token[]>(
    collectRanges(tokens).flatMap((range) => rangeReplacements(state, range)),
  );
  state.tokens = tokens.flatMap(
    (token, index) => replace.get(index) ?? [token],
  );
};
