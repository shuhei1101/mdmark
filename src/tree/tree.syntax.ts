import type { StateCore, Token } from "markdown-it";
import {
  readCodeSpec,
  splitInfoString,
} from "../code-block/code-block.syntax.ts";
import { MAP_SOURCE_META } from "../map/map.syntax.ts";
import type { Mark } from "../render/marks.ts";
import { escapeHtml } from "../shared/escape.logic.ts";
import { warningBlock } from "../shared/syntax-warning.syntax.ts";
import { envOf, featureOn, markOf, ownBlock } from "../shared/tokens.syntax.ts";
import { renderTree, type TreeNode } from "./tree.part.ts";

export type { TreeNode };

/** 罫線でフォルダ構成を記載した行。行頭の空白（`tree` コマンドが縦線の後ろに出す NBSP を含む）と縦線の後に、罫線の枝が続く */
export const TREE_LINE_PATTERN = /^[\t \u00A0│|]*(?:├── |└── |\|-- |`-- )/u;

/** この数以上の罫線の行を持つ言語が `tree` でないコードブロックをファイルツリーにする */
export const PLAIN_TREE_MIN_LINES = 2;

/** 罫線の行を持ってもファイルツリーにしないコードブロックの言語 */
export const PLAIN_TREE_EXCLUDED_LANGUAGES: readonly string[] = [
  "mermaid",
  "csv",
];

/** コードブロックの中身の、罫線でフォルダ構成を記載した行の数を返却する */
export const countTreeLines = (source: string): number =>
  source.split("\n").filter((line) => TREE_LINE_PATTERN.test(line)).length;

/** ツリーの 1 階層分の字下げ（`│   `・`|   ` か空白 4 つ） */
const INDENT_UNITS = ["│   ", "|   ", "    "];

/** 罫線の項目の頭（`├── `・`└── `・`|-- `・`` `-- ``） */
const CONNECTORS = ["├── ", "└── ", "|-- ", "`-- "];

/** 字下げと罫線の幅（文字数） */
const RULE_WIDTH = 4;

/** 名前と注釈を分ける区切り: 前に空白がある `#` */
const NOTE_SEPARATOR = /\s#/;

/** 行の頭の字下げと罫線から階層を数え、罫線の後ろの文字を取り出す */
function readLine(line: string): { depth: number; text: string } {
  let depth = 0;
  let position = 0;
  while (INDENT_UNITS.some((unit) => line.startsWith(unit, position))) {
    position += RULE_WIDTH;
    depth += 1;
  }
  if (CONNECTORS.some((connector) => line.startsWith(connector, position))) {
    position += RULE_WIDTH;
    depth += 1;
  }
  return { depth, text: line.slice(position) };
}

/** 罫線の後ろの文字を、前に空白がある最初の `#` で名前と注釈に分ける */
function splitNote(
  text: string,
  renderNote: (markdown: string) => string,
): { name: string; note?: string } {
  const separator = NOTE_SEPARATOR.exec(text);
  if (!separator) {
    return { name: text.trim() };
  }
  const name = text.slice(0, separator.index).trim();
  const note = text.slice(separator.index + separator[0].length).trim();
  return note === "" ? { name } : { name, note: renderNote(note) };
}

/** 罫線（`├── `・`└── `・`│   ` と ASCII の `|-- `・`` `-- ``・`|   `）と字下げで記載した行を `TreeNode` の入れ子にする。前に空白がある最初の `#` から後ろを注釈にし、`renderNote` で HTML にする。上の行より 2 段以上深い行があれば、その行番号と階層の差を返却する */
export function parseTree(
  source: string,
  renderNote: (markdown: string) => string = escapeHtml,
): { nodes: TreeNode[] } | { line: number; depth: number } {
  const nodes: TreeNode[] = [];
  // 各階層の最後の項目（次の行の親になる）
  const stack: TreeNode[] = [];
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  let previous = -1;
  for (const [index, line] of lines.entries()) {
    const { depth, text } = readLine(line);
    if (depth > previous + 1) {
      return { line: index + 1, depth: depth - previous };
    }
    const node: TreeNode = splitNote(text, renderNote);
    stack.length = depth;
    const parent = stack[depth - 1];
    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      nodes.push(node);
    }
    stack[depth] = node;
    previous = depth;
  }
  return { nodes };
}

/** ファイルツリーのマーカーの設定から `depth` と `wrap` を読み込む。`depth` を省いたときは開く階層を入れない */
export function readTreeOptions(mark: Mark): { open?: string; wrap: boolean } {
  const { depth, wrap } = mark.options;
  const open =
    depth === "all" || typeof depth === "number" ? String(depth) : undefined;
  return { ...(open === undefined ? {} : { open }), wrap: wrap === true };
}

/** 注釈の Markdown を、行内の要素だけの HTML にする。注釈に記載した生の HTML は文字にする（mdmark が出したバッジなどの要素だけ残す） */
function renderNoteInline(state: StateCore, markdown: string): string {
  const env = state.env;
  const own = `data-mdmark-own="${envOf(state).nonce}"`;
  const children = (state.md.parseInline(markdown, env)[0]?.children ?? []).map(
    (child) => {
      if (child.type === "html_inline" && !child.content.includes(own)) {
        child.type = "text";
      }
      return child;
    },
  );
  return state.md.renderer.renderInline(children, state.md.options, env);
}

/** 読み込めないファイルツリーの記載の警告 */
const tooDeepWarning = (
  state: StateCore,
  result: { line: number; depth: number },
): Token =>
  warningBlock(state, {
    message: `ファイルツリーの ${result.line} 行目が、上の行より ${result.depth} 階層深く記載されていて読み込めません。罫線の階層を 1 階層ずつ深くしてください。コードブロックのまま描いています。`,
  });

/** `tree` がオンなら、言語 `tree` のコードブロックを読み込んでファイルツリーの部品にする。直前に `tree` のマーカーがあれば `open=` を読み込んで部品へ指定し、読み込めない指定は警告を差し込む。罫線を読み込めなければ警告を差し込み、コードブロックのままにする */
export function buildFileTrees(state: StateCore): void {
  if (!featureOn(state, "tree")) {
    return;
  }
  const out: Token[] = [];
  for (const [index, token] of state.tokens.entries()) {
    const language = token.info.trim().split(/\s+/)[0];
    if (token.type !== "fence" || language !== "tree") {
      out.push(token);
      continue;
    }
    const result = parseTree(token.content, (markdown) =>
      renderNoteInline(state, markdown),
    );
    if (!("nodes" in result)) {
      out.push(tooDeepWarning(state, result), token);
      continue;
    }
    const mark = markOf(state.tokens[index - 1]);
    const options: { open?: string; wrap: boolean } =
      mark?.name === "tree" && !mark.closing
        ? readTreeOptions(mark)
        : { wrap: false };
    out.push(
      ownBlock(
        state,
        renderTree({
          nodes: result.nodes,
          source: token.content.replace(/\n+$/, ""),
          open: options.open,
          wrap: options.wrap,
        }),
      ),
    );
  }
  state.tokens = out;
}

/** 言語が `tree` でない `fence` をファイルツリーにする対象か（直前の `code` のマーカーは `previous`） */
const isPlainTree = (token: Token, previous: Mark | undefined): boolean => {
  if (token.type !== "fence" || token.meta?.[MAP_SOURCE_META] === true)
    return false;
  const { language } = splitInfoString(token.info);
  if (language === "tree" || PLAIN_TREE_EXCLUDED_LANGUAGES.includes(language))
    return false;
  if (countTreeLines(token.content) < PLAIN_TREE_MIN_LINES) return false;
  if (previous === undefined) return true;
  return readCodeSpec({
    options: previous.options,
    lineCount: token.content.split("\n").length,
  }).treeWarning;
};

/** `code` と `tree` がオンのとき、罫線の行を `PLAIN_TREE_MIN_LINES` 以上持つ言語が `tree` でない `fence` を部品『ファイルツリー』にする。読み込めなければ警告を 1 つ差し込み、`fence` のまま残す */
export const buildPlainFileTrees = (state: StateCore): void => {
  if (!featureOn(state, "tree") || !featureOn(state, "code")) return;
  const out: Token[] = [];
  for (const [index, token] of state.tokens.entries()) {
    const mark = markOf(state.tokens[index - 1]);
    const code = mark?.name === "code" && !mark.closing ? mark : undefined;
    if (!isPlainTree(token, code)) {
      out.push(token);
      continue;
    }
    const result = parseTree(token.content, (markdown) =>
      renderNoteInline(state, markdown),
    );
    if (!("nodes" in result)) {
      out.push(tooDeepWarning(state, result), token);
      continue;
    }
    if (code) out.pop();
    out.push(
      ownBlock(
        state,
        renderTree({
          nodes: result.nodes,
          source: token.content.replace(/\n+$/, ""),
          language: splitInfoString(token.info).language,
          wrap: false,
        }),
        token,
      ),
    );
  }
  state.tokens = out;
};
