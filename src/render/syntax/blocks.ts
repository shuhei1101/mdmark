import type { StateCore, Token } from "markdown-it";
import { markOf } from "./tokens.ts";
import { type SyntaxWarning, warningBlock } from "./warnings.ts";

/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返す */
export const blockStartOf = (tokens: Token[], index: number): number => {
  let at = index;
  while (at > 0 && (tokens[at]?.level ?? 0) > 0) {
    at -= 1;
  }
  return at;
};

/** 行内のトークンの位置ごとに控えた警告を、それを含むブロックの前に差し込む（後ろから差し込んで位置をずらさない） */
export const insertWarningsBeforeBlocks = (
  state: StateCore,
  warnings: Array<{ index: number; warning: SyntaxWarning }>,
): void => {
  for (const { index, warning } of [...warnings].reverse()) {
    state.tokens.splice(
      blockStartOf(state.tokens, index),
      0,
      warningBlock(state, warning),
    );
  }
};

/** 名前の範囲の印を、入れ子を数えて開きと閉じの組にする。閉じの無い開きは `-1` に対応させる */
export const pairRanges = (
  tokens: Token[],
  name: string,
): Map<number, number> => {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (const [index, token] of tokens.entries()) {
    const mark = markOf(token);
    if (mark?.name !== name) {
      continue;
    }
    if (!mark.closing) {
      stack.push(index);
      continue;
    }
    const open = stack.pop();
    if (open !== undefined) {
      pairs.set(open, index);
    }
  }
  for (const open of stack) {
    pairs.set(open, -1);
  }
  return pairs;
};

/** `pairRanges` の組のうち、ほかの組の中に入っていない組だけを開きの順に返す */
export const outermostRanges = (
  pairs: Map<number, number>,
  length: number,
): Array<{ open: number; close: number }> => {
  const sorted = [...pairs].sort(([a], [b]) => a - b);
  const result: Array<{ open: number; close: number }> = [];
  let end = -1;
  for (const [open, close] of sorted) {
    if (open < end) {
      continue;
    }
    result.push({ open, close });
    end = close < 0 ? length : close;
  }
  return result;
};
