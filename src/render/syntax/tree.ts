import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { escapeHtml } from "../../parts/escape.ts";
import { renderTree, type TreeNode } from "../../parts/tree.ts";
import type { Mark } from "../marks.ts";
import { envOf, featureOn, markOf, ownBlock } from "./tokens.ts";
import { type SyntaxWarning, warningBlock } from "./warnings.ts";

export type { TreeNode };

/** ツリーの 1 段分の字下げ（`│   `・`|   ` か空白 4 つ） */
const INDENT_UNITS = ["│   ", "|   ", "    "];

/** 罫線の項目の頭（`├── `・`└── `・`|-- `・`` `-- ``） */
const CONNECTORS = ["├── ", "└── ", "|-- ", "`-- "];

/** 字下げと罫線の幅（文字数） */
const RULE_WIDTH = 4;

/** 名前と注釈を分ける区切り: 前に空白がある `#` */
const NOTE_SEPARATOR = /\s#/;

/** ファイルツリーの印で読めるキー */
const OPEN_KEY = "open";

/** `open=` に書ける、階層の数（1 以上の整数） */
const LEVELS_PATTERN = /^[1-9]\d*$/;

/** 行の頭の字下げと罫線から段を数え、罫線の後ろの文字を取り出す */
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

/** 罫線（`├── `・`└── `・`│   ` と ASCII の `|-- `・`` `-- ``・`|   `）と字下げで書いた行を `TreeNode` の入れ子にする。前に空白がある最初の `#` から後ろを注釈にし、`renderNote` で HTML にする。上の行より 2 段以上深い行があれば、その行番号と段の差を返す */
export function parseTree(
  source: string,
  renderNote: (markdown: string) => string = escapeHtml,
): { nodes: TreeNode[] } | { line: number; depth: number } {
  const nodes: TreeNode[] = [];
  // 各段の最後の項目（次の行の親になる）
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

/** ファイルツリーの印の引数から `open=` を読み、読めない指定を 1 つの書き方の警告にまとめる */
export function readTreeOptions(mark: Mark): {
  open?: string;
  warning?: SyntaxWarning;
} {
  const items: WarningItem[] = [];
  let open: string | undefined;
  for (const [key, value] of Object.entries(mark.args.keys)) {
    if (key !== OPEN_KEY) {
      items.push({
        label: `${key}=`,
        message: `使えないキーです。使えるキーは \`${OPEN_KEY}=\` です`,
      });
    } else if (value === "all" || LEVELS_PATTERN.test(value)) {
      open = value;
    } else {
      items.push({
        label: `${OPEN_KEY}=${value}`,
        message: `の値は読めません。\`all\` か階層の数（1 以上の整数）を書いてください。ルートだけを開いて描いています`,
      });
    }
  }
  // `キー=値` の形でない指定
  for (const arg of mark.args.args) {
    items.push({
      label: arg,
      message: `使えない指定です。使える指定は \`${OPEN_KEY}=all\` と \`${OPEN_KEY}=階層の数\` です`,
    });
  }
  if (items.length === 0) {
    return open === undefined ? {} : { open };
  }
  return {
    ...(open === undefined ? {} : { open }),
    warning: {
      mark: mark.raw,
      message: "の読めない指定を当てずに描いています。",
      items,
    },
  };
}

/** 注釈の Markdown を、行内の要素だけの HTML にする。注釈に書いた生の HTML は文字にする（mdmark が出したバッジなどの要素だけ残す） */
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

/** `tree` がオンなら、言語 `tree` のコードブロックを読んでファイルツリーの部品にする。直前に `tree` の印があれば `open=` を読んで部品へ渡し、読めない指定は警告を差し込む。罫線を読めなければ警告を差し込み、コードブロックのままにする */
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
      out.push(
        warningBlock(state, {
          message: `ファイルツリーの ${result.line} 行目が、上の行より ${result.depth} 段深く書かれていて読めません。罫線の段を 1 段ずつ深くしてください。コードブロックのまま描いています。`,
        }),
        token,
      );
      continue;
    }
    const mark = markOf(state.tokens[index - 1]);
    const options =
      mark?.name === "tree" && !mark.closing ? readTreeOptions(mark) : {};
    if (options.warning) {
      out.push(warningBlock(state, options.warning));
    }
    out.push(
      ownBlock(
        state,
        renderTree({
          nodes: result.nodes,
          source: token.content.replace(/\n+$/, ""),
          open: options.open,
        }),
      ),
    );
  }
  state.tokens = out;
}
