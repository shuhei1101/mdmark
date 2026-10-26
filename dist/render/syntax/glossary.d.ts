import type { StateCore, Token } from "markdown-it";
import type { MdmarkMarkArgs } from "../../extensions.ts";
import type { MdmarkGlossaryEntry } from "../../knowledge/references.ts";
/** 用語集の表の 1 行から読んだ用語と、その行の文書の中の行番号（1 から） */
export type GlossaryRow = {
    entry: MdmarkGlossaryEntry;
    line: number;
};
/** 範囲の中のトークンの表から、用語・意味・別名・やめた言い方の列を読んで行ごとの用語を返す。誤りがあれば表ごとに用語を入れず、最初の誤りを警告にする */
export declare function readGlossaryRows(options: {
    args: MdmarkMarkArgs;
    tokens: Token[];
    docId: string;
}): {
    rows: GlossaryRow[];
    warning?: string;
};
/** 用語集の表を読んで用語を返す。表に無い列名と必須の指定の欠けは、用語を返さず書き方の警告の本文を返す */
export declare function readGlossaryTable(options: {
    /** 印の引数 */
    args: MdmarkMarkArgs;
    /** 範囲の中のトークン */
    tokens: Token[];
    /** 表を持つ文書の `id`（索引を渡さないときは空文字） */
    docId: string;
}): {
    entries: MdmarkGlossaryEntry[];
    warning?: string;
};
/** `glossary` の印の範囲を取り除き、中の表を普通の表として残し、読んだ用語を `env.ownGlossary` に足す（行番号は `env.glossaryLines` に同じ並びで足す） */
export declare function glossaryRule(state: StateCore): void;
