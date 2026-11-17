/** 表の列と行・バッジ・本文の文字に記載できる色の名前 */
export declare const COLOR_NAMES: readonly ["blue", "red", "green", "yellow", "orange", "purple", "gray"];
/** 色の名前 */
export type ColorName = (typeof COLOR_NAMES)[number];
/** 文字が色の名前のどれかと一致するか（大文字と小文字を区別する） */
export declare function isColorName(value: string): value is ColorName;
