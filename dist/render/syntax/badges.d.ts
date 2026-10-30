import type { StateCore } from "markdown-it";
/** `badge` がオンなら、頭が `badge:` で後ろに空白以外の文字を持つ行内のコードをバッジにし、`badge\:` のものは `\` を外したコードにする */
export declare function buildBadges(state: StateCore): void;
