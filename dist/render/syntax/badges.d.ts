import type { StateCore } from "markdown-it";
/** `badge` がオンなら、頭が `badge:` の行内のコードをバッジにし、`badge\:` のものは `\` を外したコードにする */
export declare function buildBadges(state: StateCore): void;
