import type { StateCore } from "markdown-it";
/** `text-color` がオンなら、角括弧の文字の直後の `{color=色}` を本文の文字の色の部品にし、知らない色は角括弧と属性だけを削除して段落の前に警告を配置する */
export declare function buildTextColors(state: StateCore): void;
