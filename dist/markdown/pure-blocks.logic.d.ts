/** マーカーの名前と引数 */
export type PureMark = {
    /** マーカーの名前 */
    name: string;
    /** 引数の JSON のオブジェクト（引数が無い・読めないときは `{}`） */
    options: Record<string, unknown>;
    /** 範囲の最初の `json` のコードブロックを読み込んだ値 */
    definition?: unknown;
};
/** ブロックの種類 */
export type PureBlockKind = "text" | "fence" | "html" | "mark" | "figure" | "extension";
/** 文書を分けた 1 つの範囲 */
export type PureBlock = {
    /** ブロックの種類 */
    kind: PureBlockKind;
    /** 範囲の元の行 */
    lines: string[];
    /** 範囲の最初の行の元の行番号（1 から） */
    line: number;
    /** `mark`・`figure`・`extension` のマーカーの名前と引数 */
    mark?: PureMark;
    /** `mark` のマーカーの機能がオフか */
    off: boolean;
};
/** 文書を、マーカー・コードブロック・生の HTML・普通の行のブロックに分ける */
export declare function splitPureBlocks(options: {
    /** 文書 */
    markdown: string;
    /** 機能のオン・オフ（無い機能はオン） */
    features: Record<string, boolean>;
}): PureBlock[];
/** `text`・`fence`・`html`・`mark` のブロックを、純粋な Markdown の行にする（行内は呼ぶ側が変換する） */
export declare function convertPureBlock(options: {
    /** ブロック */
    block: PureBlock;
    /** 目次に使用する文書の見出し */
    headings: Array<{
        level: number;
        text: string;
    }>;
}): string[];
/** h2〜h3 の見出しを、見出しのアンカーへのリンクの入れ子の箇条書きにする */
export declare function tocList(headings: Array<{
    level: number;
    text: string;
}>): string[];
