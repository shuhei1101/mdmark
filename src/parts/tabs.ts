import { renderCollapsible } from "./collapsible.ts";
import { escapeHtml } from "./escape.ts";

/** タブを描く。`group` を渡すと `data-group` に写す。`selected` を渡すとタブの並びを付け、選んだもの以外の中身を `hidden` にする。`collapse` が `closed`・`open` なら、折り畳みに入れる */
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
  /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
  collapse?: "none" | "closed" | "open";
  /** 折り畳みの見出し（既定は `タブ（{タブ名を・で並べたもの}）`） */
  title?: string;
}): string {
  const {
    id,
    titles,
    panels,
    selected,
    group,
    collapse = "none",
    title,
  } = options;
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
  const tabs = `<div class="mdmark-tabs"${groupAttribute}>${tablist}${body}</div>`;
  if (collapse === "none") {
    return tabs;
  }
  return renderCollapsible({
    title: title ?? `タブ（${titles.join("・")}）`,
    open: collapse === "open",
    body: tabs,
  });
}
