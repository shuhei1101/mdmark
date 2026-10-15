import { escapeHtml } from "./escape.ts";

/** バッジの HTML を返す */
export function renderBadge(options: {
  /** 札の文言 */
  label: string;
}): string {
  return `<span class="mdmark-badge">${escapeHtml(options.label)}</span>`;
}
