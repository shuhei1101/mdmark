import type { StateCore } from "markdown-it";
/** `html` がオンなら、`<!-- html -->` の範囲の `html` のコードブロックを、コードでなく生の HTML として描く。範囲のコードブロックが 1 つでないときは書き方の警告を置き、範囲の中身はそのまま残す。オフのときは何もしない（印は `dropMarks` が取り除く） */
export declare function buildEmbeddedHtml(state: StateCore): void;
