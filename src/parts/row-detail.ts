import { escapeHtml } from "./escape.ts";

/** 行の詳細の行と、行の先頭のセルの開閉のボタンの HTML を返す */
export function renderRowDetail(options: {
  /** 詳細の行の id（開閉のボタンの `aria-controls` が指す） */
  id: string;
  /** 詳細を持つ行の位置（見出し行を除いて 1 から） */
  row: number;
  /** 表の列の数 */
  columns: number;
  /** 行の先頭のセルの文字 */
  label: string;
  /** 詳細が開いているか（既定 `false`） */
  open?: boolean;
  /** 開閉のボタンを付けるか（既定 `true`） */
  toggle?: boolean;
  /** 詳細の中身の HTML（`SLOT_MARKER` を渡せる） */
  body: string;
}): { row: string; toggle: string } {
  const {
    id,
    row,
    columns,
    label,
    open = false,
    toggle = true,
    body,
  } = options;
  const hidden = toggle && !open ? " hidden" : "";
  return {
    row: `<tr class="mdmark-row-detail" data-row="${row}" id="${escapeHtml(id)}"${hidden}><td colspan="${columns}">${body}</td></tr>`,
    toggle: toggle
      ? `<button class="mdmark-row-toggle" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(id)}" aria-label="「${escapeHtml(label)}」の詳細"></button>`
      : "",
  };
}
