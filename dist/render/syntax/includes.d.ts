import type { StateCore, Token } from "markdown-it";
/** 取り込む範囲: 全体・見出しの中・行の範囲 */
export type IncludeTarget = {
    kind: "whole";
} | {
    kind: "heading";
    id: string;
} | {
    kind: "lines";
    from: number;
    to: number;
};
/** パスが Markdown のファイルか */
export declare const isMarkdownPath: (path: string) => boolean;
/** マーカーを書いた文書のフォルダを基準に、書いた取り込み先を描く文書のフォルダからのパスと取り込む範囲にする */
export declare const resolveIncludePath: (fromPath: string, written: string) => {
    key: string;
    target: IncludeTarget;
};
/** 見出しの文字の ID が `id` と一致する最初の見出しから、次の同じか上の階層の見出しの前までを返す。無ければ `null` */
export declare const selectHeadingSection: (tokens: Token[], id: string) => Token[] | null;
/** 本文の `from`〜`to` 行目（1 から）を返す。範囲が行の数を越えるときは行の数を返す */
export declare const selectLines: (text: string, from: number, to: number) => {
    text: string;
} | {
    lineCount: number;
};
/** `include` がオンなら、include のマーカーを `opts.includes` の中身に置き換える（オフの印は `dropMarks` が取り除く） */
export declare const expandIncludes: (state: StateCore) => void;
