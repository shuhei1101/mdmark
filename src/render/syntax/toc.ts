import type { StateCore } from "markdown-it";
import { renderToc, type TocHeading } from "../../parts/toc.ts";
import { envOf, featureOn, markOf, ownBlock } from "./tokens.ts";

/** `toc` がオンなら、`toc` の印の場所に文書の h2・h3 の目次を置く */
export function buildToc(state: StateCore): void {
  if (!featureOn(state, "toc")) {
    return;
  }
  const headings = envOf(state)
    .headings.filter((heading) => heading.level === 2 || heading.level === 3)
    .map((heading) => ({ ...heading }) as TocHeading);
  state.tokens = state.tokens.map((token) => {
    const mark = markOf(token);
    if (mark?.name !== "toc" || mark.closing) {
      return token;
    }
    return ownBlock(state, renderToc({ headings }));
  });
}
