import type { StateCore, Token } from "markdown-it";
/** 埋め込んだ HTML の中の図の部品の custom element と、その中の定義の文字 */
export declare const PART_PATTERN: RegExp;
/** 範囲の言語 `html` のコードブロックか */
export declare function isHtmlFence(token: Token): boolean;
/** sanitize-html が逃がした文字（`&amp;`・`&lt;`・`&gt;`・`&quot;`）を文字に戻す */
export declare function unescapeHtml(text: string): string;
/** `html` がオンなら、`<!-- html -->` の範囲の `html` のコードブロックを、コードでなく生の HTML として描く。範囲のコードブロックが 1 つでないときは書き方の警告を置き、範囲の中身はそのまま残す。オフのときは何もしない（印は `dropMarks` が取り除く） */
export declare function buildEmbeddedHtml(state: StateCore): void;
