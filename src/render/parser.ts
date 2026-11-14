import type {
  MarkdownIt as MarkdownItParser,
  StateCore,
  Token,
} from "markdown-it";
import MarkdownIt from "markdown-it";
import type { LibraryEntry, PageSettings } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type {
  MdmarkGlossaryEntry,
  MdmarkReferences,
} from "../knowledge/references.ts";
import { escapeHtml } from "../parts/escape.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import type { MarkOptions } from "./mark-options.ts";
import type { MarkNote } from "./mark-schema.ts";
import {
  dropMarks,
  MARK_PATTERN,
  MARK_TOKEN,
  resolveDocumentFeatures,
  resolvePageSettings,
  takeMarks,
} from "./marks.ts";
import {
  type AnnotationState,
  buildAnnotationList,
  collectAnnotations,
  takeAnnotationDefinitions,
  useAnnotations,
} from "./syntax/annotations.ts";
import { backlinksRule } from "./syntax/backlinks.ts";
import { buildBadges } from "./syntax/badges.ts";
import { buildCallouts } from "./syntax/callouts.ts";
import { buildCardGrid } from "./syntax/card-grid.ts";
import { buildCards } from "./syntax/cards.ts";
import { buildCodeBlocks } from "./syntax/code-blocks.ts";
import { buildCsvTables } from "./syntax/csv.ts";
import { buildDetailsRanges } from "./syntax/details.ts";
import { buildDiagrams } from "./syntax/diagrams.ts";
import { numberFigures } from "./syntax/figures.ts";
import {
  buildFootnoteList,
  collectFootnotes,
  type FootnoteState,
  takeFootnoteDefinitions,
  useFootnotes,
} from "./syntax/footnotes.ts";
import { insertFrontmatter } from "./syntax/frontmatter.ts";
import { buildGallery } from "./syntax/gallery.ts";
import { glossaryRule } from "./syntax/glossary.ts";
import { assignHeadingIds } from "./syntax/headings.ts";
import { useHighlight } from "./syntax/highlight.ts";
import { buildEmbeddedHtml } from "./syntax/html.ts";
import { buildImageFigures, readImages } from "./syntax/images.ts";
import { expandIncludes } from "./syntax/includes.ts";
import { buildInlineIcons } from "./syntax/inline-icons.ts";
import { buildKbds } from "./syntax/kbd.ts";
import { buildLayoutColumns } from "./syntax/layout-columns.ts";
import { buildMapRanges } from "./syntax/map.ts";
import { buildPagebreaks } from "./syntax/pagebreak.ts";
import { attachRowDetails } from "./syntax/row-details.ts";
import { wrapSections } from "./syntax/sections.ts";
import { buildSteps } from "./syntax/steps.ts";
import { linkTreeExamples } from "./syntax/table-tree.ts";
import { decorateTables } from "./syntax/tables.ts";
import { buildTabs } from "./syntax/tabs.ts";
import { termsRule } from "./syntax/terms.ts";
import { buildTextColors } from "./syntax/text-color.ts";
import { buildToc } from "./syntax/toc.ts";
import { buildFileTrees } from "./syntax/tree.ts";
import { buildViews } from "./syntax/views.ts";
import {
  type CollectedWarning,
  collectWarningsRule,
} from "./syntax/warnings.ts";
import { buildWideRanges } from "./syntax/wide.ts";

/** markdown-it の `env` としてコアルールに指定する値と、コアルールが取得したマーカー */
export type RenderEnv = {
  /** 対応表（どのマーカーをマーカーの場所の要素にするか） */
  libraries: Record<string, LibraryEntry>;
  /** 設定の `features` */
  defaults: Record<string, boolean>;
  /** 既定を適用した設定の `labels`（部品の文言） */
  labels?: { paramCopy: string };
  /** `features` のマーカーの JSON のオブジェクトを記載した順に並べたもの */
  featureOptions: Array<Record<string, boolean>>;
  /** `defaults` に `featureOptions` を重ねたもの */
  features: Record<string, boolean>;
  /** 文書の先頭の page のマーカーの設定を記載した順に並べたもの（`takeMarks` が追加する） */
  pageOptions?: Array<{ raw: string; options: MarkOptions }>;
  /** `pageOptions` を読み込んだページの設定（`resolvePageSettings` が入れる） */
  page?: PageSettings;
  /** 見出しの ID と文字 */
  headings: Array<{ level: number; id: string; text: string }>;
  /** 描くごとに作る、mdmark が出した要素のマーカーの値 */
  nonce: string;
  /** `normalizeIndex` で合う要素だけにした索引 */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id`（索引に無ければ `undefined`） */
  docId?: string | undefined;
  /** 参照の表（markdown-it が `env.references` にリンク参照定義を入れるため、別の名前にする） */
  mdmarkReferences?: MdmarkReferences | undefined;
  /** 利用側が指定したエイリアス（`render`・`mount` の `aliases`）。`termsRule`・`buildEmbeddedHtml` が `buildDictionary` に指定する */
  aliases?: readonly unknown[] | undefined;
  /** 描く文書の用語集の表から読み込んだ用語（`glossaryRule` が追加する） */
  ownGlossary: MdmarkGlossaryEntry[];
  /** `ownGlossary` の各用語の行番号。点検が行を示すために指定したときだけ、`glossaryRule` が追加する */
  glossaryLines?: number[] | undefined;
  /** 拡張のマーカーの範囲から読み込んだ部品の定義（マーカーの場所の `data-mdmark-definition` の番号で参照する） */
  extensionDefinitions?: unknown[];
  /** 描いた操作できる部品の定義（文書の中の並びの順） */
  paramDefinitions?: MdmarkParamDefinition[];
  /** 描いた図と操作できる部品の数（`id` の通し番号。範囲のマーカーと埋め込んだ HTML で共有する） */
  diagramCount?: number;
  /** 用語のツールチップの数（`id` の通し番号。埋め込んだ HTML と本文で共有する） */
  termTipCount?: number;
  /** 読み込んだ脚注の定義と参照（定義の block のルールが作り、機能がオフなら `collectFootnotes` が削除する） */
  mdmarkFootnotes?: FootnoteState | undefined;
  /** 読み込んだ注記の定義と参照（定義の block のルールが作り、機能がオフなら `collectAnnotations` が削除する） */
  mdmarkAnnotations?: AnnotationState | undefined;
  /** ヒントのツールチップの数（`id` の通し番号） */
  hintCount?: number;
  /** ビューの記載の警告の数（`id` の通し番号） */
  viewCount?: number;
  /** 取り込む文書の表（`render`・`mount` の `includes`） */
  includes?: Record<string, string> | undefined;
  /** まとめていない名前のアイコンの形状の表（`render`・`mount` の `icons`） */
  icons?: Record<string, MdmarkIconNode> | undefined;
  /** 描いた記載の警告（最後のコアルール `collectWarningsRule` が入れる） */
  warnings?: CollectedWarning[];
  /** 画面に出さず点検だけがずれにするマーカーの注記と、マーカーの行（1 から） */
  markNotes: Array<MarkNote & { line: number }>;
  /** 文書の先頭のフロントマターの中身と閉じる行の 0 始まりの行番号（`renderDocument` が入れ、`insertFrontmatter` が読む） */
  frontmatter?: { content: string; endLine: number } | undefined;
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
    // 項目の最初の段落の行内だけを確認する
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
      // 記法が出した HTML だけに差し込む（文書に記載した生の HTML は変えない）
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

/** 解析器の設定。マーカーを取得する `findMarks` も同じ設定で解析する */
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

/** 文書から取得したマーカー 1 つ（`findMarks` の結果） */
export type FoundMark = {
  /** マーカーの名前 */
  name: string;
  /** マーカーの行（1 から） */
  line: number;
  /** マーカーの文字のまま */
  raw: string;
  /** 閉じのマーカーか */
  closing: boolean;
  /** マーカーの `:` の後ろの文字（無ければ空） */
  args: string;
};

/** マーカーの正規表現のマッチから、行を除くマーカーの値を作る */
function foundOf(match: RegExpMatchArray): Omit<FoundMark, "line"> {
  return {
    name: match[2] ?? "",
    raw: match[0],
    closing: match[1] === "/",
    args: match[3] ?? "",
  };
}

/** Markdown の生の HTML のブロックと行内の HTML からマーカーの名前と行の番号（1 から）を、記載した順に返却する。閉じのマーカーも 1 つのマーカーとして返却する */
export function findMarks(
  markdown: string,
): Array<{ name: string; line: number }> {
  return findMarkTexts(markdown).map(({ name, line }) => ({ name, line }));
}

/** `findMarks` と同じマーカーを、マーカーの文字と引数の文字と一緒に返却する */
export function findMarkTexts(markdown: string): FoundMark[] {
  const tokens = new MarkdownIt(PARSER_OPTIONS).parse(markdown, {});
  const found: FoundMark[] = [];
  for (const [position, token] of tokens.entries()) {
    if (token.type === "html_block" && token.map) {
      const start = token.map[0] + 1;
      for (const match of token.content.matchAll(MARK_PATTERN)) {
        const before = token.content.slice(0, match.index);
        found.push({
          ...foundOf(match),
          line: start + countNewlines(before),
        });
      }
    } else if (token.type === "inline") {
      // マーカーより前の子が持つ改行の数を追加しながら、行内の HTML のマーカーを取得する
      let offset = inlineStartLine(tokens, position) + 1;
      for (const child of token.children ?? []) {
        if (child.type === "softbreak" || child.type === "hardbreak") {
          offset += 1;
        } else if (child.type === "html_inline") {
          for (const match of child.content.matchAll(MARK_PATTERN)) {
            const before = child.content.slice(0, match.index);
            found.push({
              ...foundOf(match),
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

/** `html: true`・`linkify: true` の解析器に、追加するコアルールを登録して返却する */
export function createParser(): MarkdownItParser {
  const parser = new MarkdownIt(PARSER_OPTIONS);
  // スキームを持たないドメインも取得させ、後で文字に戻すものを選ぶ
  parser.linkify.set({ fuzzyLink: true });
  // マーカー → 機能の重ね合わせ → 取り込み → フロントマターの表示 → 蛍光ペン（`useHighlight` が取り込みの後に追加する）→ 脚注の機能のオン・オフ → 注記の番号と機能のオン・オフ → 記法（アイコン → 見出し → 用語集の表 → 行の詳細 → ビュー → CSV の表 → 表 → タブ → ステップ → 注意書き → ファイルツリー → バッジ → キー → 本文の文字の色 → 図の部品 → 埋め込んだ HTML → map の範囲 → コードブロックの飾り → 画像の属性と種類 → 図表の番号 → ギャラリー → 画像と動画と音声の図 → カード → 段組み → details の範囲 → wide の範囲 → 改ページ → 用語の下線 → セクション → 目次 → 脚注の一覧 → 注記の一覧 → 関連文書の一覧）→ タスクリスト → www の自動リンク → 残ったマーカー → 元の行番号 → 脚注の定義の取り出し → 注記の定義の取り出し
  const rules: Array<[string, (state: StateCore) => void]> = [
    ["mdmark_take_marks", takeMarks],
    ["mdmark_resolve_features", resolveDocumentFeatures],
    ["mdmark_resolve_page_settings", resolvePageSettings],
    ["mdmark_expand_includes", expandIncludes],
    // 機能を決めた後、コードブロックの飾りより前に配置する
    ["mdmark_insert_frontmatter", insertFrontmatter],
    ["mdmark_collect_footnotes", collectFootnotes],
    ["mdmark_collect_annotations", collectAnnotations],
    // 項目の `icon:` の行内のコードを読み込むため、行内のアイコンより前に配置する
    ["mdmark_build_card_grid", buildCardGrid],
    // 見出しの ID と文字から、アイコンにした行内のコードを削除するため、見出しの ID より前に配置する
    ["mdmark_build_inline_icons", buildInlineIcons],
    ["mdmark_assign_heading_ids", assignHeadingIds],
    ["mdmark_glossary", glossaryRule],
    ["mdmark_attach_row_details", attachRowDetails],
    ["mdmark_build_views", buildViews],
    ["mdmark_build_csv_tables", buildCsvTables],
    ["mdmark_decorate_tables", decorateTables],
    ["mdmark_build_tabs", buildTabs],
    ["mdmark_build_steps", buildSteps],
    ["mdmark_build_callouts", buildCallouts],
    ["mdmark_build_file_trees", buildFileTrees],
    ["mdmark_build_badges", buildBadges],
    ["mdmark_build_kbds", buildKbds],
    ["mdmark_build_text_colors", buildTextColors],
    ["mdmark_build_diagrams", buildDiagrams],
    ["mdmark_build_embedded_html", buildEmbeddedHtml],
    // 範囲の中の mermaid のブロックに印を付けるため、コードブロックの飾りより前に配置する
    ["mdmark_build_map_ranges", buildMapRanges],
    ["mdmark_build_code_blocks", buildCodeBlocks],
    ["mdmark_link_tree_examples", linkTreeExamples],
    ["mdmark_read_images", readImages],
    ["mdmark_number_figures", numberFigures],
    ["mdmark_build_gallery", buildGallery],
    ["mdmark_build_image_figures", buildImageFigures],
    ["mdmark_build_cards", buildCards],
    ["mdmark_build_layout_columns", buildLayoutColumns],
    ["mdmark_build_details_ranges", buildDetailsRanges],
    ["mdmark_build_wide_ranges", buildWideRanges],
    ["mdmark_build_pagebreaks", buildPagebreaks],
    ["mdmark_terms", termsRule],
    ["mdmark_wrap_sections", wrapSections],
    ["mdmark_build_toc", buildToc],
    ["mdmark_build_footnote_list", buildFootnoteList],
    ["mdmark_build_annotation_list", buildAnnotationList],
    ["mdmark_backlinks", backlinksRule],
    ["mdmark_task_list", taskList],
    ["mdmark_revert_fuzzy_links", revertFuzzyLinks],
    ["mdmark_drop_marks", dropMarks],
    ["mdmark_mark_source_lines", markSourceLines],
    ["mdmark_take_footnote_definitions", takeFootnoteDefinitions],
    ["mdmark_take_annotation_definitions", takeAnnotationDefinitions],
    ["mdmark_collect_warnings", collectWarningsRule],
  ];
  for (const [name, rule] of rules) {
    parser.core.ruler.push(name, rule);
  }
  useFootnotes(parser);
  useAnnotations(parser);
  useHighlight(parser);
  // マーカーのトークンは、残っていても何も出さない
  parser.renderer.rules[MARK_TOKEN] = () => "";
  // 取り消し線: markdown-it の `<s>` を GitHub と同じ `<del>` にする
  parser.renderer.rules.s_open = () => "<del>";
  parser.renderer.rules.s_close = () => "</del>";
  // コードブロック: `pre` にスクリーンリーダー向けの名前と tabindex を付ける
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
