import type { MdmarkParamDefinition } from "../diagram/definition.ts";
/** `root` の中の操作できる部品ごとに、スライダーの値でグラフを描き直す操作と、今の値を写す操作を付ける。`definitions` は `div.mdmark-param` の並びと同じ順。付けた操作を外す関数を返す */
export declare function attachParams(root: HTMLElement, definitions: MdmarkParamDefinition[]): () => void;
