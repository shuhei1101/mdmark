import type { MarkdownIt as MarkdownItParser, StateCore } from "markdown-it";
import type { LibraryEntry, PageSettings } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkGlossaryEntry, MdmarkReferences } from "../knowledge/references.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import type { MarkOptions } from "./mark-options.ts";
import type { MarkNote } from "./mark-schema.ts";
import { type FootnoteState } from "./syntax/footnotes.ts";
import { type CollectedWarning } from "./syntax/warnings.ts";
/** markdown-it の `env` としてコアルールに指定する値と、コアルールが取得したマーカー */
export type RenderEnv = {
    /** 対応表（どのマーカーをマーカーの場所の要素にするか） */
    libraries: Record<string, LibraryEntry>;
    /** 設定の `features` */
    defaults: Record<string, boolean>;
    /** 既定を適用した設定の `labels`（部品の文言） */
    labels?: {
        paramCopy: string;
    };
    /** `features` のマーカーの JSON のオブジェクトを記載した順に並べたもの */
    featureOptions: Array<Record<string, boolean>>;
    /** `defaults` に `featureOptions` を重ねたもの */
    features: Record<string, boolean>;
    /** 文書の先頭の page のマーカーの設定を記載した順に並べたもの（`takeMarks` が追加する） */
    pageOptions?: Array<{
        raw: string;
        options: MarkOptions;
    }>;
    /** `pageOptions` を読み込んだページの設定（`resolvePageSettings` が入れる） */
    page?: PageSettings;
    /** 見出しの ID と文字 */
    headings: Array<{
        level: number;
        id: string;
        text: string;
    }>;
    /** 描くごとに作る、mdmark が出した要素のマーカーの値 */
    nonce: string;
    /** `normalizeIndex` で合う要素だけにした索引 */
    index?: MdmarkIndex | undefined;
    /** 描く文書の索引の `id`（索引に無ければ `undefined`） */
    docId?: string | undefined;
    /** 参照の表（markdown-it が `env.references` にリンク参照定義を入れるため、別の名前にする） */
    mdmarkReferences?: MdmarkReferences | undefined;
    /** 利用側が指定したエイリアス（`render`・`mount` の `aliases`）。`termsRule`・`buildEmbeddedHtml` が `buildDictionary` に指定する */
    aliases?: readonly unknown[] | undefined;
    /** 描く文書の用語集の表から読み込んだ用語（`glossaryRule` が追加する） */
    ownGlossary: MdmarkGlossaryEntry[];
    /** `ownGlossary` の各用語の行番号。点検が行を示すために指定したときだけ、`glossaryRule` が追加する */
    glossaryLines?: number[] | undefined;
    /** 拡張のマーカーの範囲から読み込んだ部品の定義（マーカーの場所の `data-mdmark-definition` の番号で参照する） */
    extensionDefinitions?: unknown[];
    /** 描いた操作できる部品の定義（文書の中の並びの順） */
    paramDefinitions?: MdmarkParamDefinition[];
    /** 描いた図と操作できる部品の数（`id` の通し番号。範囲のマーカーと埋め込んだ HTML で共有する） */
    diagramCount?: number;
    /** 用語のツールチップの数（`id` の通し番号。埋め込んだ HTML と本文で共有する） */
    termTipCount?: number;
    /** 読み込んだ脚注の定義と参照（定義の block のルールが作り、機能がオフなら `collectFootnotes` が削除する） */
    mdmarkFootnotes?: FootnoteState | undefined;
    /** ヒントのツールチップの数（`id` の通し番号） */
    hintCount?: number;
    /** ビューの記載の警告の数（`id` の通し番号） */
    viewCount?: number;
    /** 取り込む文書の表（`render`・`mount` の `includes`） */
    includes?: Record<string, string> | undefined;
    /** まとめていない名前のアイコンの形状の表（`render`・`mount` の `icons`） */
    icons?: Record<string, MdmarkIconNode> | undefined;
    /** 描いた記載の警告（最後のコアルール `collectWarningsRule` が入れる） */
    warnings?: CollectedWarning[];
    /** 画面に出さず点検だけがずれにするマーカーの注記と、マーカーの行（1 から） */
    markNotes: Array<MarkNote & {
        line: number;
    }>;
    /** 文書の先頭のフロントマターの中身と閉じる行の 0 始まりの行番号（`renderDocument` が入れ、`insertFrontmatter` が読む） */
    frontmatter?: {
        content: string;
        endLine: number;
    } | undefined;
};
/** ブロックの開始のトークンに、Markdown で始まる行の番号（0 始まり）を `data-source-line` で付ける */
export declare function markSourceLines(state: StateCore): void;
/** 文書から取得したマーカー 1 つ（`findMarks` の結果） */
export type FoundMark = {
    /** マーカーの名前 */
    name: string;
    /** マーカーの行（1 から） */
    line: number;
    /** マーカーの文字のまま */
    raw: string;
    /** 閉じのマーカーか */
    closing: boolean;
    /** マーカーの `:` の後ろの文字（無ければ空） */
    args: string;
};
/** Markdown の生の HTML のブロックと行内の HTML からマーカーの名前と行の番号（1 から）を、記載した順に返却する。閉じのマーカーも 1 つのマーカーとして返却する */
export declare function findMarks(markdown: string): Array<{
    name: string;
    line: number;
}>;
/** `findMarks` と同じマーカーを、マーカーの文字と引数の文字と一緒に返却する */
export declare function findMarkTexts(markdown: string): FoundMark[];
/** `html: true`・`linkify: true` の解析器に、追加するコアルールを登録して返却する */
export declare function createParser(): MarkdownItParser;
