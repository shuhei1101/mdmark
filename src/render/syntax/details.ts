import type { StateCore, Token } from "markdown-it";
import MarkdownIt from "markdown-it";
import type { MarkOptions } from "../mark-options.ts";
import { pairRanges } from "./blocks.ts";
import { featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** タイトルを行内の Markdown として描く解析器（記法のコアルールを持たない） */
const titleParser = new MarkdownIt();

/** タイトルが空のときのタイトル */
const DEFAULT_TITLE = "詳細";

/** マーカーの設定の `title`（空の文字か省くと `詳細`）と `open`（省くと `false`）を読み込む */
export const readDetailsOptions = (
  options: MarkOptions,
): { title: string; open: boolean } => ({
  title:
    typeof options.title === "string" && options.title !== ""
      ? options.title
      : DEFAULT_TITLE,
  open: options.open === true,
});

/** `details` がオンなら、`<!-- details: … -->` 〜 `<!-- /details -->` を開閉する `details` にする。閉じのマーカーが無いときは警告を差し込んで囲まない */
export const buildDetailsRanges = (state: StateCore): void => {
  if (!featureOn(state, "details")) {
    return;
  }
  const tokens = state.tokens;
  const pairs = pairRanges(tokens, "details");
  const closes = new Set([...pairs.values()]);
  const out: Token[] = [];
  for (const [index, token] of tokens.entries()) {
    const mark = markOf(token);
    if (mark?.name !== "details") {
      out.push(token);
      continue;
    }
    if (mark.closing) {
      if (closes.has(index)) {
        out.push(
          tabBoundaryBlock({
            state,
            html: "</details>",
            boundary: "end",
            source: token,
          }),
        );
      }
      continue;
    }
    if (pairs.get(index) === -1) {
      out.push(warningBlock(state, unclosedWarning(mark)));
      continue;
    }
    const { title, open } = readDetailsOptions(mark.options);
    const summary = titleParser.renderInline(title);
    out.push(
      tabBoundaryBlock({
        state,
        html: `<details class="mdmark-collapsible"${open ? " open" : ""}><summary>${summary}</summary>`,
        boundary: "start",
        source: token,
      }),
    );
  }
  state.tokens = out;
};
