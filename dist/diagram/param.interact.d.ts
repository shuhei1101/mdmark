import type { MdmarkParamDefinition } from "./definition.ts";
/** 操作できる部品の操作を付けるときの指定 */
export type ParamOptions = {
    /** 操作できる部品のカスタム要素だけが指定する。スライダーの `input` ごとに、グラフを描き直した後で `knob.key` と今の値で呼ぶ */
    onChange?: ((key: string, value: number) => void) | undefined;
};
/** `root` の中の操作できる部品ごとに、スライダーの値でグラフを再描画する操作と、今の値を写す操作を付ける。`definitions` は `div.mdmark-param` の並びと同じ順。付けた操作を削除する関数を返却する */
export declare function attachParams(root: HTMLElement, definitions: MdmarkParamDefinition[], options?: ParamOptions): () => void;
