import type { StateCore } from "markdown-it";
import type { Mark } from "../marks.ts";
/** `columns` に記載できる列の数の範囲と、省いたときの数 */
export declare const GALLERY_COLS: {
    readonly min: 1;
    readonly max: 6;
    readonly default: 2;
};
/** 番号を付けたギャラリーの画像に、範囲の中の順に付ける文字 */
export declare const SUBFIGURE_LETTERS = "abcdefghijklmnopqrstuvwxyz";
/** ギャラリーのマーカーの設定の `columns`（マーカーの JSON Schema が列の数の範囲に照らしてある）を列の数にし、省けば既定にする */
export declare function readGalleryOptions(mark: Mark): {
    cols: number;
};
/** `gallery` がオンなら、ギャラリーのマーカーの範囲の画像を画像の図にして格子に並べ、画像以外のトークンを除く。番号を指定されていれば図表の番号で囲み、サブ図の番号を付ける */
export declare function buildGallery(state: StateCore): void;
