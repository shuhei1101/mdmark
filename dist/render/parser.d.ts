import type { MarkdownIt as MarkdownItParser, StateCore } from "markdown-it";
import type { LibraryEntry, PageSettings } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkMarkArgs } from "../extensions.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "../knowledge/references.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import { type FootnoteState } from "./syntax/footnotes.ts";
import { type CollectedWarning } from "./syntax/warnings.ts";
/** markdown-it の `env` としてコアルールに渡す値と、コアルールが拾った印 */
export type RenderEnv = {
    /** 対応表（どの印を印の場所の要素にするか） */
    libraries: Record<string, LibraryEntry>;
    /** 設定の `features` */
    defaults: Record<string, boolean>;
    /** 既定を当てた設定の `labels`（部品の文言） */
    labels?: {
        paramCopy: string;
    };
    /** `features` の印の引数を書いた順に並べたもの */
    featureArgs: string[];
    /** `defaults` に `featureArgs` を重ねたもの */
    features: Record<string, boolean>;
    /** 文書の先頭の page の印を書いた順に並べたもの（`takeMarks` が足す） */
    pageMarks?: Array<{
        raw: string;
        args: MdmarkMarkArgs;
    }>;
    /** `pageMarks` を読んだページの設定（`resolvePageSettings` が入れる） */
    page?: PageSettings;
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
    /** 使う側が渡したエイリアス（`render`・`mount` の `aliases`）。`termsRule`・`buildEmbeddedHtml` が `buildDictionary` に渡す */
    aliases?: readonly unknown[] | undefined;
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
    /** 読んだ脚注の定義と参照（定義の block のルールが作り、機能がオフなら `collectFootnotes` が消す） */
    mdmarkFootnotes?: FootnoteState | undefined;
    /** ヒントのツールチップの数（`id` の通し番号） */
    hintCount?: number;
    /** ビューの書き方の警告の数（`id` の通し番号） */
    viewCount?: number;
    /** 取り込む文書の表（`render`・`mount` の `includes`） */
    includes?: Record<string, string> | undefined;
    /** 束ねていない名前のアイコンの形の表（`render`・`mount` の `icons`） */
    icons?: Record<string, MdmarkIconNode> | undefined;
    /** 描いた書き方の警告（最後のコアルール `collectWarningsRule` が入れる） */
    warnings?: CollectedWarning[];
};
/** ブロックの開始のトークンに、Markdown で始まる行の番号（0 始まり）を `data-source-line` で付ける */
export declare function markSourceLines(state: StateCore): void;
/** Markdown の生の HTML のブロックと行内の HTML から印の名前と行の番号（1 から）を、書いた順に返す。閉じの印も 1 つの印として返す */
export declare function findMarks(markdown: string): Array<{
    name: string;
    line: number;
}>;
/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export declare function createParser(): MarkdownItParser;
