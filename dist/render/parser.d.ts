import type { MarkdownIt as MarkdownItParser } from "markdown-it";
import type { LibraryEntry } from "../config.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "../knowledge/references.ts";
/** markdown-it の `env` としてコアルールに渡す値と、コアルールが拾った印 */
export type RenderEnv = {
    /** 対応表（どの印を印の場所の要素にするか） */
    libraries: Record<string, LibraryEntry>;
    /** 設定の `features` */
    defaults: Record<string, boolean>;
    /** `features` の印の引数を書いた順に並べたもの */
    featureArgs: string[];
    /** `defaults` に `featureArgs` を重ねたもの */
    features: Record<string, boolean>;
    /** 見出しの ID と文字 */
    headings: Array<{
        level: number;
        id: string;
        text: string;
    }>;
    /** 描くごとに作る、mdmark が出した要素の印の値 */
    nonce: string;
    /** `normalizeIndex` で合う要素だけにした索引 */
    index?: MdmarkIndex | undefined;
    /** 描く文書の索引の `id`（索引に無ければ `undefined`） */
    docId?: string | undefined;
    /** 参照の表（markdown-it が `env.references` にリンク参照定義を入れるため、別の名前にする） */
    mdmarkReferences?: MdmarkReferences | undefined;
    /** 描く文書の用語集の表から読んだ用語（`glossaryRule` が足す） */
    ownGlossary: MdmarkGlossaryEntry[];
    /** `ownGlossary` の各用語の行番号。点検が行を示すために渡したときだけ、`glossaryRule` が足す */
    glossaryLines?: number[] | undefined;
};
/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export declare function createParser(): MarkdownItParser;
