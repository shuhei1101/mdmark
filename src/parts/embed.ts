import { escapeHtml } from "./escape.ts";

/** 読み込み中のブロックに出す文字 */
const LOADING_TEXT = "図を読み込んでいます";

/** 外部ライブラリのマーカーの場所に配置する、読み込み中のブロックの HTML を返却する */
export function renderEmbed(options: {
  /** マーカーの名前 */
  name: string;
  /** マーカーの引数の JSON のオブジェクト（既定 `{}`） */
  options?: Record<string, unknown>;
  /** マーカーの範囲から読み込んだ定義の番号。範囲で記載したマーカーだけが持つ */
  definition?: number;
}): string {
  const { name, options: markOptions = {}, definition } = options;
  const index =
    definition === undefined ? "" : ` data-mdmark-definition="${definition}"`;
  return `<div class="mdmark-embed" data-mdmark-slot="${escapeHtml(name)}" data-mdmark-args="${escapeHtml(JSON.stringify(markOptions))}"${index} role="status">${LOADING_TEXT}</div>`;
}
