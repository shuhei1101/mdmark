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
/** マーカーを記載した文書のフォルダを基準に、記載した取り込み先を描く文書のフォルダからのパスと取り込む範囲にする */
export declare const resolveIncludePath: (fromPath: string, written: string) => {
    key: string;
    target: IncludeTarget;
};
/** 取り込みのマーカーの設定（`path`・`heading`・`lines`）を、`resolveIncludePath` に指定する取り込み先の文字（`パス`・`パス#見出しの ID`・`パス#L開始-L終了`）にする */
export declare const writtenOf: (options: Record<string, unknown>) => string;
/** 見出しの文字の ID が `id` と一致する最初の見出しから、次の同じか上の階層の見出しの前までを返却する。無ければ `null` */
export declare const selectHeadingSection: (tokens: Token[], id: string) => Token[] | null;
/** 本文の `from`〜`to` 行目（1 から）を返却する。範囲が行の数を越えるときは行の数を返却する */
export declare const selectLines: (text: string, from: number, to: number) => {
    text: string;
} | {
    lineCount: number;
};
/** `include` がオンなら、include のマーカーを `opts.includes` の中身に置き換える（オフのマーカーは `dropMarks` が取り除く） */
export declare const expandIncludes: (state: StateCore) => void;
