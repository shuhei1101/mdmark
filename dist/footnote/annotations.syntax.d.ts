import type { MarkdownIt, StateCore, StateInline, Token } from "markdown-it";
import { type FootnoteBackRef } from "./footnote.part.ts";
/** 1 回の解析で読み込んだ注記の定義と参照 */
export type AnnotationState = {
    /** ID ごとの最初の定義のブロックのトークンと、定義の行（1 から） */
    definitions: Map<string, {
        tokens: Token[];
        line: number;
    }>;
    /** 同じ ID の 2 つ目以降の定義の ID と行 */
    duplicates: Array<{
        id: string;
        line: number;
    }>;
    /** 最初に参照した順の ID（位置 + 1 が番号） */
    order: string[];
    /** ID ごとの参照の戻り先（参照の順） */
    refs: Map<string, FootnoteBackRef[]>;
};
/** markdown-it のブロックのルールの引数 */
type BlockRuleArgs = Parameters<Parameters<MarkdownIt["block"]["ruler"]["push"]>[1]>;
/** 行頭の `※[ID]:` を注記の定義として読み込み、字下げ 4 で続く行までを本文として囲む */
export declare function readAnnotationDefinition(...args: BlockRuleArgs): boolean;
/** `[` の位置で、直前の文字が `※` のときだけ `[ID]` を注記の参照として読み込む（リンクになる `[ID]` は先に `link` が読み込む） */
export declare function readAnnotationReference(state: StateInline, silent: boolean): boolean;
/** 補足のマーカーの引数の JSON から、要素の ID ごとに参照する注記の ID の並びを返却する（解析できない補足は空） */
export declare function mapNoteAnnotations(rest: string | undefined): Array<[string, string[]]>;
/** 機能がオンなら、本文と map の補足の参照に最初に参照した順の番号を振り、参照と定義が合わないものに記載の警告を配置する。オフなら参照を記載した文字に戻す */
export declare function collectAnnotations(state: StateCore): void;
/** 番号のある注記が 1 つ以上あれば、文書の末尾に注記の一覧のトークンを追加する（脚注の一覧の後・関連文書の一覧の前） */
export declare function buildAnnotationList(state: StateCore): void;
/** 全てのコアルールを経由した定義の囲みを本文から取り除き、ID ごとの最初の定義の本文を記録する。機能がオフなら、定義の頭の文字を段落に戻して記載した位置に残す */
export declare function takeAnnotationDefinitions(state: StateCore): void;
/** 解析器に、注記の定義・参照のルールと、参照と一覧の描き方を登録する（コアルールは `createParser` が登録する） */
export declare function useAnnotations(parser: MarkdownIt): void;
export {};
