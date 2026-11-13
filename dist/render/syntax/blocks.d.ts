import type { StateCore, Token } from "markdown-it";
import { type SyntaxWarning } from "./warnings.ts";
/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返却する */
export declare const blockStartOf: (tokens: Token[], index: number) => number;
/** 行内のトークンの位置ごとに記録した警告を、それを含むブロックの前に差し込む（後ろから差し込んで位置をずらさない） */
export declare const insertWarningsBeforeBlocks: (state: StateCore, warnings: Array<{
    index: number;
    warning: SyntaxWarning;
}>) => void;
/** 名前の範囲のマーカーを、入れ子を数えて開きと閉じの組にする。閉じの無い開きは `-1` に対応させる */
export declare const pairRanges: (tokens: Token[], name: string) => Map<number, number>;
/** `pairRanges` の組のうち、ほかの組の中に入っていない組だけを開きの順に返却する */
export declare const outermostRanges: (pairs: Map<number, number>, length: number) => Array<{
    open: number;
    close: number;
}>;
