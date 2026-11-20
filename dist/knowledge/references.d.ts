import type { Token } from "markdown-it";
import { type MdmarkConfig } from "../config.ts";
import { type MdmarkIndex, type MdmarkIndexDoc, type MdmarkIndexDocTag } from "./index-shape.ts";
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
    /** やめた言い方の列を「、」「,」で区切ったもの。やめた言い方の列が無いときは空。利用側が組み立てた参照の表で無いときは、やめた言い方を持たない用語として扱う */
    avoid?: string[] | undefined;
};
/** `collectReferences` が返却し、`mount`・`render` の `opts.references` が受け取る参照の表 */
export type MdmarkReferences = {
    /** 文書の `id` から、その文書を参照している文書の `id` の並び */
    backlinks: Record<string, string[]>;
    /** 各文書の用語集の表から入れた用語 */
    glossary: MdmarkGlossaryEntry[];
    /** 索引の文書をフロントマターの値で補い、索引に無い文書を加えた並び（どの文書も `title` を持つ）。`collectReferences` は常に入れる。利用側が組み立てた参照の表で無いときは、`opts.index` の `docs` を使用する */
    docs?: MdmarkIndexDoc[] | undefined;
};
/** 1 つの文書のフロントマターから取り出した、使用できる値だけのメタデータ */
export type FrontmatterMetadata = {
    /** 空でない文字列の `title` */
    title?: string;
    /** 空でない文字列の `description` */
    description?: string;
    /** 空でない文字列の並びの `aliases` */
    aliases?: string[];
    /** 索引の `docs[].tags` と同じ要素の並びの `tags` */
    tags?: (string | MdmarkIndexDocTag)[];
};
/** 呼ぶ側が解析したフロントマターの値から、`title`・`description`・`aliases`・`tags` のうち型の合うキーだけを取り出す */
export declare function readFrontmatterMetadata(value: unknown): FrontmatterMetadata;
/** 文書のタイトルを決める: 索引の `title`、無ければフロントマターの `title`、無ければ本文の最初の h1 の文字、無ければ拡張子を落としたファイル名 */
export declare function resolveDocTitle(doc: {
    path: string;
    markdown: string;
    indexTitle?: string | undefined;
    frontmatterTitle?: string | undefined;
}): string;
/** 索引の文書に無いキーをフロントマターの値で補い、索引に無く `title` を持つ文書を加えた文書の並びを返却する。引数を書き換えない */
export declare function supplementIndexDocs(input: {
    /** `normalizeIndex` で検査した索引 */
    index: MdmarkIndex;
    /** 文書のパスから本文を参照する表 */
    documents: Record<string, string>;
    /** 文書のパスから、解析したフロントマターの値を参照する表 */
    frontmatter?: Record<string, unknown> | undefined;
}): {
    docs: MdmarkIndexDoc[];
    added: Set<string>;
    metadata: Map<string, FrontmatterMetadata>;
};
/** 文書の本文を読み込んだ結果 */
export type ParsedDocument = {
    /** 解析器のトークン */
    tokens: Token[];
    /** 文書のマーカーを重ねて決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** 用語集の表の 1 行ごとの用語と、その行の行番号（1 から） */
    glossary: Array<{
        entry: MdmarkGlossaryEntry;
        line: number;
    }>;
};
/** 文書の本文を、マーカー・機能・用語集の表を読み込んだトークンにする */
export declare function parseDocument(options: {
    /** 本文の Markdown */
    body: string;
    /** 文書の `id` */
    docId: string;
    /** 設定の `features` */
    defaults: Record<string, boolean>;
}): ParsedDocument;
/** 本文のリンクが指す、索引のパスの集まり */
export declare function linkedPaths(doc: MdmarkIndexDoc, tokens: Token[]): Set<string>;
/** 索引と全ての文書の本文から、文書ごとの被参照と、各文書の用語集の表から入れた用語を返却する */
export declare function collectReferences(input: {
    /** 索引 */
    index: MdmarkIndex;
    /** 文書のパスから本文を参照する表 */
    documents: Record<string, string>;
    /** 設定 */
    config?: MdmarkConfig;
    /** 文書のパスから、解析したフロントマターの値を参照する表 */
    frontmatter?: Record<string, unknown> | undefined;
}): MdmarkReferences;
