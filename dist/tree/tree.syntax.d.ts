import type { StateCore } from "markdown-it";
import type { Mark } from "../render/marks.ts";
import { type TreeNode } from "./tree.part.ts";
export type { TreeNode };
/** 罫線でフォルダ構成を記載した行。行頭の空白（`tree` コマンドが縦線の後ろに出す NBSP を含む）と縦線の後に、罫線の枝が続く */
export declare const TREE_LINE_PATTERN: RegExp;
/** この数以上の罫線の行を持つ言語が `tree` でないコードブロックをファイルツリーにする */
export declare const PLAIN_TREE_MIN_LINES = 2;
/** 罫線の行を持ってもファイルツリーにしないコードブロックの言語 */
export declare const PLAIN_TREE_EXCLUDED_LANGUAGES: readonly string[];
/** コードブロックの中身の、罫線でフォルダ構成を記載した行の数を返却する */
export declare const countTreeLines: (source: string) => number;
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
/** `code` と `tree` がオンのとき、罫線の行を `PLAIN_TREE_MIN_LINES` 以上持つ言語が `tree` でない `fence` を部品『ファイルツリー』にする。読み込めなければ警告を 1 つ差し込み、`fence` のまま残す */
export declare const buildPlainFileTrees: (state: StateCore) => void;
