import type { ColorName } from "./colors.ts";

/** 蛍光ペンの HTML を返却する。色を指定したときは `data-color` を付ける */
export const renderHighlight = (options: {
  /** 中身の HTML */
  html: string;
  /** 色の名前 */
  color?: ColorName | undefined;
}): string => {
  const color =
    options.color === undefined ? "" : ` data-color="${options.color}"`;
  return `<mark class="mdmark-highlight"${color}>${options.html}</mark>`;
};
