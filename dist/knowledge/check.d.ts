import type { Token } from "markdown-it";
import { type MdmarkIndexTerm } from "./index-shape.ts";
/** `checkIndex` が返すずれ 1 件 */
export type MdmarkIndexIssue = {
    /** ずれのあるファイル */
    file: string;
    /** 索引のキーのパスか文書の行。ファイル全体は空文字 */
    where: string;
    /** ずれの種類 */
    kind: "schema" | "missing_doc" | "orphan_doc" | "broken_ref" | "duplicate_term" | "avoided_term";
    /** ずれの内容と直し方 */
    message: string;
};
/** 1 つの文書のトークンから、用語のやめた言い方が出た行とやめた言い方の組を `avoided_term` のずれにする */
export declare function findAvoidedTerms(options: {
    /** ずれの `file` に出す文書のパス */
    file: string;
    /** `parseDocument` のトークン */
    tokens: Token[];
    /** 索引の用語 */
    terms: MdmarkIndexTerm[];
}): MdmarkIndexIssue[];
/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`duplicate_term`・`avoided_term` のずれをこの順で返す */
export declare function checkIndex(input: {
    /** 索引の値（形を確かめる前のもの） */
    index: unknown;
    /** 文書のパスから本文を引く表 */
    documents: Record<string, string>;
    /** ずれの `file` に出す索引のファイルの名前（既定 `index.yaml`） */
    indexFile?: string;
}): MdmarkIndexIssue[];
