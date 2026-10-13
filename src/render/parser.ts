import type {
  MarkdownIt as MarkdownItParser,
  StateCore,
  Token,
} from "markdown-it";
import MarkdownIt from "markdown-it";
import type { LibraryEntry } from "../config.ts";
import { takeMarks } from "./marks.ts";

/** markdown-it の `env` としてコアルールに渡す値と、コアルールが拾った印 */
export type RenderEnv = {
  /** 対応表（どの印を印の場所の要素にするか） */
  libraries: Record<string, LibraryEntry>;
  /** `features` の印の引数を書いた順に並べたもの */
  featureArgs: string[];
};

/** スキームも `www.` もメールの `@` も持たない自動リンクの文字を見分ける正規表現 */
const EXPLICIT_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|www\.|[^@]*@)/i;

/** タスクリストの項目の頭の `[ ]`・`[x]` */
const TASK_MARKER_PATTERN = /^\[([ xX])\]\s+/;

/** インライン要素の文字（タグを除いたもの）を集める */
function textOf(token: Token): string {
  return (token.children ?? [])
    .filter((child) => child.type === "text" || child.type === "code_inline")
    .map((child) => child.content)
    .join("");
}

/** タスクリストの項目の頭をチェックボックスにする */
function taskList(state: StateCore): void {
  const tokens = state.tokens;
  for (let index = 2; index < tokens.length; index++) {
    const inline = tokens[index];
    const item = tokens[index - 2];
    // 項目の最初の段落の行内だけを見る
    if (
      inline?.type !== "inline" ||
      tokens[index - 1]?.type !== "paragraph_open" ||
      item?.type !== "list_item_open"
    ) {
      continue;
    }
    const marker = TASK_MARKER_PATTERN.exec(inline.content);
    const first = inline.children?.[0];
    if (!marker || first?.type !== "text") {
      continue;
    }
    item.attrJoin("class", "task-list-item");
    first.content = first.content.replace(TASK_MARKER_PATTERN, "");
    const checkbox = new state.Token("html_inline", "", 0);
    checkbox.content =
      marker[1] === " "
        ? '<input type="checkbox" disabled> '
        : '<input type="checkbox" disabled checked> ';
    inline.children?.unshift(checkbox);
  }
}

/** `www.` で始まらず、スキームもメールの `@` も持たない自動リンクを文字に戻す */
function revertFuzzyLinks(state: StateCore): void {
  for (const token of state.tokens) {
    const children = token.children;
    if (!children) {
      continue;
    }
    for (let index = 0; index < children.length; index++) {
      const open = children[index];
      const text = children[index + 1];
      if (open?.type !== "link_open" || open.markup !== "linkify" || !text) {
        continue;
      }
      if (EXPLICIT_LINK_PATTERN.test(text.content)) {
        continue;
      }
      // link_open・text・link_close の 3 つを、文字 1 つに置き換える
      const plain = new state.Token("text", "", 0);
      plain.content = text.content;
      children.splice(index, 3, plain);
    }
  }
}

/** 表に読み上げの名前と tabindex を付け、セルに同じ列の見出しの文字を写す */
function decorateTables(state: StateCore): void {
  const tokens = state.tokens;
  let heading = "";
  let headers: string[] = [];
  let column = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (!token) {
      continue;
    }
    if (token.type === "heading_open") {
      heading = next ? textOf(next) : "";
    } else if (token.type === "table_open") {
      token.attrSet("tabindex", "0");
      token.attrSet("aria-label", heading ? `表: ${heading}` : "表");
      headers = [];
    } else if (token.type === "tr_open") {
      column = 0;
    } else if (token.type === "th_open") {
      headers.push(next ? textOf(next) : "");
    } else if (token.type === "td_open") {
      token.attrSet("data-label", headers[column] ?? "");
      column += 1;
    }
  }
}

/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export function createParser(): MarkdownItParser {
  const parser = new MarkdownIt({ html: true, linkify: true });
  // スキームを持たないドメインも拾わせ、後で文字に戻すものを選ぶ
  parser.linkify.set({ fuzzyLink: true });
  parser.core.ruler.push("mdmark_take_marks", takeMarks);
  parser.core.ruler.push("mdmark_task_list", taskList);
  parser.core.ruler.push("mdmark_revert_fuzzy_links", revertFuzzyLinks);
  parser.core.ruler.push("mdmark_decorate_tables", decorateTables);
  // 取り消し線: markdown-it の `<s>` を GitHub と同じ `<del>` にする
  parser.renderer.rules.s_open = () => "<del>";
  parser.renderer.rules.s_close = () => "</del>";
  // コードブロック: `pre` に読み上げの名前と tabindex を付ける
  const renderFence = parser.renderer.rules.fence;
  parser.renderer.rules.fence = (tokens, index, options, env, self) => {
    const language = tokens[index]?.info.trim().split(/\s+/)[0] ?? "";
    const label = language ? `コード: ${language}` : "コード";
    const html = renderFence?.(tokens, index, options, env, self) ?? "";
    return html.replace("<pre>", `<pre tabindex="0" aria-label="${label}">`);
  };
  return parser;
}
