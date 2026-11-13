import type { StateCore } from "markdown-it";
import { type TreeNode } from "../../parts/tree.ts";
import type { Mark } from "../marks.ts";
export type { TreeNode };
/** 罫線（`├── `・`└── `・`│   ` と ASCII の `|-- `・`` `-- ``・`|   `）と字下げで記載した行を `TreeNode` の入れ子にする。前に空白がある最初の `#` から後ろを注釈にし、`renderNote` で HTML にする。上の行より 2 段以上深い行があれば、その行番号と階層の差を返却する */
export declare function parseTree(source: string, renderNote?: (markdown: string) => string): {
    nodes: TreeNode[];
} | {
    line: number;
    depth: number;
};
/** ファイルツリーのマーカーの設定から `depth` と `wrap` を読み込む。`depth` を省いたときは開く階層を入れない */
export declare function readTreeOptions(mark: Mark): {
    open?: string;
    wrap: boolean;
};
/** `tree` がオンなら、言語 `tree` のコードブロックを読み込んでファイルツリーの部品にする。直前に `tree` のマーカーがあれば `open=` を読み込んで部品へ指定し、読み込めない指定は警告を差し込む。罫線を読み込めなければ警告を差し込み、コードブロックのままにする */
export declare function buildFileTrees(state: StateCore): void;
