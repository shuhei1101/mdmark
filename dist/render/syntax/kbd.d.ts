import type { StateCore } from "markdown-it";
/** `+` で区切り、`++` を `+` のキーとして読み込む。キーの前後の空白を削除し、空のキーを捨てる */
export declare const splitKeys: (text: string) => string[];
/** `kbd` がオンなら、頭が `kbd:` で後ろに空白以外の文字を持つ行内のコードをキーにし、`kbd\:` のものは `\` を削除したコードにする */
export declare const buildKbds: (state: StateCore) => void;
