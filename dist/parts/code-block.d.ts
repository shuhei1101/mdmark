/** 色分けの対象の `code` に付ける属性。値は色分けの言語のモジュール名。mdmark が出した要素だけが sanitize を通って持ち続けるため、文書に書いた生の HTML の `code` は色分けの対象にならない */
export declare const SYNTAX_ATTRIBUTE = "data-mdmark-syntax";
/** コードの行 1 つ */
export type CodeLine = {
    /** コードの行の印を外した行の文字（エスケープ前） */
    text: string;
    /** 行の種類。無ければ飾らない行 */
    kind?: "add" | "del" | "highlight" | undefined;
};
/** コードブロックの HTML を返す。行番号か行の種類を持つときは行ごとの `mdmark-code-line` に分け、題があれば `figure` と `figcaption` で包む。題だけのときは行に分けず `pre` のまま描く */
export declare function renderCodeBlock(options: {
    /** 情報文字列の言語（無ければ空） */
    language: string;
    /** 題（無ければ空） */
    title: string;
    /** 行番号を出すか */
    lineNumbers: boolean;
    /** コードの行 */
    lines: CodeLine[];
    /** 色分けする言語のモジュール名。渡すと `code` に `SYNTAX_ATTRIBUTE` を付ける */
    syntax?: string | undefined;
}): string;
