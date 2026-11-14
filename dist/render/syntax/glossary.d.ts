import type { StateCore, Token } from "markdown-it";
import type { MdmarkGlossaryEntry } from "../../knowledge/references.ts";
import type { MarkOptions } from "../mark-options.ts";
/** 用語集の表の 1 行から読み込んだ用語と、その行の文書の中の行番号（1 から） */
export type GlossaryRow = {
    entry: MdmarkGlossaryEntry;
    line: number;
};
/** 範囲の中のトークンの表から、用語・意味・別名・やめた言い方の列を読み込んで行ごとの用語を返却する。誤りがあれば表ごとに用語を入れず、最初の誤りを警告にする */
export declare function readGlossaryRows(options: {
    options: MarkOptions;
    tokens: Token[];
    docId: string;
}): {
    rows: GlossaryRow[];
    warning?: string;
};
/** 用語集の表を読み込んで用語を返却する。表に無い列名と必須の指定の欠けは、用語を返却せず記載の警告の本文を返却する */
export declare function readGlossaryTable(options: {
    /** マーカーの設定 */
    options: MarkOptions;
    /** 範囲の中のトークン */
    tokens: Token[];
    /** 表を持つ文書の `id`（索引を指定しないときは空文字） */
    docId: string;
}): {
    entries: MdmarkGlossaryEntry[];
    warning?: string;
};
/** `glossary` のマーカーの範囲を取り除き、中の表を普通の表として残し、読み込んだ用語を `env.ownGlossary` に追加する（行番号は `env.glossaryLines` に同じ並びで追加する） */
export declare function glossaryRule(state: StateCore): void;
