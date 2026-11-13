import type { HLJSApi } from "highlight.js";
/** highlight.js が返却した HTML を改行で分け、行末で開いている `span` を閉じて次の行の頭で同じ開始タグをもう一度開く。入力のタグは highlight.js が出す `<span class="...">` と `</span>` だけとして扱い、文字はエスケープ済みのまま切り分ける */
export declare function splitHighlightedLines(html: string): string[];
/** 行の文字を改行でつないで一度に色分けし、行ごとの HTML に戻す。行をまたぐコメント・文字列も正しく色分けするため、行ごとでなくつないだ文字を経由する */
export declare function highlightLines(options: {
    /** 言語を登録した highlight.js の本体 */
    hljs: HLJSApi;
    /** 言語のモジュール名 */
    language: string;
    /** エスケープ前の行の文字 */
    lines: string[];
}): string[];
