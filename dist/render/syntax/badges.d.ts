import type { StateCore } from "markdown-it";
import { type ColorName } from "../../parts/colors.ts";
/** 最初の `:` の前が色の名前なら色とラベルに分け、そうでなければ全てをラベルにする */
export declare function splitBadgeColor(text: string): {
    color?: ColorName;
    label: string;
};
/** `badge` がオンなら、頭が `badge:` で後ろに空白以外の文字を持つ行内のコードをバッジにし、`badge\:` のものは `\` を削除したコードにする */
export declare function buildBadges(state: StateCore): void;
