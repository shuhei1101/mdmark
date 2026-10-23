import type { MarkdownIt as MarkdownItParser } from "markdown-it";
import type { LibraryEntry } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
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
    /** 拡張の印の範囲から読んだ部品の定義（印の場所の `data-mdmark-definition` の番号で引く） */
    extensionDefinitions?: unknown[];
    /** 描いた操作できる部品の定義（文書の中の並びの順） */
    paramDefinitions?: MdmarkParamDefinition[];
    /** 描いた図と操作できる部品の数（`id` の通し番号。範囲の印と埋め込んだ HTML で共有する） */
    diagramCount?: number;
    /** 用語のツールチップの数（`id` の通し番号。埋め込んだ HTML と本文で共有する） */
    termTipCount?: number;
    /** ヒントのツールチップの数（`id` の通し番号） */
    hintCount?: number;
    /** ビューの書き方の警告の数（`id` の通し番号） */
    viewCount?: number;
};
/** Markdown の生の HTML のブロックと行内の HTML から印の名前と行の番号（1 から）を、書いた順に返す。閉じの印も 1 つの印として返す */
export declare function findMarks(markdown: string): Array<{
    name: string;
    line: number;
}>;
/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export declare function createParser(): MarkdownItParser;
