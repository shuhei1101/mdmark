import type { StateCore, Token } from "markdown-it";
import { type Mark } from "../marks.ts";
import type { RenderEnv } from "../parser.ts";
/** 解析の環境を取り出す */
export declare function envOf(state: StateCore): RenderEnv;
/** 記法の機能がオンか */
export declare function featureOn(state: StateCore, name: string): boolean;
/** mdmark が出した要素として印を付けた HTML を、`html_block` のトークンにする。`source` を渡すと、その `map`（元の行）を写す */
export declare function ownBlock(state: StateCore, html: string, source?: Token): Token;
/** 印のトークンなら、その印を返す */
export declare function markOf(token: Token | undefined): Mark | undefined;
/** `openIndex` の印に対する閉じの印の位置を返す。無ければ `-1` */
export declare function findClose(tokens: Token[], openIndex: number, name: string): number;
/** `open` に対応する閉じのトークンの位置を、階層で探す */
export declare function findNestedClose(tokens: Token[], openIndex: number): number;
/** インライン要素の文字（タグを除いたもの）を集める */
export declare function textOf(token: Token): string;
