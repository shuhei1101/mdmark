import type { MdmarkViewOptions } from "./spec.ts";
/** ビューの部品のモジュール（`dist/view.js`）が export する関数 */
export type ViewPartModule = {
    /** `mountView` とビューのカスタム要素が呼ぶ */
    drawView: (el: HTMLElement, opts: MdmarkViewOptions, hooks?: ViewHooks) => () => void;
    /** `mount` が描いた `div.mdmark-view` ごとに呼ぶ */
    attachView: (view: HTMLElement) => () => void;
};
/** ビューのカスタム要素だけが `drawView` に指定する、項目を押せるようにする指定 */
export type ViewHooks = {
    /** 項目ごとのキー（`opts.items` と同じ並び） */
    keys?: string[] | undefined;
    /** ボードの項目か表形式の行を押したときに、その項目のキーで呼ぶ */
    onItemClick?: ((key: string) => void) | undefined;
};
/** `mountView` の指定から、`el` の中に class `mdmark` の要素を配置してビューを描き、表の操作と切り替えを付ける。`hooks.keys` があれば項目を押せるようにする */
export declare function drawView(el: HTMLElement, opts: MdmarkViewOptions, hooks?: ViewHooks): () => void;
/** `render` が描いた `div.mdmark-view` の `data-view` と中の表から、切り替えとボードを配置して付ける。追加した要素を取り除き、表を元に戻す関数を返却する */
export declare function attachView(view: HTMLElement): () => void;
