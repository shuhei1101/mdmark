import { renderCollapsible } from "./collapsible.ts";
import { escapeHtml } from "./escape.ts";

/** タブ名の行内の HTML から、タグを除き文字参照を文字に戻した文字を取り出す */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/** タブ名の行内の HTML から、リンク（`a`）のタグを削除して中身だけを残す。ボタンの中に対話的な要素を配置しない */
function withoutLinks(html: string): string {
  return html.replace(/<\/?a\b[^>]*>/gi, "");
}

/** タブを描く。`group` を指定すると `data-group` に写す。`selected` を指定するとタブの並びを付け、選んだもの以外の中身を `hidden` にする。`collapse` が `closed`・`open` なら、折り畳みに入れる */
export function renderTabs(options: {
  /** タブの id の頭 */
  id: string;
  /** タブ名の行内の HTML（エスケープ済み） */
  titles: string[];
  /** タブごとの中身の HTML（`SLOT_MARKER` を指定できる） */
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
            `<button class="mdmark-tab" type="button" role="tab" id="${escapeHtml(id)}-tab-${index}" aria-controls="${escapeHtml(id)}-panel-${index}" aria-selected="${index === selected}" tabindex="${index === selected ? 0 : -1}">${withoutLinks(title)}</button>`,
        )
        .join("")}</div>`
    : "";
  const body = panels
    .map((panel, index) => {
      const attributes = mounted
        ? ` role="tabpanel" id="${escapeHtml(id)}-panel-${index}" aria-labelledby="${escapeHtml(id)}-tab-${index}"${index === selected ? "" : " hidden"}`
        : "";
      return `<div class="mdmark-tab-panel"${attributes}><p class="mdmark-tab-title">${titles[index] ?? ""}</p>${panel}</div>`;
    })
    .join("");
  const groupAttribute =
    group === undefined ? "" : ` data-group="${escapeHtml(group)}"`;
  const tabs = `<div class="mdmark-tabs"${groupAttribute}>${tablist}${body}</div>`;
  if (collapse === "none") {
    return tabs;
  }
  return renderCollapsible({
    title: title ?? `タブ（${titles.map(plainText).join("・")}）`,
    open: collapse === "open",
    body: tabs,
  });
}
