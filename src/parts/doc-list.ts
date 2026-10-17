import { escapeHtml } from "./escape.ts";

/** 一覧に並べる文書 1 つ */
export type DocListItem = {
  /** 文書のパス（設定ファイルのあるフォルダからの相対パス。区切りは `/`） */
  path: string;
  /** 文書の題 */
  title: string;
};

/** 文書の一覧の題（読み上げの名前） */
const DOC_LIST_LABEL = "文書の一覧";

/** 文書のパスのフォルダ（最後の `/` より前）。フォルダの無い文書は空文字 */
function folderOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

/** 文書へのリンク 1 行の HTML を返す。開いている文書には `aria-current` を付ける */
function renderItem(item: DocListItem, current: string | undefined): string {
  const path = escapeHtml(item.path);
  const currentAttribute = item.path === current ? ' aria-current="page"' : "";
  return `<li><a href="#/${path}" data-doc-path="${path}"${currentAttribute}>${escapeHtml(item.title)}</a></li>`;
}

/** まとめた文書を、フォルダの無い文書を先に、続けてフォルダごとに 1 段の見出しでまとめたリンクの一覧の HTML を返す */
export function renderDocList(options: {
  /** まとめた文書（並びの順に出す） */
  docs: DocListItem[];
  /** 開いている文書のパス。省くとどの行も開いている文書として示さない */
  current?: string;
}): string {
  const { docs, current } = options;
  // フォルダごとの文書。キーはフォルダ（フォルダの無い文書は空文字）で、最初に出た順に並ぶ
  const groups = new Map<string, DocListItem[]>();
  for (const doc of docs) {
    const folder = folderOf(doc.path);
    const items = groups.get(folder) ?? [];
    items.push(doc);
    groups.set(folder, items);
  }
  // フォルダの無い文書を先に置く
  const ordered = [...groups.entries()].sort(
    ([left], [right]) => Number(right === "") - Number(left === ""),
  );
  const body = ordered
    .map(([folder, items]) => {
      const heading =
        folder === ""
          ? ""
          : `<p class="mdmark-doc-list-folder">${escapeHtml(folder)}</p>`;
      const list = items.map((item) => renderItem(item, current)).join("");
      return `<div class="mdmark-doc-list-group">${heading}<ul>${list}</ul></div>`;
    })
    .join("");
  return `<nav class="mdmark-doc-list" aria-label="${DOC_LIST_LABEL}">${body}</nav>`;
}
