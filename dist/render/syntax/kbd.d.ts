import type { StateCore } from "markdown-it";
/** `+` で区切り、`++` を `+` のキーとして読む。キーの前後の空白を外し、空のキーを捨てる */
export declare const splitKeys: (text: string) => string[];
/** `kbd` がオンなら、頭が `kbd:` で後ろに空白以外の文字を持つ行内のコードをキーにし、`kbd\:` のものは `\` を外したコードにする */
export declare const buildKbds: (state: StateCore) => void;
