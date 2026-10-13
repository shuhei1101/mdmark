import { escapeHtml } from "./escape.ts";

/** 読み込み中の枠に出す文字 */
const LOADING_TEXT = "図を読み込んでいます";

/** 外部ライブラリの印の場所に置く、読み込み中の枠の HTML を返す */
export function renderEmbed(options: {
  /** 印の名前 */
  name: string;
  /** 印の引数（既定 `[]`） */
  args?: string[];
}): string {
  const { name, args = [] } = options;
  return `<div class="mdmark-embed" data-mdmark-slot="${escapeHtml(name)}" data-mdmark-args="${escapeHtml(args.join(" "))}" role="status">${LOADING_TEXT}</div>`;
}
