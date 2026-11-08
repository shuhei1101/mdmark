import type { MarkdownIt, StateBlock, StateCore, StateInline, Token } from "markdown-it";
import type { RenderEnv } from "../parser.ts";
/** 脚注の定義の囲みの開きと閉じ、本文の参照のトークンの種類 */
export declare const DEF_OPEN = "mdmark_footnote_def_open";
export declare const DEF_CLOSE = "mdmark_footnote_def_close";
/** 参照した順の脚注 1 つ。行内の脚注は `collectFootnotes` が定義の囲みにするまで `key` が `null` で、`inline` に中身のトークンを持つ */
export type FootnoteNote = {
    key: string | null;
    inline: Token[] | null;
    refCount: number;
};
/** 1 回の解析で読んだ脚注の定義と参照 */
export type FootnoteState = {
    /** 正規化したラベルごとの定義のブロックのトークン（block の工程では `null`） */
    definitions: Map<string, Token[] | null>;
    /** 参照した順の脚注（位置 + 1 が番号） */
    notes: FootnoteNote[];
    /** ラベルごとの `notes` の位置 */
    numbers: Map<string, number>;
};
/** 行頭の `[^ラベル]:` を脚注の定義として読み、字下げ 4 で続く行までを中身として囲む */
export declare function readFootnoteDefinition(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean;
/** `[^ラベル]` を、定義のあるラベルのときだけ本文の参照として読む */
export declare function readFootnoteReference(state: StateInline, silent: boolean): boolean;
/** `^[中身]` を行内の脚注として読み、中身を行内の Markdown として解析する */
export declare function readInlineFootnote(state: StateInline, silent: boolean): boolean;
/** 脚注の機能がオンなら行内の脚注の中身を定義の囲みにして文書の末尾に足し（後のコアルールを本文と同じく通すため）、オフなら参照と定義を書いた文字のまま書いた位置に戻す */
export declare function collectFootnotes(state: StateCore): void;
/** 定義の囲みの外のトークンだけを返す（用語の下線を脚注の中身に付けないため） */
export declare function outsideFootnoteDefinitions(tokens: Token[]): Token[];
/** 全てのコアルールを通した定義の囲みを本文から取り除き、ラベルごとの最初の定義を控える */
export declare function takeFootnoteDefinitions(state: StateCore): void;
/** 脚注 1 つの中身を、ツールチップの段落ごとの行内の HTML と、一覧のブロックの HTML にする */
export declare function footnoteBodies(options: {
    md: MarkdownIt;
    env: RenderEnv;
    note: FootnoteNote;
}): {
    bodies: string[];
    html: string;
};
/** 脚注が 1 つ以上あれば、文書の末尾に脚注の一覧のトークンを足す（中身は全てのコアルールの後に描く） */
export declare function buildFootnoteList(state: StateCore): void;
/** 解析器に、脚注の定義・参照・行内の脚注のルールと、参照の描き方を登録する */
export declare function useFootnotes(parser: MarkdownIt): void;
