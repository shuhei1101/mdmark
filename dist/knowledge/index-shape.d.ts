/** 索引の文書 1 つ */
export type MdmarkIndexDoc = {
    /** 文書の ID。`docs` の中で一意 */
    id: string;
    /** 文書のパス。索引のファイルのあるフォルダからの相対パス */
    path: string;
    /** 文書の題 */
    title: string;
    /** 1 文の概要 */
    description?: string;
    /** 本文での呼び名 */
    aliases?: string[];
    /** タグ */
    tags?: string[];
    /** 関連する文書の `id` */
    related?: string[];
};
/** 索引の用語 1 つ */
export type MdmarkIndexTerm = {
    /** 用語の ID。`terms` の中で一意 */
    id: string;
    /** 用語の語 */
    term: string;
    /** 別名 */
    aliases?: string[];
    /** 意味 */
    meaning: string;
    /** やめた言い方 */
    avoid?: string[];
};
/** 使う側が索引の YAML を読んだ値の型 */
export type MdmarkIndex = {
    /** 索引の版 */
    schema: 1;
    /** 文書 */
    docs: MdmarkIndexDoc[];
    /** 用語 */
    terms?: MdmarkIndexTerm[];
};
/** 索引のキー 1 つの型と必須か */
type KeyShape = {
    /** `string[]` は空でない文字列の並び、`array` は並びであること */
    type: "string" | "string[]" | "integer" | "array";
    required: boolean;
};
/** 索引の最上位・`docs` の要素・`terms` の要素ごとの、キーと型と必須か */
export declare const INDEX_SHAPE: {
    root: Record<string, KeyShape>;
    doc: Record<string, KeyShape>;
    term: Record<string, KeyShape>;
};
/** 索引の形に合わない場所 */
export type IndexProblem = {
    /** 合わない場所（`docs[1].path` の形。ファイル全体は空文字） */
    where: string;
    /** 合わない内容 */
    message: string;
};
/** 値を索引の形で検査し、合う文書・用語だけの索引と、合わない場所の一覧を返す */
export declare function normalizeIndex(value: unknown): {
    index: MdmarkIndex;
    problems: IndexProblem[];
};
export {};
