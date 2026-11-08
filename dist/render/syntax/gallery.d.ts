import type { StateCore } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { Mark } from "../marks.ts";
import { type SkippedArg } from "./warnings.ts";
/** `cols=` に書ける列の数の範囲と、省いたときの数 */
export declare const GALLERY_COLS: {
    readonly min: 1;
    readonly max: 6;
    readonly default: 2;
};
/** 番号を付けたギャラリーの画像に、範囲の中の順に付ける文字 */
export declare const SUBFIGURE_LETTERS = "abcdefghijklmnopqrstuvwxyz";
/** ギャラリーのマーカーの `cols=` を読み、読めない値を項目にし、`cols=` 以外の指定を読み飛ばした引数にする */
export declare function readGalleryOptions(mark: Mark): {
    cols: number;
    items: WarningItem[];
    skipped: SkippedArg[];
};
/** `gallery` がオンなら、ギャラリーのマーカーの範囲の画像を画像の図にして格子に並べ、画像以外のトークンを除く。番号を渡されていれば図表の番号で囲み、サブ図の番号を付ける */
export declare function buildGallery(state: StateCore): void;
