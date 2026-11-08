import type { ColorName } from "./colors.ts";
/** バッジの HTML を返す。色を渡したときは `data-color` を付ける */
export declare function renderBadge(options: {
    /** 札の文言 */
    label: string;
    /** 色の名前 */
    color?: ColorName;
}): string;
