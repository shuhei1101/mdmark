import { renderEmbeddedHtml } from "./embedded-html.ts";
import { escapeHtml } from "./escape.ts";

/** プレビューの片側（前か後）の説明と、スクリプトとイベントの属性を落とした範囲の HTML */
export type DiffHtmlSide = { label: string; html: string };

/** 右端の「HTML」のラベル */
const LABEL = '<span class="mdmark-diff-html-label">HTML</span>';

/** プレビューの片側。範囲が無い側は、そのことを出す */
function renderSide(options: {
  name: "前" | "後";
  side: DiffHtmlSide | null | undefined;
}): string {
  const { name, side } = options;
  if (side === null || side === undefined) {
    return `<figure class="mdmark-diff-side"><figcaption><span class="mdmark-diff-side-name">${name}</span></figcaption><p class="mdmark-diff-absent">${name}のリビジョンには、この範囲がありません</p></figure>`;
  }
  return `<figure class="mdmark-diff-side"><figcaption><span class="mdmark-diff-side-name">${name}</span> ${escapeHtml(side.label)}</figcaption>${renderEmbeddedHtml({ html: side.html })}</figure>`;
}

/** 部品設計『埋め込んだHTMLの差分』: 差分の中の `<!-- html -->` の範囲を、右端に「HTML」のラベルを持つ見出しで囲んだ HTML を返す。変えた範囲は「ソース」「プレビュー」で、行の色分けと前と後の描いた結果を切り替える */
export function renderDiffHtml(options: {
  /** 前か後で範囲を変えたか。false なら見方の切り替えを付けず、ラベルだけの見出しにする */
  changed: boolean;
  /** 今の見方（既定 `source`） */
  view?: "source" | "rendered";
  /** プレビューの前と後の並べ方（既定 `side`） */
  sides?: "side" | "stack";
  /** 範囲のソースの行の HTML */
  lines: string;
  /** 前のリビジョンの範囲。範囲が無ければ `null` */
  before?: DiffHtmlSide | null;
  /** 後のリビジョンの範囲。範囲が無ければ `null` */
  after?: DiffHtmlSide | null;
}): string {
  const { changed, view = "source", sides = "side", lines } = options;
  if (!changed) {
    return `<div class="mdmark-diff-html"><div class="mdmark-diff-html-head">${LABEL}</div>${lines}</div>`;
  }
  const rendered = view === "rendered";
  const switcher = `<div class="mdmark-diff-view" role="group" aria-label="HTML の見方"><button type="button" data-view="source" aria-pressed="${!rendered}">ソース</button><button type="button" data-view="rendered" aria-pressed="${rendered}">プレビュー</button></div>`;
  return `<div class="mdmark-diff-html" data-changed><div class="mdmark-diff-html-head">${switcher}${LABEL}</div><div data-pane="source"${rendered ? " hidden" : ""}>${lines}</div><div class="mdmark-diff-sides" data-pane="rendered" data-sides="${sides}"${rendered ? "" : " hidden"}>${renderSide({ name: "前", side: options.before })}${renderSide({ name: "後", side: options.after })}</div></div>`;
}
