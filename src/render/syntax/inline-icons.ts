import type { StateCore, Token } from "markdown-it";
import { bundledIconNode } from "../../parts/icons.ts";
import {
  type MdmarkIconNode,
  renderInlineIcon,
} from "../../parts/inline-icon.ts";
import { markOwn } from "../../parts/own.ts";
import type { RenderEnv } from "../parser.ts";
import { insertWarningsBeforeBlocks } from "./blocks.ts";
import { envOf, featureOn } from "./tokens.ts";
import type { SyntaxWarning } from "./warnings.ts";

/** Lucide のアイコンの名前の記載方法 */
export const ICON_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** アイコンにする行内のコードの頭 */
const ICON_PREFIX = "icon:";

/** アイコンにしないマーカー: 頭の `\` を削除した `<code>` に戻す */
const ESCAPED_PREFIX = "icon\\:";

/** 名前のアイコンの形状を、まとめたアイコン、`render`・`mount` の `icons` の順に参照する */
const iconNodeOf = (
  name: string,
  icons: Record<string, MdmarkIconNode> | undefined,
): MdmarkIconNode | undefined =>
  (bundledIconNode(name) as MdmarkIconNode | undefined) ??
  (icons && Object.hasOwn(icons, name) ? icons[name] : undefined);

/** 行内のコード 1 つを、頭が `icon:` で名前の記載方法に合えば行内のアイコンにする。合わない名前は警告を返却する */
const buildInlineIcon = (
  child: Token,
  env: RenderEnv,
): SyntaxWarning | undefined => {
  if (child.content.startsWith(ESCAPED_PREFIX)) {
    child.content = `${ICON_PREFIX}${child.content.slice(ESCAPED_PREFIX.length)}`;
    return undefined;
  }
  if (!child.content.startsWith(ICON_PREFIX)) {
    return undefined;
  }
  const name = child.content.slice(ICON_PREFIX.length).trim();
  // 名前が空か空白だけのコードは、コードのまま残す
  if (name === "") {
    return undefined;
  }
  if (!ICON_NAME_PATTERN.test(name)) {
    return {
      mark: child.content,
      message: `の \`${name}\` は Lucide のアイコンの名前になりません。名前は英小文字・数字・\`-\` で記載します（例: \`rocket\`）。記載した文字のまま表示しています。`,
    };
  }
  const node = iconNodeOf(name, env.icons);
  child.type = "html_inline";
  child.content = markOwn(renderInlineIcon({ name, node }), env.nonce);
  return undefined;
};

/** `icon` がオンなら、頭が `icon:` の行内のコードのうち名前の記載方法に合うものを行内のアイコンにし、合わないものは段落の前に警告を配置する */
export const buildInlineIcons = (state: StateCore): void => {
  if (!featureOn(state, "icon")) {
    return;
  }
  const env = envOf(state);
  const warnings: Array<{ index: number; warning: SyntaxWarning }> = [];
  for (const [index, token] of state.tokens.entries()) {
    for (const child of token.children ?? []) {
      const warning =
        child.type === "code_inline" ? buildInlineIcon(child, env) : undefined;
      if (warning) {
        warnings.push({ index, warning });
      }
    }
  }
  insertWarningsBeforeBlocks(state, warnings);
};
