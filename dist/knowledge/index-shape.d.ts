/** 文書のタグのうち、主題のタグかを持つオブジェクト */
export type MdmarkIndexDocTag = {
    /** タグの名前 */
    name: string;
    /** 主題のタグか。無いときは `false` として扱う */
    main?: boolean;
};
/** 関係の種類。`MdmarkIndexRelated` の `type` に記載できる値 */
export type MdmarkRelationType = 
/** 相手を先に読み込まないと分からない */
"requires"
/** 相手を必要なときに参照する */
 | "references"
/** 相手を置き換えた */
 | "replaces"
/** 相手の一部をなす */
 | "part_of"
/** 片方を修正したらもう片方も修正する。両側に記載する */
 | "change_together";
/** `MdmarkRelationType` の値（記載できる順） */
export declare const RELATION_TYPES: readonly MdmarkRelationType[];
/** 文書の関連のうち、関係の種類といつ読み込むかを持つオブジェクト */
export type MdmarkIndexRelated = {
    /** 相手の文書の `id` */
    to: string;
    /** 関係の種類 */
    type: MdmarkRelationType;
    /** いつ読み込むかの 1 文 */
    when: string;
    /** 関連が該当するファイルの glob の並び */
    paths?: string[];
};
/** 索引の文書 1 つ */
export type MdmarkIndexDoc = {
    /** 文書の ID。`docs` の中で一意 */
    id: string;
    /** 文書のパス。索引のファイルのあるフォルダからの相対パス */
    path: string;
    /** 文書のタイトル */
    title: string;
    /** 1 文の概要 */
    description?: string;
    /** 本文での呼び名 */
    aliases?: string[];
    /** タグ。要素はタグの名前か、主題のタグかを持つオブジェクト */
    tags?: (string | MdmarkIndexDocTag)[];
    /** 他の文書への関連。要素は関連する文書の `id` か、`MdmarkIndexRelated` */
    related?: (string | MdmarkIndexRelated)[];
};
/** 索引の用語 1 つ */
export type MdmarkIndexTerm = {
    /** 用語の ID。`terms` の中で一意 */
    id: string;
    /** 用語の単語 */
    term: string;
    /** 別名 */
    aliases?: string[];
    /** 意味 */
    meaning: string;
    /** やめた言い方 */
    avoid?: string[];
};
/** 利用側が索引の YAML を読み込んだ値の型 */
export type MdmarkIndex = {
    /** 索引のバージョン */
    schema: 2;
    /** 文書 */
    docs: MdmarkIndexDoc[];
    /** 用語 */
    terms?: MdmarkIndexTerm[];
};
/** 索引のキー 1 つの型と必須か */
type KeyShape = {
    /** `string[]` は空でない文字列の並び、`array` は並びであること、`doc_tags` は空でない文字列か `name`（必須）と `main` だけを持つオブジェクトの並び、`doc_related` は空でない文字列か `to`・`type`・`when`（必須）と `paths` だけを持つオブジェクトの並び */
    type: "string" | "string[]" | "integer" | "array" | "doc_tags" | "doc_related" | "boolean";
    required: boolean;
};
/** 索引の最上位・`docs` の要素・`terms` の要素ごとの、キーと型と必須か */
export declare const INDEX_SHAPE: {
    root: Record<string, KeyShape>;
    doc: Record<string, KeyShape>;
    term: Record<string, KeyShape>;
};
/** 索引の構造に合わない場所 */
export type IndexProblem = {
    /** 合わない場所（`docs[1].path` の構造。ファイル全体は空文字） */
    where: string;
    /** 合わない内容 */
    message: string;
};
/** 値を索引の構造で検査し、合う文書・用語だけの索引と、合わない場所の一覧を返却する */
export declare function normalizeIndex(value: unknown): {
    index: MdmarkIndex;
    problems: IndexProblem[];
};
/** 文書の関連の要素を、`to`・`type`・`when` を持つオブジェクトにそろえる。文字列の要素は `type` と `when` が `null` のオブジェクトにする */
export declare function readRelated(item: string | MdmarkIndexRelated): {
    to: string;
    type: MdmarkRelationType | null;
    when: string | null;
    paths?: string[];
};
export {};
