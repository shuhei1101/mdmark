import { escapeHtml } from "./escape.ts";

/** 関連文書の一覧の題 */
const BACKLINKS_TITLE = "関連文書";

/** 描いた文書の末尾に置く、その文書を参照している文書の一覧の HTML を返す。文書が無ければ空文字 */
export function renderBacklinks(props: {
  /** 題の要素の `id`。一覧の `aria-labelledby` が指す */
  id: string;
  /** 並べる文書（並びの順に出す） */
  docs: Array<{ title: string; href: string }>;
}): string {
  const { id, docs } = props;
  if (docs.length === 0) {
    return "";
  }
  const items = docs
    .map(
      (doc) =>
        `<li><a href="${escapeHtml(doc.href)}">${escapeHtml(doc.title)}</a></li>`,
    )
    .join("");
  const titleId = escapeHtml(id);
  return `<nav class="mdmark-backlinks" aria-labelledby="${titleId}"><p class="mdmark-backlinks-title" id="${titleId}">${BACKLINKS_TITLE}</p><ul>${items}</ul></nav>`;
}
