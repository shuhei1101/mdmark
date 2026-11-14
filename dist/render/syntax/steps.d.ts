import type { StateCore } from "markdown-it";
import type { Mark } from "../marks.ts";
import { type CollapseMode } from "./collapse.ts";
/** ステップのマーカーの設定の `collapse` を読み込む */
export declare function readStepsOptions(mark: Mark): {
    collapse: CollapseMode;
    title?: string | undefined;
};
/** `steps` がオンなら、`steps` の範囲の最初の番号付きリスト（入れ子は除く）の `ol` に class `mdmark-steps` を付ける。`closed`・`open` なら折り畳みに入れる。読み込めない指定と、番号付きリストが無いときは警告を差し込む */
export declare function buildSteps(state: StateCore): void;
