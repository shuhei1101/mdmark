/** 表の列と行・バッジ・本文の文字に書ける色の名前 */
export const COLOR_NAMES = [
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "gray",
] as const;

/** 色の名前 */
export type ColorName = (typeof COLOR_NAMES)[number];

/** 文字が色の名前のどれかと一致するか（大文字と小文字を区別する） */
export function isColorName(value: string): value is ColorName {
  return (COLOR_NAMES as readonly string[]).includes(value);
}
