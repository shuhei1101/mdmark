import type { StateCore } from "markdown-it";
import { renderEmbed } from "../parts/embed.ts";
import type { RenderEnv } from "./parser.ts";

/** 生の HTML の中の印（`<!-- 名前: 引数 -->`）を拾う正規表現 */
export const MARK_PATTERN = /<!--\s*([a-z][a-z0-9-]*):\s*(.*?)\s*-->/gs;

/** 機能のオン・オフを書く印の名前 */
export const FEATURES_MARK = "features";

/** 印を拾い、`features` は引数を環境へ足し、対応表にある名前は印の場所の要素にし、それ以外は取り除く */
export function takeMarks(state: StateCore): void {
  const env = state.env as RenderEnv;
  /** HTML の中の印を置き換える */
  const replaceMarks = (html: string): string =>
    html.replace(MARK_PATTERN, (_mark, name: string, rest: string) => {
      const args = rest.split(/\s+/).filter(Boolean);
      if (name === FEATURES_MARK) {
        env.featureArgs.push(...args);
        return "";
      }
      if (Object.hasOwn(env.libraries, name)) {
        return renderEmbed({ name, args });
      }
      return "";
    });
  for (const token of state.tokens) {
    if (token.type === "html_block") {
      token.content = replaceMarks(token.content);
    }
    // 行内の HTML は inline トークンの子にある
    for (const child of token.children ?? []) {
      if (child.type === "html_inline") {
        child.content = replaceMarks(child.content);
      }
    }
  }
}
