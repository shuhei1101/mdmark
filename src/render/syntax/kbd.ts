import type { StateCore } from "markdown-it";
import { renderKbd } from "../../parts/kbd.ts";
import { markOwn } from "../../parts/own.ts";
import { envOf, featureOn } from "./tokens.ts";

/** キーにする行内のコードの頭 */
const KBD_PREFIX = "kbd:";

/** キーにしない印: 頭の `\` を外した `<code>` に戻す */
const ESCAPED_PREFIX = "kbd\\:";

/** `+` で区切り、`++` を `+` のキーとして読む。キーの前後の空白を外し、空のキーを捨てる */
export const splitKeys = (text: string): string[] => {
  const keys: string[] = [];
  let current = "";
  for (let at = 0; at < text.length; at++) {
    const char = text[at];
    if (char !== "+") {
      current += char;
      continue;
    }
    // 区切りの直後の `+`（または先頭の `+`）は `+` のキーにする
    if (current.trim() === "" && (at === 0 || text[at - 1] === "+")) {
      current = "+";
      keys.push(current);
      current = "";
      continue;
    }
    keys.push(current);
    current = "";
  }
  keys.push(current);
  return keys.map((key) => key.trim()).filter((key) => key !== "");
};

/** `kbd` がオンなら、頭が `kbd:` で後ろに空白以外の文字を持つ行内のコードをキーにし、`kbd\:` のものは `\` を外したコードにする */
export const buildKbds = (state: StateCore): void => {
  if (!featureOn(state, "kbd")) {
    return;
  }
  const nonce = envOf(state).nonce;
  for (const token of state.tokens) {
    for (const child of token.children ?? []) {
      if (child.type !== "code_inline") {
        continue;
      }
      if (child.content.startsWith(ESCAPED_PREFIX)) {
        child.content = `${KBD_PREFIX}${child.content.slice(ESCAPED_PREFIX.length)}`;
        continue;
      }
      if (!child.content.startsWith(KBD_PREFIX)) {
        continue;
      }
      const keys = splitKeys(child.content.slice(KBD_PREFIX.length));
      if (keys.length === 0) {
        continue;
      }
      child.type = "html_inline";
      child.content = markOwn(renderKbd({ keys }), nonce);
    }
  }
};
