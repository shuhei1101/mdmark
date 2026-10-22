import { escapeHtml } from "./escape.ts";

/** タブを描く。`group` を渡すと `data-group` に写す。`selected` を渡すとタブの並びを付け、選んだもの以外の中身を `hidden` にする */
export function renderTabs(options: {
  /** タブの id の頭 */
  id: string;
  /** タブ名 */
  titles: string[];
  /** タブごとの中身の HTML（`SLOT_MARKER` を渡せる） */
  panels: string[];
  /** 選んだタブの位置（0 から） */
  selected?: number;
  /** タブの組の名前 */
  group?: string;
}): string {
  const { id, titles, panels, selected, group } = options;
  const mounted = selected !== undefined;
  const tablist = mounted
    ? `<div class="mdmark-tablist" role="tablist">${titles
        .map(
          (title, index) =>
            `<button class="mdmark-tab" type="button" role="tab" id="${escapeHtml(id)}-tab-${index}" aria-controls="${escapeHtml(id)}-panel-${index}" aria-selected="${index === selected}" tabindex="${index === selected ? 0 : -1}">${escapeHtml(title)}</button>`,
        )
        .join("")}</div>`
    : "";
  const body = panels
    .map((panel, index) => {
      const attributes = mounted
        ? ` role="tabpanel" id="${escapeHtml(id)}-panel-${index}" aria-labelledby="${escapeHtml(id)}-tab-${index}"${index === selected ? "" : " hidden"}`
        : "";
      return `<div class="mdmark-tab-panel"${attributes}><p class="mdmark-tab-title">${escapeHtml(titles[index] ?? "")}</p>${panel}</div>`;
    })
    .join("");
  const groupAttribute =
    group === undefined ? "" : ` data-group="${escapeHtml(group)}"`;
  return `<div class="mdmark-tabs"${groupAttribute}>${tablist}${body}</div>`;
}
