import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 部品設計『差分を開くボタン』: タイトルの後ろに配置する「変更表示」のボタンを、右に配置する帯で包んだ HTML を返却する */
export function renderDiffToggle(options: {
  /** 開閉する差分の場所の要素の `id` */
  controls: string;
  /** 差分を開いているか（既定 `false`） */
  expanded?: boolean;
}): string {
  const { controls, expanded = false } = options;
  return `<div class="mdmark-diff-bar"><button type="button" class="mdmark-diff-toggle" aria-expanded="${expanded}" aria-controls="${escapeHtml(controls)}">${iconSvg("file-diff")}変更表示</button></div>`;
}
