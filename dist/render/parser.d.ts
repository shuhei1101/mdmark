import type { MarkdownIt as MarkdownItParser } from "markdown-it";
import type { LibraryEntry } from "../config.ts";
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
};
/** `html: true`・`linkify: true` の解析器に、足すコアルールを登録して返す */
export declare function createParser(): MarkdownItParser;
