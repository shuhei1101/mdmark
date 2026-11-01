import type { StateCore } from "markdown-it";
import { renderBadge } from "../../parts/badge.ts";
import { type ColorName, isColorName } from "../../parts/colors.ts";
import { markOwn } from "../../parts/own.ts";
import { envOf, featureOn } from "./tokens.ts";

/** バッジにする行内のコードの頭 */
const BADGE_PREFIX = "badge:";

/** バッジにしない印: 頭の `\` を外した `<code>` に戻す */
const ESCAPED_PREFIX = "badge\\:";

/** 最初の `:` の前が色の名前なら色とラベルに分け、そうでなければ全てをラベルにする */
export function splitBadgeColor(text: string): {
  color?: ColorName;
  label: string;
} {
  const at = text.indexOf(":");
  const head = text.slice(0, at);
  if (at < 0 || !isColorName(head)) {
    return { label: text };
  }
  return { color: head, label: text.slice(at + 1) };
}

/** `badge` がオンなら、頭が `badge:` で後ろに空白以外の文字を持つ行内のコードをバッジにし、`badge\:` のものは `\` を外したコードにする */
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
      const badge = child.content.startsWith(BADGE_PREFIX)
        ? splitBadgeColor(child.content.slice(BADGE_PREFIX.length))
        : undefined;
      // ラベルが空か空白だけのコードは、バッジにせずコードのまま残す
      if (badge !== undefined && badge.label.trim() !== "") {
        child.type = "html_inline";
        child.content = markOwn(renderBadge(badge), nonce);
      } else if (child.content.startsWith(ESCAPED_PREFIX)) {
        child.content = `${BADGE_PREFIX}${child.content.slice(ESCAPED_PREFIX.length)}`;
      }
    }
  }
}
