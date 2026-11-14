import { type StateCore, type Token } from "markdown-it";
import { type DiagramDirective, type RetiredDiagramDirective } from "../../diagram/definition.ts";
/** 図の部品の `html_block` に付ける `meta` のマーカー（図表の番号の対象にする） */
export declare const DIAGRAM_META = "diagram";
/** 操作できる部品を持つ `html_block` の `meta` に、持つ数を記載するキー（文書の中の並びを数えるのに使用する） */
export declare const PARAM_COUNT_META = "params";
/** 範囲の言語 `json` のコードブロック */
export declare function jsonFences(tokens: Token[]): Token[];
/** 廃止した図の範囲の記載の警告の本文 */
export declare function retiredDiagramMessage(directive: RetiredDiagramDirective): string;
/** 埋め込んだ HTML の中の廃止した図の要素（`<mdmark-flow>`・`<mdmark-sequence>`）の記載の警告の本文 */
export declare function retiredElementMessage(directive: RetiredDiagramDirective): string;
/** 廃止した図の部品のマーカーの名前か */
export declare function isRetiredDiagram(name: string): name is RetiredDiagramDirective;
/** 拡張に無い廃止した図の範囲を記載の警告にする。`diagrams` がオンなら、図の部品のマーカーの範囲の `json` のコードブロックを定義として読み込み、図か操作できる部品の HTML にする。読み込めない定義は記載の警告にする。範囲の中身は出力に残さない。オフのときはマーカーだけを取り除く */
export declare function buildDiagrams(state: StateCore): void;
/** 点検と移行の手順が読み込む図の部品の範囲: マーカーの名前・開きと閉じのマーカーの行の番号（1 から。閉じが無ければ文書の最後の行）・範囲の `json` のコードブロックの中身 */
export type DiagramBlocks = {
    directive: DiagramDirective | RetiredDiagramDirective;
    line: number;
    end: number;
    blocks: string[];
};
/** Markdown の図の部品のマーカーと廃止した図の部品のマーカーの範囲ごとに、マーカーの名前・開きと閉じのマーカーの行の番号・`json` のコードブロックの中身を返却する（`buildDiagrams` と同じ範囲の読み込み方。埋め込んだ HTML の中の custom element は返却しない） */
export declare function findDiagramBlocks(markdown: string): DiagramBlocks[];
