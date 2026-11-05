import type { StateCore } from "markdown-it";
import { featureOn, markOf, ownBlock } from "./tokens.ts";

/** 改ページの要素 */
const PAGEBREAK_HTML =
  '<div class="mdmark-pagebreak" aria-hidden="true"></div>';

/** `pagebreak` がオンなら `<!-- pagebreak -->` を改ページの要素にする（オフの印は `dropMarks` が取り除く） */
export const buildPagebreaks = (state: StateCore): void => {
  if (!featureOn(state, "pagebreak")) {
    return;
  }
  state.tokens = state.tokens.map((token) => {
    const mark = markOf(token);
    return mark?.name === "pagebreak" && !mark.closing
      ? ownBlock(state, PAGEBREAK_HTML, token)
      : token;
  });
};
