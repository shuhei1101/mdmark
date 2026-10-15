import type { StateCore } from "markdown-it";
import { renderBadge } from "../../parts/badge.ts";
import { markOwn } from "../../parts/own.ts";
import { envOf, featureOn } from "./tokens.ts";

/** バッジにする行内のコードの頭 */
const BADGE_PREFIX = "badge:";

/** バッジにしない印: 頭の `\` を外した `<code>` に戻す */
const ESCAPED_PREFIX = "badge\\:";

/** `badge` がオンなら、頭が `badge:` の行内のコードをバッジにし、`badge\:` のものは `\` を外したコードにする */
export function buildBadges(state: StateCore): void {
  if (!featureOn(state, "badge")) {
    return;
  }
  const nonce = envOf(state).nonce;
  for (const token of state.tokens) {
    for (const child of token.children ?? []) {
      if (child.type !== "code_inline") {
        continue;
      }
      if (child.content.startsWith(BADGE_PREFIX)) {
        child.type = "html_inline";
        child.content = markOwn(
          renderBadge({ label: child.content.slice(BADGE_PREFIX.length) }),
          nonce,
        );
      } else if (child.content.startsWith(ESCAPED_PREFIX)) {
        child.content = `${BADGE_PREFIX}${child.content.slice(ESCAPED_PREFIX.length)}`;
      }
    }
  }
}
