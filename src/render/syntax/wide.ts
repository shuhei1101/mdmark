import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import { renderWide } from "../../parts/wide.ts";
import { outermostRanges, pairRanges } from "./blocks.ts";
import { featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import {
  skippedArgBlocks,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

/** `wide` がオンなら、`<!-- wide -->`（`closed` で `narrow`）〜 `<!-- /wide -->` を wide の範囲で囲む。`closed` 以外の引数は読み飛ばした引数にする。範囲の中の wide の印は取り除く */
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
      continue;
    }
    if (mark.closing) {
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
      continue;
    }
    const close = opens.get(index);
    if (close === undefined) {
      continue;
    }
    if (close === -1) {
      out.push(warningBlock(state, unclosedWarning(mark)));
      continue;
    }
    const args = mark.args.args;
    const skipped = [
      ...args.filter((arg) => arg !== "closed"),
      ...Object.keys(mark.args.keys).map((key) => `${key}=`),
    ].map((arg) => ({ arg, usable: "`closed`" }));
    out.push(...skippedArgBlocks(state, { mark: mark.raw, skipped }, token));
    const rangeState = args.includes("closed") ? "narrow" : "wide";
    const [head = ""] = splitSlots(
      renderWide({ body: SLOT_MARKER, state: rangeState, toggle: false }),
    );
    out.push(
      tabBoundaryBlock({ state, html: head, boundary: "start", source: token }),
    );
  }
  state.tokens = out;
};
