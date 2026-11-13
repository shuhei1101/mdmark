import type { Token } from "markdown-it";
import { type MdmarkAlias } from "./aliases.ts";
import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "./references.ts";
/** 照合・点検・検索の前に、単語に NFKC・英字の小文字化・前後の空白の除去をかける */
export declare function normalizeWord(word: string): string;
/** 照合の辞書: 索引の用語・用語集の表の用語・文書の別名を、照合する単語から参照できる構造にまとめたもの */
export type Dictionary = {
    /** 照合する単語。`normalizeWord` で正規化した単語を、長い単語から並べる */
    words: string[];
    /** 正規化した単語から、優先の順（索引の `terms` → エイリアス（指定した並び） → 描く文書の表 → ほかの文書の表）で選んだ用語。エイリアスは `id` を `alias:{エイリアスの id}`、`meaning` を `description`（無ければ空文字）にし、`alias` にそのエイリアスを持つ */
    terms: Map<string, {
        id: string;
        meaning: string;
        alias?: MdmarkAlias;
    }>;
    /** 正規化した単語から、その単語を `aliases` に持つ文書（索引の `docs` の順） */
    docs: Map<string, MdmarkIndexDoc[]>;
    /** 正規化したやめた言い方から代わりの用語（`glossary` がオンのとき、索引の `terms[].avoid`、エイリアスの `avoid` の種類の `name`・`aliases` と `term` の種類の `avoid`、用語集の表の用語の `avoid` から。同じ言い方は索引の `terms`、エイリアスの並び、索引の `docs` の順の文書の表の順で先の用語）。`avoid` の種類は `term` を `replacement` にして `meaning` を持たず、`term` の種類は `term` を名前、`meaning` を `description` にする。エイリアスの代わりの用語は `id` を `alias:{エイリアスの id}` にし、`alias` にそのエイリアスを持つ。用語の単語・別名と同じ単語は入れない。`words` には入れず、照合でやめた言い方を利用側だけが `words` に追加する */
    avoided: Map<string, {
        id: string;
        term: string;
        meaning?: string;
        alias?: MdmarkAlias;
    }>;
    /** 正規化した単語から、索引・用語集の表・文書の `aliases` に記載した表記。`words` と `avoided` の単語を持ち、同じ正規化の単語は `terms`・`avoided` と同じ優先の順で先の表記 */
    written: Map<string, string>;
    /** 単語を `normalizeWord` で正規化してから、エイリアスを除いた用語を参照する。`findWords` を通らずに記載した単語で用語を参照する箇所（図のノード・埋め込んだ HTML のチャートの `{{単語}}`）が使用する。エイリアスの単語は参照しない */
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
    /** 描く文書の用語集の表から読み込んだ用語 */
    ownGlossary: MdmarkGlossaryEntry[];
    /** 参照の表 */
    references?: MdmarkReferences | undefined;
    /** 利用側が指定したエイリアス。使用できるものだけを照合する */
    aliases?: readonly unknown[] | undefined;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
}): Dictionary;
/** 文字列を単語に区切り、各語の始まりの位置（UTF-16 の位置）を頭から順に返却する。区切り方は実行環境の辞書に依る */
export declare function wordStarts(text: string): number[];
/** 文字列の中で、元の文字列を単語の区切りごとに NFKC と英字の小文字化をかけてつなぎ、始まりと終わりが区切りに一致する辞書の単語（`normalizeWord` で正規化した単語）の位置を、元の文字列の位置で、重ならないよう長い単語を先に、頭から順に返却する。`word` は `words` に指定したままの単語で、正規化した後に同じになる単語は `words` で先の単語 */
export declare function findWords(text: string, words: string[]): Array<{
    start: number;
    end: number;
    word: string;
}>;
/** 見出しを除く行内のトークンを、文書の頭から順に指定する。`section` は見出し（h2〜h4）ごとに進むセクションの番号 */
export declare function forEachInline(tokens: Token[], callback: (inline: Token, section: number) => void): void;
/** 行内のトークンの子のうち、照合してよい文字の位置を返却する（リンクの中・コード・用語集の表の中は除く） */
export declare function matchableChildren(inline: Token): number[];
