import type { Token } from "markdown-it";
import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "./references.ts";
/** 照合・点検・検索の前に、語に NFKC・英字の小文字化・前後の空白の除去をかける */
export declare function normalizeWord(word: string): string;
/** 照合の辞書: 索引の用語・用語集の表の用語・文書の別名を、照合する語から引ける形にまとめたもの */
export type Dictionary = {
    /** 照合する語。`normalizeWord` で正規化した語を、長い語から並べる */
    words: string[];
    /** 正規化した語から、優先の順（索引の `terms` → 描く文書の表 → ほかの文書の表）で選んだ用語 */
    terms: Map<string, {
        id: string;
        meaning: string;
    }>;
    /** 正規化した語から、その語を `aliases` に持つ文書（索引の `docs` の順） */
    docs: Map<string, MdmarkIndexDoc[]>;
    /** 正規化したやめた言い方から代わりの用語（`glossary` がオンのとき、索引の `terms[].avoid` と用語集の表の用語の `avoid` から。同じ言い方は索引の `terms`、索引の `docs` の順の文書の表の順で先の用語）。用語の語・別名と同じ語は入れない。`words` には入れず、照合でやめた言い方を使う側だけが `words` に足す */
    avoided: Map<string, {
        id: string;
        term: string;
        meaning: string;
    }>;
    /** 正規化した語から、索引・用語集の表・文書の `aliases` に記載した表記。`words` と `avoided` の語を持ち、同じ正規化の語は `terms`・`avoided` と同じ優先の順で先の表記 */
    written: Map<string, string>;
    /** 語を `normalizeWord` で正規化してから `terms` を引く。`findWords` を通らずに書いた語で用語を引く箇所が使う */
    term: (word: string) => {
        id: string;
        meaning: string;
    } | undefined;
};
/** 索引の用語・描く文書の表の用語・参照の表の用語・文書の別名から辞書を作る */
export declare function buildDictionary(options: {
    /** 索引 */
    index?: MdmarkIndex | undefined;
    /** 描く文書の索引の `id` */
    docId?: string | undefined;
    /** 描く文書の用語集の表から読んだ用語 */
    ownGlossary: MdmarkGlossaryEntry[];
    /** 参照の表 */
    references?: MdmarkReferences | undefined;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
}): Dictionary;
/** 文字列を語に区切り、各語の始まりの位置（UTF-16 の位置）を頭から順に返す。区切り方は実行環境の辞書に依る */
export declare function wordStarts(text: string): number[];
/** 文字列の中で、元の文字列を語の区切りごとに NFKC と英字の小文字化をかけてつなぎ、始まりと終わりが区切りに揃う辞書の語（`normalizeWord` で正規化した語）の位置を、元の文字列の位置で、重ならないよう長い語を先に、頭から順に返す。`word` は `words` に渡したままの語で、正規化した後に同じになる語は `words` で先の語 */
export declare function findWords(text: string, words: string[]): Array<{
    start: number;
    end: number;
    word: string;
}>;
/** 見出しを除く行内のトークンを、文書の頭から順に渡す。`section` は見出し（h2〜h4）ごとに進む節の番号 */
export declare function forEachInline(tokens: Token[], callback: (inline: Token, section: number) => void): void;
/** 行内のトークンの子のうち、照合してよい文字の位置を返す（リンクの中・コード・用語集の表の中は除く） */
export declare function matchableChildren(inline: Token): number[];
