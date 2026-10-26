import type { Token } from "markdown-it";
import { type MdmarkIndex, type MdmarkIndexDoc, type MdmarkIndexTerm } from "./index-shape.ts";
/** `checkIndex` が返すずれ 1 件 */
export type MdmarkIndexIssue = {
    /** ずれのあるファイル */
    file: string;
    /** 索引のキーのパスか文書の行。ファイル全体は空文字 */
    where: string;
    /** ずれの種類 */
    kind: "schema" | "missing_doc" | "orphan_doc" | "broken_ref" | "untyped_related" | "one_sided_change_together" | "related_link_overlap" | "missed_change_together" | "duplicate_term" | "avoided_term" | "duplicate_tag" | "tag_alias_conflict" | "broken_tag_replacement" | "unregistered_tag" | "deprecated_tag";
    /** ずれの内容と直し方 */
    message: string;
};
/** `findAvoidedTerms` が探す用語: 語・別名・やめた言い方 */
type AvoidableTerm = Pick<MdmarkIndexTerm, "term" | "aliases" | "avoid">;
/** 1 つの文書のトークンから、用語のやめた言い方が出た行とやめた言い方の組を `avoided_term` のずれにする */
export declare function findAvoidedTerms(options: {
    /** ずれの `file` に出す文書のパス */
    file: string;
    /** `parseDocument` のトークン */
    tokens: Token[];
    /** 用語（索引の用語の後に、索引の `docs` の順の文書の用語集の表の用語を続けた並び。同じやめた言い方は先の用語を使う） */
    terms: AvoidableTerm[];
}): MdmarkIndexIssue[];
/** 索引のタグの語彙と文書のタグから、`duplicate_tag`・`tag_alias_conflict`・`broken_tag_replacement`・`unregistered_tag`・`deprecated_tag` のずれをこの順で返す。語彙が無い索引では空 */
export declare function findTagIssues(input: {
    /** 形に合う要素だけの索引 */
    index: MdmarkIndex;
    /** 索引の YAML を読んだ値。ずれの場所は、この値の `tags`・`docs` の並びで数える */
    raw: unknown;
    /** ずれの `file` に出す索引のファイルの名前 */
    indexFile: string;
}): MdmarkIndexIssue[];
/** 索引の関連から `untyped_related`・`one_sided_change_together`・`related_link_overlap` をこの順で返す。同じ種類の中は索引の `docs` の並び、文書の中は `related` の並び */
export declare function findRelatedIssues(options: {
    /** 検査で合う要素だけにした索引 */
    index: MdmarkIndex;
    /** 文書の `id` から、本文のリンクが指す文書のパス。本文を持たない文書はキーを持たない */
    links: Record<string, string[]>;
    /** ずれの `file` に出す索引のファイルの名前 */
    indexFile: string;
    /** `where` に出す文書の位置。省くと `index.docs` の位置 */
    positionOf?: (doc: MdmarkIndexDoc) => number;
}): MdmarkIndexIssue[];
/** `change_together` の組のうち、片方の文書だけが `changedPaths` にある組を `missed_change_together` で返す。組は向きを問わず 1 回だけ確かめ、先に記載した側の文書の索引の並びで返す */
export declare function findMissedChangeTogether(options: {
    /** 検査で合う要素だけにした索引 */
    index: MdmarkIndex;
    /** 比べる基準から変わった文書のパス */
    changedPaths: string[];
}): MdmarkIndexIssue[];
/** 索引と文書の本文から、`schema`・`missing_doc`・`orphan_doc`・`broken_ref`・`untyped_related`・`one_sided_change_together`・`related_link_overlap`・`missed_change_together`・`duplicate_term`・`avoided_term`・`duplicate_tag`・`tag_alias_conflict`・`broken_tag_replacement`・`unregistered_tag`・`deprecated_tag` のずれをこの順で返す */
export declare function checkIndex(input: {
    /** 索引の値（形を確かめる前のもの） */
    index: unknown;
    /** 文書のパスから本文を引く表 */
    documents: Record<string, string>;
    /** ずれの `file` に出す索引のファイルの名前（既定 `index.yaml`） */
    indexFile?: string;
    /** 比べる基準から変わった文書のパス。渡したときだけ `change_together` の直し忘れを確かめる */
    changedPaths?: string[];
}): MdmarkIndexIssue[];
export {};
