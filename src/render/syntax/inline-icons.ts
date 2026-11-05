import type { StateCore } from "markdown-it";
import { bundledIconNode } from "../../parts/icons.ts";
import {
  type MdmarkIconNode,
  renderInlineIcon,
} from "../../parts/inline-icon.ts";
import { markOwn } from "../../parts/own.ts";
import { insertWarningsBeforeBlocks } from "./blocks.ts";
import { envOf, featureOn } from "./tokens.ts";
import type { SyntaxWarning } from "./warnings.ts";

/** Lucide のアイコンの名前の書き方 */
export const ICON_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** アイコンにする行内のコードの頭 */
const ICON_PREFIX = "icon:";

/** アイコンにしない印: 頭の `\` を外した `<code>` に戻す */
const ESCAPED_PREFIX = "icon\\:";

/** `icon` がオンなら、頭が `icon:` の行内のコードのうち名前の書き方に合うものを行内のアイコンにし、合わないものは段落の前に警告を置く */
export const buildInlineIcons = (state: StateCore): void => {
  if (!featureOn(state, "icon")) {
    return;
  }
  const env = envOf(state);
  const warnings: Array<{ index: number; warning: SyntaxWarning }> = [];
  for (const [index, token] of state.tokens.entries()) {
    for (const child of token.children ?? []) {
      if (child.type !== "code_inline") {
        continue;
      }
      if (child.content.startsWith(ESCAPED_PREFIX)) {
        child.content = `${ICON_PREFIX}${child.content.slice(ESCAPED_PREFIX.length)}`;
        continue;
      }
      if (!child.content.startsWith(ICON_PREFIX)) {
        continue;
      }
      const name = child.content.slice(ICON_PREFIX.length).trim();
      // 名前が空か空白だけのコードは、コードのまま残す
      if (name === "") {
        continue;
      }
      if (!ICON_NAME_PATTERN.test(name)) {
        warnings.push({
          index,
          warning: {
            mark: child.content,
            message: `の \`${name}\` は Lucide のアイコンの名前になりません。名前は英小文字・数字・\`-\` で書きます（例: \`rocket\`）。書いた文字のまま表示しています。`,
          },
        });
        continue;
      }
      const node: MdmarkIconNode | undefined =
        (bundledIconNode(name) as MdmarkIconNode | undefined) ??
        (env.icons && Object.hasOwn(env.icons, name)
          ? env.icons[name]
          : undefined);
      child.type = "html_inline";
      child.content = markOwn(renderInlineIcon({ name, node }), env.nonce);
    }
  }
  insertWarningsBeforeBlocks(state, warnings);
};
