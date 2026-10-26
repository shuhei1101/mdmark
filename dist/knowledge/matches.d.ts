import type { Token } from "markdown-it";
import { type MdmarkConfig } from "../config.ts";
import { type Dictionary } from "./dictionary.ts";
import { type MdmarkIndex } from "./index-shape.ts";
/** `collectMatches` が返す参照先 1 つ */
export type MdmarkMatchTarget = {
    /** 参照先の種類。`term` は索引の用語、`glossary` は用語集の表の用語、`doc` は別名が一致した文書 */
    kind: "term" | "glossary" | "doc";
    /** `term` は `terms[].id`、`glossary` は `glossary:{表を持つ文書の id}:{用語}`、`doc` は `docs[].id` */
    id: string;
    /** `term` は `terms[].term`、`glossary` は用語の列、`doc` は `docs[].title` */
    title: string;
    /** `term` は `terms[].meaning`、`glossary` は意味の列、`doc` は `docs[].description`。無いときはキーを持たない */
    description?: string;
};
/** 本文の 1 つの一致とその参照先 */
export type MdmarkMatch = MdmarkMatchTarget & {
    /** 一致した文字列（照合した辞書の語） */
    text: string;
    /** 本文の Markdown の行（1 から） */
    line: number;
    /** その行の中の始まり（0 から数える UTF-16 の位置） */
    start: number;
    /** その行の中の終わり（含まない）。実体参照やエスケープで書いた文字は、本文に書いたままの範囲を指す */
    end: number;
};
/** 本文に出たやめた言い方 1 つと、代わりの用語 */
export type MdmarkAvoidedMatch = Omit<MdmarkMatch, "kind"> & {
    /** 代わりの用語の種類。`MdmarkMatchTarget` の `term`・`glossary` と同じ */
    kind: "term" | "glossary";
};
/** `collectMatches` の戻り値 */
export type MdmarkMatches = {
    /** 文書の `id` から、本文の一致を本文の頭からの順に並べたもの。本文のある索引の文書だけをキーに持つ */
    byDocument: Record<string, MdmarkMatch[]>;
    /** 文書の `id` から、本文に出たやめた言い方を本文の頭からの順に並べたもの。キーは `byDocument` と同じで、やめた言い方が無い文書と `glossary` がオフの文書は空の並び */
    avoided: Record<string, MdmarkAvoidedMatch[]>;
    /** 全ての文書の参照先を `kind` と `id` の組で重なりを除いたもの */
    targets: MdmarkMatchTarget[];
};
/** 本文の頭からの位置で表した、一致した語の範囲 */
type Found = {
    /** 辞書に記載した表記（本文の表記とは限らない） */
    word: string;
    /** 辞書を引く正規化した語 */
    key: string;
    offset: number;
    end: number;
    /** 図の部品の `{{語}}` の一致か（用語だけを引き、文書の別名は引かない） */
    termOnly?: boolean;
};
/** `<!-- html -->` の範囲の `html` のコードブロックの文字を、描くときと同じ範囲で照合し、本文の位置を返す */
export declare function embeddedHtmlMatches(options: {
    body: string;
    tokens: Token[];
    dictionary: Dictionary;
}): Found[];
/** 図の部品の範囲の定義と、埋め込んだ HTML の中の custom element の定義の `{{語}}` のうち、意味のある用語の位置を返す */
export declare function diagramTermMatches(options: {
    body: string;
    tokens: Token[];
    dictionary: Dictionary;
    html: boolean;
}): Found[];
/** 索引と文書の本文から、文書ごとの本文の一致と、重なりを除いた参照先を返す */
export declare function collectMatches(input: {
    /** 索引 */
    index: MdmarkIndex;
    /** 文書のパスから本文を引く表 */
    documents: Record<string, string>;
    /** 設定 */
    config?: MdmarkConfig;
}): MdmarkMatches;
export {};
