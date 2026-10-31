import type { StateCore } from "markdown-it";
import { type TreeNode } from "../../parts/tree.ts";
import type { Mark } from "../marks.ts";
import { type SyntaxWarning } from "./warnings.ts";
export type { TreeNode };
/** 罫線（`├── `・`└── `・`│   ` と ASCII の `|-- `・`` `-- ``・`|   `）と字下げで書いた行を `TreeNode` の入れ子にする。前に空白がある最初の `#` から後ろを注釈にし、`renderNote` で HTML にする。上の行より 2 段以上深い行があれば、その行番号と段の差を返す */
export declare function parseTree(source: string, renderNote?: (markdown: string) => string): {
    nodes: TreeNode[];
} | {
    line: number;
    depth: number;
};
/** ファイルツリーの印の引数から `open=` を読み、読めない指定を 1 つの書き方の警告にまとめる */
export declare function readTreeOptions(mark: Mark): {
    open?: string;
    warning?: SyntaxWarning;
};
/** `tree` がオンなら、言語 `tree` のコードブロックを読んでファイルツリーの部品にする。直前に `tree` の印があれば `open=` を読んで部品へ渡し、読めない指定は警告を差し込む。罫線を読めなければ警告を差し込み、コードブロックのままにする */
export declare function buildFileTrees(state: StateCore): void;
