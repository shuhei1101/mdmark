import type { StateCore } from "markdown-it";
/** `steps` がオンなら、`steps` の範囲の最初の番号付きリスト（入れ子は除く）の `ol` に class `mdmark-steps` を付ける。無ければ警告を差し込む */
export declare function buildSteps(state: StateCore): void;
