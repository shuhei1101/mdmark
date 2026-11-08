import type { StateCore } from "markdown-it";
/** `wide` がオンなら、`<!-- wide -->`（`closed` で `narrow`）〜 `<!-- /wide -->` を wide の範囲で囲む。`closed` 以外の引数は読み飛ばした引数にする。範囲の中の wide の印は取り除く */
export declare const buildWideRanges: (state: StateCore) => void;
