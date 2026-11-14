import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import { renderWide } from "../../parts/wide.ts";
import { outermostRanges, pairRanges } from "./blocks.ts";
import type { Mark } from "../marks.ts";
import { featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** `wide` がオンなら、`<!-- wide -->`（`closed` で `narrow`）〜 `<!-- /wide -->` を wide の範囲で囲む。`closed` 以外の引数はスキップした引数にする。範囲の中の wide のマーカーは取り除く */
export const buildWideRanges = (state: StateCore): void => {
  if (!featureOn(state, "wide")) {
    return;
  }
  const tokens = state.tokens;
  const ranges = outermostRanges(pairRanges(tokens, "wide"), tokens.length);
  const opens = new Map(ranges.map((range) => [range.open, range.close]));
  const closes = new Set(ranges.map((range) => range.close));
  const out: Token[] = [];
  for (const [index, token] of tokens.entries()) {
    const mark = markOf(token);
    if (mark?.name !== "wide") {
      out.push(token);
    } else if (mark.closing) {
      if (closes.has(index)) {
        out.push(
          tabBoundaryBlock({
            state,
            html: "</div>",
            boundary: "end",
            source: token,
          }),
        );
      }
    } else {
      out.push(...wideOpen(state, { token, mark, close: opens.get(index) }));
    }
  }
  state.tokens = out;
};

/** wide の開きのマーカーの場所の、範囲の頭（閉じが無ければ記載の警告。範囲の中のマーカーは取り除く） */
const wideOpen = (
  state: StateCore,
  open: { token: Token; mark: Mark; close: number | undefined },
): Token[] => {
  const { token, mark, close } = open;
  if (close === undefined) {
    return [];
  }
  if (close === -1) {
    return [warningBlock(state, unclosedWarning(mark))];
  }
  const rangeState = mark.options.open === false ? "narrow" : "wide";
  const [head = ""] = splitSlots(
    renderWide({ body: SLOT_MARKER, state: rangeState, toggle: false }),
  );
  return [
    tabBoundaryBlock({ state, html: head, boundary: "start", source: token }),
  ];
};
