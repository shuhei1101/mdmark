import type { Token } from "markdown-it";
import { type MdmarkConfig } from "../config.ts";
import { type MdmarkIndex } from "./index-shape.ts";
/** 用語集の表の 1 行から入れた用語 */
export type MdmarkGlossaryEntry = {
    /** 用語の列の文字 */
    term: string;
    /** 別名の列を「、」「,」で区切ったもの。別名の列が無いときは空 */
    aliases: string[];
    /** 意味の列の文字 */
    meaning: string;
    /** 表を持つ文書の `id` */
    docId: string;
};
/** `collectReferences` が返し、`mount`・`render` の `opts.references` が受け取る参照の表 */
export type MdmarkReferences = {
    /** 文書の `id` から、その文書を参照している文書の `id` の並び */
    backlinks: Record<string, string[]>;
    /** 各文書の用語集の表から入れた用語 */
    glossary: MdmarkGlossaryEntry[];
};
/** 文書の本文を読んだ結果 */
export type ParsedDocument = {
    /** 解析器のトークン */
    tokens: Token[];
    /** 文書の印を重ねて決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** 用語集の表の 1 行ごとの用語と、その行の行番号（1 から）・やめた言い方 */
    glossary: Array<{
        entry: MdmarkGlossaryEntry;
        line: number;
        avoid: string[];
    }>;
};
/** 文書の本文を、印・機能・用語集の表を読んだトークンにする */
export declare function parseDocument(options: {
    /** 本文の Markdown */
    body: string;
    /** 文書の `id` */
    docId: string;
    /** 設定の `features` */
    defaults: Record<string, boolean>;
}): ParsedDocument;
/** 索引と全ての文書の本文から、文書ごとの被参照と、各文書の用語集の表から入れた用語を返す */
export declare function collectReferences(input: {
    /** 索引 */
    index: MdmarkIndex;
    /** 文書のパスから本文を引く表 */
    documents: Record<string, string>;
    /** 設定 */
    config?: MdmarkConfig;
}): MdmarkReferences;
