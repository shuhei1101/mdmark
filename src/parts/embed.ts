import { escapeHtml } from "./escape.ts";

/** 読み込み中の枠に出す文字 */
const LOADING_TEXT = "図を読み込んでいます";

/** 外部ライブラリの印の場所に置く、読み込み中の枠の HTML を返す */
export function renderEmbed(options: {
  /** 印の名前 */
  name: string;
  /** 印の引数（既定 `[]`） */
  args?: string[];
  /** 印の範囲から読んだ定義の番号。範囲で書いた印だけが持つ */
  definition?: number;
}): string {
  const { name, args = [], definition } = options;
  const index =
    definition === undefined ? "" : ` data-mdmark-definition="${definition}"`;
  return `<div class="mdmark-embed" data-mdmark-slot="${escapeHtml(name)}" data-mdmark-args="${escapeHtml(args.join(" "))}"${index} role="status">${LOADING_TEXT}</div>`;
}
