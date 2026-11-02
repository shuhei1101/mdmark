import type { ColorName } from "./colors.ts";

/** 本文の文字の色の HTML を返す */
export function renderTextColor(options: {
  /** 色の名前 */
  color: ColorName;
  /** 中身の HTML（`SLOT_MARKER` を渡せる） */
  text: string;
}): string {
  return `<span class="mdmark-color" data-color="${options.color}">${options.text}</span>`;
}
