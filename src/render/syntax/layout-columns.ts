import type { StateCore, Token } from "markdown-it";
import { renderLayoutColumns } from "../../parts/layout-columns.ts";
import { SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import type { Mark } from "../marks.ts";
import { featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

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

/** 外側の columns の範囲を、区切りと入れ子の開きの位置とあわせて集める */
const collectRanges = (tokens: Token[]): ColumnsRange[] => {
  const ranges: ColumnsRange[] = [];
  let current: ColumnsRange | undefined;
  let depth = 0;
  for (const [index, token] of tokens.entries()) {
    const mark = markOf(token);
    if (mark?.name === "columns" && !mark.closing) {
      if (current === undefined) {
        current = { open: index, close: -1, separators: [], nested: [] };
      } else {
        current.nested.push(index);
      }
      depth += 1;
    } else if (mark?.name === "columns" && mark.closing && current) {
      depth -= 1;
      if (depth === 0) {
        current.close = index;
        ranges.push(current);
        current = undefined;
      }
    } else if (mark?.name === "column" && current && depth === 1) {
      current.separators.push(index);
    }
  }
  if (current) {
    ranges.push(current);
  }
  return ranges;
};

/** 列の数が 2〜3 でない範囲の警告 */
const countWarning = (mark: Mark, count: number): SyntaxWarning => ({
  mark: mark.raw,
  message:
    count < MIN_COLUMNS
      ? `の範囲が ${count} 列です。横に並べられるのは ${MIN_COLUMNS}〜${MAX_COLUMNS} 列です。\`<!-- column -->\` で区切ってください。中身を記載した順に表示しています。`
      : `の範囲が ${count} 列です。横に並べられるのは ${MIN_COLUMNS}〜${MAX_COLUMNS} 列です。\`<!-- column -->\` を減らしてください。中身を記載した順に表示しています。`,
});

/** `columns` がオンなら、`<!-- columns -->` 〜 `<!-- /columns -->` を `<!-- column -->` で区切り、2〜3 列なら段組みで囲む。列の数が合わない範囲と入れ子の内側は警告を差し込んで囲まない */
export const buildLayoutColumns = (state: StateCore): void => {
  if (!featureOn(state, "columns")) {
    return;
  }
  const tokens = state.tokens;
  // 位置ごとに、マーカーの代わりに配置するトークン（空の配列はマーカーを取り除く）
  const replace = new Map<number, Token[]>();
  for (const range of collectRanges(tokens)) {
    const open = tokens[range.open] as Token;
    const mark = markOf(open) as Mark;
    for (const nested of range.nested) {
      const nestedMark = markOf(tokens[nested]) as Mark;
      replace.set(nested, [
        warningBlock(state, {
          mark: nestedMark.raw,
          message:
            "の columns の範囲は、columns の範囲の中に入れ子にできません。内側の範囲は横に並べずに、中身を記載した順に表示しています。",
        }),
      ]);
    }
    if (range.close < 0) {
      replace.set(range.open, [warningBlock(state, unclosedWarning(mark))]);
      for (const separator of range.separators) {
        replace.set(separator, []);
      }
      continue;
    }
    const count = range.separators.length + 1;
    if (count < MIN_COLUMNS || count > MAX_COLUMNS) {
      replace.set(range.open, [warningBlock(state, countWarning(mark, count))]);
      for (const separator of range.separators) {
        replace.set(separator, []);
      }
      continue;
    }
    const pieces = splitSlots(
      renderLayoutColumns({ columns: Array(count).fill(SLOT_MARKER) }),
    );
    const head = pieces[0] ?? "";
    const tail = pieces.at(-1) ?? "";
    // 列の間は、前の列の終わりと次の列の始まり
    const between = pieces[1] ?? "";
    replace.set(range.open, [
      tabBoundaryBlock({ state, html: head, boundary: "start", source: open }),
    ]);
    for (const separator of range.separators) {
      replace.set(separator, [
        tabBoundaryBlock({
          state,
          html: between,
          boundary: "between",
          source: tokens[separator],
        }),
      ]);
    }
    replace.set(range.close, [
      tabBoundaryBlock({
        state,
        html: tail,
        boundary: "end",
        source: tokens[range.close],
      }),
    ]);
  }
  state.tokens = tokens.flatMap(
    (token, index) => replace.get(index) ?? [token],
  );
};
