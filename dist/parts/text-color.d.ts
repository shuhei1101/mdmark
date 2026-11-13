import type { ColorName } from "./colors.ts";
/** 本文の文字の色の HTML を返却する */
export declare function renderTextColor(options: {
    /** 色の名前 */
    color: ColorName;
    /** 中身の HTML（`SLOT_MARKER` を指定できる） */
    text: string;
}): string;
