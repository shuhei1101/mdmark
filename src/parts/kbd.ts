import { escapeHtml } from "./escape.ts";

/** キーの HTML を返す。キーごとの `kbd` を `+` でつなぐ */
export const renderKbd = (options: {
  /** キーの並び */
  keys: string[];
}): string => {
  const keys = options.keys
    .map((key) => `<kbd class="mdmark-kbd">${escapeHtml(key)}</kbd>`)
    .join('<span class="mdmark-kbd-join">+</span>');
  return `<span class="mdmark-kbd-group">${keys}</span>`;
};
