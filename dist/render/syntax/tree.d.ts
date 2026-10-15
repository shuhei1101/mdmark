import type { StateCore } from "markdown-it";
import { type TreeNode } from "../../parts/tree.ts";
export type { TreeNode };
/** 罫線（`├──`・`└──`・`│`）と字下げで書いた行を `TreeNode` の入れ子にする。上の行より 2 段以上深い行があれば、その行番号と段の差を返す */
export declare function parseTree(source: string): {
    nodes: TreeNode[];
} | {
    line: number;
    depth: number;
};
/** `tree` がオンなら、言語 `tree` のコードブロックを読んでファイルツリーの部品にする。読めなければ警告を差し込み、コードブロックのままにする */
export declare function buildFileTrees(state: StateCore): void;
