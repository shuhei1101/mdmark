import type {
  MarkdownIt as MarkdownItParser,
  StateCore,
  Token,
} from "markdown-it";
import MarkdownIt from "markdown-it";
import type { LibraryEntry } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type {
  MdmarkGlossaryEntry,
  MdmarkReferences,
} from "../knowledge/references.ts";
import { escapeHtml } from "../parts/escape.ts";
import {
  dropMarks,
  MARK_PATTERN,
  MARK_TOKEN,
  resolveDocumentFeatures,
  takeMarks,
} from "./marks.ts";
import { backlinksRule } from "./syntax/backlinks.ts";
import { buildBadges } from "./syntax/badges.ts";
import { buildCallouts } from "./syntax/callouts.ts";
import { buildCodeBlocks } from "./syntax/code-blocks.ts";
import { buildDiagrams } from "./syntax/diagrams.ts";
import { numberFigures } from "./syntax/figures.ts";
import { glossaryRule } from "./syntax/glossary.ts";
import { assignHeadingIds } from "./syntax/headings.ts";
import { buildEmbeddedHtml } from "./syntax/html.ts";
import { attachRowDetails } from "./syntax/row-details.ts";
import { wrapSections } from "./syntax/sections.ts";
import { buildSteps } from "./syntax/steps.ts";
import { decorateTables } from "./syntax/tables.ts";
import { buildTabs } from "./syntax/tabs.ts";
import { termsRule } from "./syntax/terms.ts";
import { buildToc } from "./syntax/toc.ts";
import { buildFileTrees } from "./syntax/tree.ts";
import { buildViews } from "./syntax/views.ts";

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
  /** `normalizeIndex` で合う要素だけにした索引 */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id`（索引に無ければ `undefined`） */
  docId?: string | undefined;
  /** 参照の表（markdown-it が `env.references` にリンク参照定義を入れるため、別の名前にする） */
  mdmarkReferences?: MdmarkReferences | undefined;
  /** 使う側が渡したエイリアス（`render`・`mount` の `aliases`）。`termsRule`・`buildEmbeddedHtml` が `buildDictionary` に渡す */
  aliases?: readonly unknown[] | undefined;
  /** 描く文書の用語集の表から読んだ用語（`glossaryRule` が足す） */
  ownGlossary: MdmarkGlossaryEntry[];
  /** `ownGlossary` の各用語の行番号。点検が行を示すために渡したときだけ、`glossaryRule` が足す */
  glossaryLines?: number[] | undefined;
  /** 拡張の印の範囲から読んだ部品の定義（印の場所の `data-mdmark-definition` の番号で引く） */
  extensionDefinitions?: unknown[];
  /** 描いた操作できる部品の定義（文書の中の並びの順） */
  paramDefinitions?: MdmarkParamDefinition[];
  /** 描いた図と操作できる部品の数（`id` の通し番号。範囲の印と埋め込んだ HTML で共有する） */
  diagramCount?: number;
  /** 用語のツールチップの数（`id` の通し番号。埋め込んだ HTML と本文で共有する） */
  termTipCount?: number;
  /** ヒントのツールチップの数（`id` の通し番号） */
  hintCount?: number;
  /** ビューの書き方の警告の数（`id` の通し番号） */
  viewCount?: number;
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

/** 元の行番号を付けるブロックの開始のトークンの種類（`fence` は `renderer.rules.fence` が付ける） */
const SOURCE_LINE_TYPES = new Set([
  "heading_open",
  "paragraph_open",
  "bullet_list_open",
  "ordered_list_open",
  "list_item_open",
  "table_open",
  "tr_open",
  "blockquote_open",
  "hr",
  "code_block",
]);

/** `ownBlock` の HTML の最初の開始タグの属性の並びの頭 */
const OWN_START_TAG = /^<([a-zA-Z][a-zA-Z0-9-]*)(?= data-mdmark-own=")/;

/** ブロックの開始のトークンに、Markdown で始まる行の番号（0 始まり）を `data-source-line` で付ける */
export function markSourceLines(state: StateCore): void {
  const nonce = (state.env as RenderEnv).nonce;
  for (const token of state.tokens) {
    if (!token.block || !token.map) {
      continue;
    }
    const line = token.map[0];
    if (token.type === "html_block") {
      // 記法が出した HTML だけに差し込む（文書に書いた生の HTML は変えない）
      const start = OWN_START_TAG.exec(token.content);
      if (
        start &&
        token.content.startsWith(` data-mdmark-own="${nonce}"`, start[0].length)
      ) {
        token.content = `${start[0]} data-source-line="${line}"${token.content.slice(start[0].length)}`;
      }
    } else if (SOURCE_LINE_TYPES.has(token.type)) {
      token.attrSet("data-source-line", String(line));
    }
  }
}

/** 解析器の設定。印を拾う `findMarks` も同じ設定で解析する */
const PARSER_OPTIONS = { html: true, linkify: true };

/** `s` の中の改行の数 */
function countNewlines(s: string): number {
  return s.split("\n").length - 1;
}

/** 親の `inline` の開始行（0 から）。表のセルのように `map` が `null` のときは直前の `tr_open` の開始行 */
function inlineStartLine(tokens: Token[], position: number): number {
  for (let index = position; index >= 0; index--) {
    const token = tokens[index];
    if (token?.map && (index === position || token.type === "tr_open")) {
      return token.map[0];
    }
  }
  return 0;
}

/** Markdown の生の HTML のブロックと行内の HTML から印の名前と行の番号（1 から）を、書いた順に返す。閉じの印も 1 つの印として返す */
export function findMarks(
  markdown: string,
): Array<{ name: string; line: number }> {
  const tokens = new MarkdownIt(PARSER_OPTIONS).parse(markdown, {});
  const found: Array<{ name: string; line: number }> = [];
  for (const [position, token] of tokens.entries()) {
    if (token.type === "html_block" && token.map) {
      const start = token.map[0] + 1;
      for (const match of token.content.matchAll(MARK_PATTERN)) {
        const before = token.content.slice(0, match.index);
        found.push({
          name: match[2] ?? "",
          line: start + countNewlines(before),
        });
      }
    } else if (token.type === "inline") {
      // 印より前の子が持つ改行の数を足しながら、行内の HTML の印を拾う
      let offset = inlineStartLine(tokens, position) + 1;
      for (const child of token.children ?? []) {
        if (child.type === "softbreak" || child.type === "hardbreak") {
          offset += 1;
        } else if (child.type === "html_inline") {
          for (const match of child.content.matchAll(MARK_PATTERN)) {
            const before = child.content.slice(0, match.index);
            found.push({
              name: match[2] ?? "",
              line: offset + countNewlines(before),
            });
          }
          offset += countNewlines(child.content);
        }
      }
    }
  }
  return found;
}

/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export function createParser(): MarkdownItParser {
  const parser = new MarkdownIt(PARSER_OPTIONS);
  // スキームを持たないドメインも拾わせ、後で文字に戻すものを選ぶ
  parser.linkify.set({ fuzzyLink: true });
  // 印 → 機能の重ね合わせ → 記法（見出し → 用語集の表 → 行の詳細 → ビュー → 表 → タブ → ステップ → 注意書き → ファイルツリー → バッジ → 図の部品 → 埋め込んだ HTML → コードブロックの飾り → 図表の番号 → 用語の下線 → 節 → 目次 → 関連文書の一覧）→ タスクリスト → www の自動リンク → 残った印
  const rules: Array<[string, (state: StateCore) => void]> = [
    ["mdmark_take_marks", takeMarks],
    ["mdmark_resolve_features", resolveDocumentFeatures],
    ["mdmark_assign_heading_ids", assignHeadingIds],
    ["mdmark_glossary", glossaryRule],
    ["mdmark_attach_row_details", attachRowDetails],
    ["mdmark_build_views", buildViews],
    ["mdmark_decorate_tables", decorateTables],
    ["mdmark_build_tabs", buildTabs],
    ["mdmark_build_steps", buildSteps],
    ["mdmark_build_callouts", buildCallouts],
    ["mdmark_build_file_trees", buildFileTrees],
    ["mdmark_build_badges", buildBadges],
    ["mdmark_build_diagrams", buildDiagrams],
    ["mdmark_build_embedded_html", buildEmbeddedHtml],
    ["mdmark_build_code_blocks", buildCodeBlocks],
    ["mdmark_number_figures", numberFigures],
    ["mdmark_terms", termsRule],
    ["mdmark_wrap_sections", wrapSections],
    ["mdmark_build_toc", buildToc],
    ["mdmark_backlinks", backlinksRule],
    ["mdmark_task_list", taskList],
    ["mdmark_revert_fuzzy_links", revertFuzzyLinks],
    ["mdmark_drop_marks", dropMarks],
    ["mdmark_mark_source_lines", markSourceLines],
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
    const line = tokens[index]?.map?.[0];
    const sourceLine = line === undefined ? "" : ` data-source-line="${line}"`;
    return html.replace(
      "<pre>",
      `<pre tabindex="0" aria-label="${escapeHtml(label)}"${sourceLine}>`,
    );
  };
  return parser;
}
