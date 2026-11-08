import { escapeHtml } from "./escape.ts";

/** タブとステップを入れる折り畳みの HTML を返却する。`body` は `SLOT_MARKER` を指定できる */
export function renderCollapsible(options: {
  /** 見出しの文字 */
  title: string;
  /** 既定で開くか */
  open: boolean;
  /** 中身の HTML */
  body: string;
}): string {
  const { title, open, body } = options;
  return `<details class="mdmark-collapsible"${open ? " open" : ""}><summary>${escapeHtml(title)}</summary>${body}</details>`;
}
