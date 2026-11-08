import { type StateCore, type Token } from "markdown-it";
import { type DiagramDirective } from "../../diagram/definition.ts";
/** 図の部品の `html_block` に付ける `meta` の印（図表の番号の対象にする） */
export declare const DIAGRAM_META = "diagram";
/** 操作できる部品を持つ `html_block` の `meta` に、持つ数を書くキー（文書の中の並びを数えるのに使う） */
export declare const PARAM_COUNT_META = "params";
/** 範囲の言語 `json` のコードブロック */
export declare function jsonFences(tokens: Token[]): Token[];
/** `diagrams` がオンなら、図の部品の印の範囲の `json` のコードブロックを定義として読み、図か操作できる部品の HTML にする。読めない定義は書き方の警告にする。範囲の中身は出力に残さない。オフのときは印だけを取り除く */
export declare function buildDiagrams(state: StateCore): void;
/** 点検が読む図の部品の範囲: 印の名前・開きの印の行の番号（1 から）・範囲の `json` のコードブロックの中身 */
export type DiagramBlocks = {
    directive: DiagramDirective;
    line: number;
    blocks: string[];
};
/** Markdown の図の部品の印の範囲ごとに、印の名前・開きの印の行の番号・`json` のコードブロックの中身を返す（`buildDiagrams` と同じ範囲の読み方。埋め込んだ HTML の中の custom element は返さない） */
export declare function findDiagramBlocks(markdown: string): DiagramBlocks[];
