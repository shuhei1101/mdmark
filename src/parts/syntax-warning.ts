import type { WarningItem } from "../extensions.ts";
import { escapeHtml } from "./escape.ts";

/** 書き方の警告の題 */
const WARNING_TITLE = "書き方の警告";

/** `` ` `` で囲んだ箇所を `code` にし、それ以外をエスケープする */
function renderInline(text: string): string {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part),
    )
    .join("");
}

/** 記法の印や拡張の引数に読めない指定がある箇所に置く、書き方の警告の HTML を返す */
export function renderSyntaxWarning(options: {
  /** 読めない指定を書いた印の文字。空なら出さない */
  mark?: string;
  /** 何が読めず、どう直し、どう描いたかの本文 */
  message: string;
  /** 読めない指定が複数あるときの項目（既定 `[]`） */
  items?: WarningItem[];
  /** 枠の `id`。ほかの要素が `aria-describedby` で指すときに渡す */
  id?: string;
}): string {
  const { mark = "", message, items = [], id } = options;
  const markHtml = mark ? `<code>${escapeHtml(mark)}</code>` : "";
  const list = items.length
    ? `<ul>${items
        .map(
          (item) =>
            `<li>${item.label ? `<code>${escapeHtml(item.label)}</code>: ` : ""}${renderInline(item.message)}</li>`,
        )
        .join("")}</ul>`
    : "";
  const idAttribute = id === undefined ? "" : ` id="${escapeHtml(id)}"`;
  return `<div class="mdmark-syntax-warning" role="note"${idAttribute}><p class="mdmark-syntax-warning-title">${WARNING_TITLE}</p><p>${markHtml}${renderInline(message)}</p>${list}</div>`;
}
