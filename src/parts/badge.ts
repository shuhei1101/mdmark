import type { ColorName } from "./colors.ts";
import { escapeHtml } from "./escape.ts";

/** バッジの HTML を返す。色を渡したときは `data-color` を付ける */
export function renderBadge(options: {
  /** 札の文言 */
  label: string;
  /** 色の名前 */
  color?: ColorName;
}): string {
  const color =
    options.color === undefined ? "" : ` data-color="${options.color}"`;
  return `<span class="mdmark-badge"${color}>${escapeHtml(options.label)}</span>`;
}
