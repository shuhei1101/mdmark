import type { MarkdownIt as MarkdownItParser, StateCore } from "markdown-it";
import MarkdownIt from "markdown-it";
import type { LibraryEntry } from "../config.ts";
import { escapeHtml } from "../parts/escape.ts";
import {
  dropMarks,
  MARK_TOKEN,
  resolveDocumentFeatures,
  takeMarks,
} from "./marks.ts";
import { buildBadges } from "./syntax/badges.ts";
import { buildCallouts } from "./syntax/callouts.ts";
import { numberFigures } from "./syntax/figures.ts";
import { assignHeadingIds } from "./syntax/headings.ts";
import { attachRowDetails } from "./syntax/row-details.ts";
import { wrapSections } from "./syntax/sections.ts";
import { buildSteps } from "./syntax/steps.ts";
import { decorateTables } from "./syntax/tables.ts";
import { buildTabs } from "./syntax/tabs.ts";
import { buildToc } from "./syntax/toc.ts";
import { buildFileTrees } from "./syntax/tree.ts";

/** markdown-it の `env` としてコアルールに渡す値と、コアルールが拾った印 */
export type RenderEnv = {
  /** 対応表（どの印を印の場所の要素にするか） */
  libraries: Record<string, LibraryEntry>;
  /** 設定の `features` */
  defaults: Record<string, boolean>;
  /** `features` の印の引数を書いた順に並べたもの */
  featureArgs: string[];
  /** `defaults` に `featureArgs` を重ねたもの */
  features: Record<string, boolean>;
  /** 見出しの ID と文字 */
  headings: Array<{ level: number; id: string; text: string }>;
  /** 描くごとに作る、mdmark が出した要素の印の値 */
  nonce: string;
};

/** スキームも `www.` もメールの `@` も持たない自動リンクの文字を見分ける正規表現 */
const EXPLICIT_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|www\.|[^@]*@)/i;

/** タスクリストの項目の頭の `[ ]`・`[x]` */
const TASK_MARKER_PATTERN = /^\[([ xX])\]\s+/;

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

/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export function createParser(): MarkdownItParser {
  const parser = new MarkdownIt({ html: true, linkify: true });
  // スキームを持たないドメインも拾わせ、後で文字に戻すものを選ぶ
  parser.linkify.set({ fuzzyLink: true });
  // 印 → 機能の重ね合わせ → 記法（見出し → 行の詳細 → 表 → タブ → ステップ → 注意書き → ファイルツリー → バッジ → 図表の番号 → 節 → 目次）→ タスクリスト → www の自動リンク → 残った印
  const rules: Array<[string, (state: StateCore) => void]> = [
    ["mdmark_take_marks", takeMarks],
    ["mdmark_resolve_features", resolveDocumentFeatures],
    ["mdmark_assign_heading_ids", assignHeadingIds],
    ["mdmark_attach_row_details", attachRowDetails],
    ["mdmark_decorate_tables", decorateTables],
    ["mdmark_build_tabs", buildTabs],
    ["mdmark_build_steps", buildSteps],
    ["mdmark_build_callouts", buildCallouts],
    ["mdmark_build_file_trees", buildFileTrees],
    ["mdmark_build_badges", buildBadges],
    ["mdmark_number_figures", numberFigures],
    ["mdmark_wrap_sections", wrapSections],
    ["mdmark_build_toc", buildToc],
    ["mdmark_task_list", taskList],
    ["mdmark_revert_fuzzy_links", revertFuzzyLinks],
    ["mdmark_drop_marks", dropMarks],
  ];
  for (const [name, rule] of rules) {
    parser.core.ruler.push(name, rule);
  }
  // 印のトークンは、残っていても何も出さない
  parser.renderer.rules[MARK_TOKEN] = () => "";
  // 取り消し線: markdown-it の `<s>` を GitHub と同じ `<del>` にする
  parser.renderer.rules.s_open = () => "<del>";
  parser.renderer.rules.s_close = () => "</del>";
  // コードブロック: `pre` に読み上げの名前と tabindex を付ける
  const renderFence = parser.renderer.rules.fence;
  parser.renderer.rules.fence = (tokens, index, options, env, self) => {
    const language = tokens[index]?.info.trim().split(/\s+/)[0] ?? "";
    const label = language ? `コード: ${language}` : "コード";
    const html = renderFence?.(tokens, index, options, env, self) ?? "";
    return html.replace(
      "<pre>",
      `<pre tabindex="0" aria-label="${escapeHtml(label)}">`,
    );
  };
  return parser;
}
