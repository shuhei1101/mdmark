import { escapeHtml } from "./escape.ts";

/** タブとステップを入れる折り畳みの HTML を返却する。`body` は `SLOT_MARKER` を指定できる */
export function renderCollapsible(options: {
  /** 見出しの文字 */
  title: string;
  /** 既定で開くか */
  open: boolean;
  /** 中身の HTML */
  body: string;
  /** `mdmark-collapsible` の後ろに加える class */
  className?: string;
}): string {
  const { title, open, body, className } = options;
  const classes =
    className === undefined
      ? "mdmark-collapsible"
      : `mdmark-collapsible ${className}`;
  return `<details class="${classes}"${open ? " open" : ""}><summary>${escapeHtml(title)}</summary>${body}</details>`;
}
