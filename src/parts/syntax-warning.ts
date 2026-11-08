import type { WarningItem } from "../extensions.ts";
import { escapeHtml } from "./escape.ts";

/** 記載の警告のタイトル */
const WARNING_TITLE = "記載の警告";

/** `` ` `` で囲んだ箇所を `code` にし、それ以外をエスケープする */
function renderInline(text: string): string {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? `<code>${escapeHtml(part)}</code>` : escapeHtml(part),
    )
    .join("");
}

/** 記法のマーカーや拡張の引数に読み込めない指定がある箇所に配置する、記載の警告の HTML を返却する */
export function renderSyntaxWarning(options: {
  /** 読み込めない指定を記載したマーカーの文字。空なら出さない */
  mark?: string;
  /** 何が読み込めず、どう修正し、どう描いたかの本文 */
  message: string;
  /** 読み込めない指定が複数あるときの項目（既定 `[]`） */
  items?: WarningItem[];
  /** 枠の `id`。ほかの要素が `aria-describedby` で指すときに指定する */
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
