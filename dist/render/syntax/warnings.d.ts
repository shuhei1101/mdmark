import type { StateCore } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { Mark } from "../marks.ts";
/** 書き方の警告に渡す値 */
export type SyntaxWarning = {
    /** 読めない指定を書いた印の文字 */
    mark?: string;
    /** 本文 */
    message: string;
    /** 項目 */
    items?: WarningItem[];
};
/** 書き方の警告の HTML に印を掛けて `html_block` にし、`index` の位置に差し込む */
export declare function pushWarning(state: StateCore, index: number, warning: SyntaxWarning): void;
/** 書き方の警告の `html_block` を作る（差し込む位置を呼ぶ側が決めるとき） */
export declare function warningBlock(state: StateCore, warning: SyntaxWarning): import("markdown-it").Token;
/** 範囲の印に閉じの印が無いときの警告 */
export declare function unclosedWarning(mark: Mark): SyntaxWarning;
