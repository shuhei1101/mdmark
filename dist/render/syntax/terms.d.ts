import type { StateCore } from "markdown-it";
import { type Dictionary } from "../../knowledge/dictionary.ts";
/** 本文の文字を辞書の語で区切った 1 つ分: 文字のままの部分と、語に下線を引いてツールチップを置いた HTML */
export type TermSegment = {
    kind: "text";
    content: string;
} | {
    kind: "tip";
    html: string;
};
/** 用語・文書の別名に下線を、やめた言い方にマーカーを付けた場所（付けたら、同じ範囲の同じ語には付けない）。やめた言い方は用語の下線とは別に、言い方ごとに数える */
export type SeenTerms = {
    terms: Set<string>;
    docs: Set<string>;
    avoided: Set<string>;
};
/** 文字を辞書の語で区切る。同じ用語・文書は `seen` にあれば付けず、付けたら `seen` に足す。ツールチップの `id` は `nextTipId` が決める。語が 1 つも当たらなければ文字 1 つだけを返す */
export declare function termSegments(options: {
    /** 照合する文字 */
    text: string;
    /** 辞書 */
    dictionary: Dictionary;
    /** 描く文書の索引のパス（関連文書のリンクの基準） */
    ownPath: string | undefined;
    /** すでに下線を付けた用語・文書 */
    seen: SeenTerms;
    /** 次のツールチップの `id` */
    nextTipId: () => string;
    /** mdmark が出した要素の印の値 */
    nonce: string;
}): TermSegment[];
/** `glossary` か `backlinks` がオンなら、本文の文字を辞書の語と照合し、当たった語を語とツールチップの組に置き換える */
export declare function termsRule(state: StateCore): void;
