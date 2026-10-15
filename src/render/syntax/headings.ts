import type { StateCore } from "markdown-it";
import { escapeHtml } from "../../parts/escape.ts";
import { markOwn } from "../../parts/own.ts";
import { envOf, featureOn, textOf } from "./tokens.ts";

/** 見出しの文字から GitHub と同じ規則で ID を作り、使用済みの ID には `-1`・`-2` を付ける */
export function slugify(text: string, used: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, "")
      .replaceAll(" ", "-") || "heading";
  const count = used.get(base);
  if (count === undefined) {
    used.set(base, 0);
    return base;
  }
  used.set(base, count + 1);
  return `${base}-${count + 1}`;
}

/** 全ての見出しに ID を付け、`anchors` がオンなら見出しの文字の後にアンカーを足し、見出しを `env.headings` に控える */
export function assignHeadingIds(state: StateCore): void {
  const env = envOf(state);
  const used = new Map<string, number>();
  const tokens = state.tokens;
  for (let index = 0; index < tokens.length; index++) {
    const open = tokens[index];
    const inline = tokens[index + 1];
    if (open?.type !== "heading_open" || inline?.type !== "inline") {
      continue;
    }
    const text = textOf(inline);
    const id = slugify(text, used);
    open.attrSet("id", id);
    open.attrSet("data-mdmark-own", env.nonce);
    env.headings.push({ level: Number(open.tag.slice(1)), id, text });
    if (featureOn(state, "anchors")) {
      const anchor = new state.Token("html_inline", "", 0);
      anchor.content = markOwn(
        `<a class="mdmark-anchor" href="#${escapeHtml(id)}" aria-label="「${escapeHtml(text)}」へのリンク"></a>`,
        env.nonce,
      );
      inline.children?.push(anchor);
    }
  }
}
