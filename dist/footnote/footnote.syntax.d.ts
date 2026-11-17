import type { MarkdownIt, StateCore, StateInline, Token } from "markdown-it";
import type { RenderEnv } from "../render/parser.ts";
import { type FootnoteBackRef, type FootnoteKind } from "./footnote.part.ts";
/** 脚注の定義の囲みの開きと閉じ、本文の参照のトークンの種類 */
export declare const DEF_OPEN = "mdmark_footnote_def_open";
export declare const DEF_CLOSE = "mdmark_footnote_def_close";
/** 注記の定義の囲みの開きと閉じのトークンの種類（本文の外に置く定義として、脚注の定義と同じく扱う） */
export declare const ANNOTATION_DEF_OPEN = "mdmark_annotation_def_open";
export declare const ANNOTATION_DEF_CLOSE = "mdmark_annotation_def_close";
/** 参照した順の脚注 1 つ。行内の脚注は `collectFootnotes` が定義の囲みにするまで `key` が `null` で、`inline` に中身のトークンを持つ */
export type FootnoteNote = {
    key: string | null;
    inline: Token[] | null;
    refCount: number;
};
/** 1 回の解析で読み込んだ脚注の定義と参照 */
export type FootnoteState = {
    /** 正規化したラベルごとの定義のブロックのトークン（block の工程では `null`） */
    definitions: Map<string, Token[] | null>;
    /** 参照した順の脚注（位置 + 1 が番号） */
    notes: FootnoteNote[];
    /** ラベルごとの `notes` の位置 */
    numbers: Map<string, number>;
};
/** markdown-it のブロックのルールの引数 */
type BlockRuleArgs = Parameters<Parameters<MarkdownIt["block"]["ruler"]["push"]>[1]>;
/** 行頭の `[^ラベル]:` を脚注の定義として読み込み、字下げ 4 で続く行までを中身として囲む */
export declare function readFootnoteDefinition(...args: BlockRuleArgs): boolean;
/** `[^ラベル]` を、定義のあるラベルのときだけ本文の参照として読み込む */
export declare function readFootnoteReference(state: StateInline, silent: boolean): boolean;
/** `^[中身]` を行内の脚注として読み込み、中身を行内の Markdown として解析する */
export declare function readInlineFootnote(state: StateInline, silent: boolean): boolean;
/** `openIndex` の定義の囲み（脚注か注記）の開きに対する閉じの位置を返却する */
export declare function findDefinitionClose(tokens: Token[], openIndex: number): number;
/** 機能がオフのとき、定義の中身の最初の段落の頭に定義の頭の文字（`[^ラベル]: ` など）を戻す（段落が無ければ文字だけの段落を作る） */
export declare function restoreDefinition(state: StateCore, source: string, inner: Token[]): Token[];
/** 脚注の機能がオンなら行内の脚注の中身を定義の囲みにして文書の末尾に追加し（後のコアルールを本文と同じく経由するため）、オフなら参照と定義を記載した文字のまま記載した位置に戻す */
export declare function collectFootnotes(state: StateCore): void;
/** 脚注と注記の定義の囲みの外のトークンだけを返却する（用語の下線を脚注と注記の中身に付けないため） */
export declare function outsideFootnoteDefinitions(tokens: Token[]): Token[];
/** 全てのコアルールを経由した定義の囲みを本文から取り除き、ラベルごとの最初の定義を記録する */
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
/** 定義の中身のトークンを、ツールチップの段落ごとの行内の HTML と、一覧のブロックの HTML にする */
export declare function definitionBodies(options: {
    md: MarkdownIt;
    env: RenderEnv;
    tokens: Token[];
}): {
    bodies: string[];
    html: string;
};
/** 部品の HTML のうち、`fills` の中身（文書から描いた HTML）を除いた部分にだけ mdmark が出した要素のマーカーを付ける。`fills` は `FOOTNOTE_BODY_OPEN` の直後に順に並ぶ */
export declare function markOwnAroundBodies(html: string, fills: string[], nonce: string): string;
/** 脚注か注記の一覧の HTML にする。戻るリンクを最後の段落の閉じの前に配置させるため、中身を閉じの前後の差し込みインターフェースに分けて部品に指定し、中身の外にだけマーカーを付ける */
export declare function renderDefinitionList(options: {
    md: MarkdownIt;
    env: RenderEnv;
    kind: FootnoteKind;
    items: Array<{
        number: number;
        tokens: Token[];
        refCount: number;
        refs?: FootnoteBackRef[];
    }>;
}): string;
/** 脚注が 1 つ以上あれば、文書の末尾に脚注の一覧のトークンを追加する（中身は全てのコアルールの後に描く） */
export declare function buildFootnoteList(state: StateCore): void;
/** 解析器に、脚注の定義・参照・行内の脚注のルールと、参照の描き方を登録する */
export declare function useFootnotes(parser: MarkdownIt): void;
export {};
