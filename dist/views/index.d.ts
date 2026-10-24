import type { MdmarkViewOptions } from "./spec.ts";
/** ビューの部品のモジュール（`dist/view.js`）が export する関数 */
export type ViewPartModule = {
    /** `mountView` が呼ぶ */
    drawView: (el: HTMLElement, opts: MdmarkViewOptions) => () => void;
    /** `mount` が描いた `div.mdmark-view` ごとに呼ぶ */
    attachView: (view: HTMLElement) => () => void;
};
/** `mountView` の指定から、`el` の中に class `mdmark` の要素を置いてビューを描き、表の操作と切り替えを付ける */
export declare function drawView(el: HTMLElement, opts: MdmarkViewOptions): () => void;
/** `render` が描いた `div.mdmark-view` の `data-view` と中の表から、切り替えとボードを置いて付ける。足した要素を取り除き、表を元に戻す関数を返す */
export declare function attachView(view: HTMLElement): () => void;
