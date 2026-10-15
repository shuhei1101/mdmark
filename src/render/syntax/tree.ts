import type { StateCore, Token } from "markdown-it";
import { renderTree, type TreeNode } from "../../parts/tree.ts";
import { featureOn, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

export type { TreeNode };

/** ツリーの 1 段分の字下げ（`│   ` か空白 4 つ） */
const INDENT_UNITS = ["│   ", "    "];

/** 罫線の項目の頭（`├── `・`└── `） */
const CONNECTORS = ["├── ", "└── "];

/** 行の頭の字下げと罫線から段を数え、項目の名前を取り出す */
function readLine(line: string): { depth: number; name: string } {
  let depth = 0;
  let position = 0;
  while (INDENT_UNITS.some((unit) => line.startsWith(unit, position))) {
    position += 4;
    depth += 1;
  }
  if (CONNECTORS.some((connector) => line.startsWith(connector, position))) {
    position += 4;
    depth += 1;
  }
  return { depth, name: line.slice(position).trim() };
}

/** 罫線（`├──`・`└──`・`│`）と字下げで書いた行を `TreeNode` の入れ子にする。上の行より 2 段以上深い行があれば、その行番号と段の差を返す */
export function parseTree(
  source: string,
): { nodes: TreeNode[] } | { line: number; depth: number } {
  const nodes: TreeNode[] = [];
  // 各段の最後の項目（次の行の親になる）
  const stack: TreeNode[] = [];
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  let previous = -1;
  for (const [index, line] of lines.entries()) {
    const { depth, name } = readLine(line);
    if (depth > previous + 1) {
      return { line: index + 1, depth: depth - previous };
    }
    const node: TreeNode = { name };
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

/** `tree` がオンなら、言語 `tree` のコードブロックを読んでファイルツリーの部品にする。読めなければ警告を差し込み、コードブロックのままにする */
export function buildFileTrees(state: StateCore): void {
  if (!featureOn(state, "tree")) {
    return;
  }
  const out: Token[] = [];
  for (const token of state.tokens) {
    const language = token.info.trim().split(/\s+/)[0];
    if (token.type !== "fence" || language !== "tree") {
      out.push(token);
      continue;
    }
    const result = parseTree(token.content);
    if ("nodes" in result) {
      out.push(ownBlock(state, renderTree({ nodes: result.nodes })));
      continue;
    }
    out.push(
      warningBlock(state, {
        message: `ファイルツリーの ${result.line} 行目が、上の行より ${result.depth} 段深く書かれていて読めません。罫線の段を 1 段ずつ深くしてください。コードブロックのまま描いています。`,
      }),
      token,
    );
  }
  state.tokens = out;
}
