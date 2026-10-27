import type { SideTocMode } from "../config.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 右側の目次に並べる見出し 1 つ */
export type SideTocHeading = {
  /** 見出しのレベル */
  level: 1 | 2 | 3;
  /** 見出しの ID */
  id: string;
  /** 目次に出す見出しの文字 */
  text: string;
};

/** 入れ子にした目次の項目 */
type SideTocItem = {
  heading: SideTocHeading;
  children: SideTocItem[];
};

/** パネルの ID の既定。目次を出すボタンの `aria-controls` に写す */
const DEFAULT_PANEL_ID = "mdmark-side-toc-panel";

/** 見出しの並びを、深いレベルが直前の浅いレベルの入れ子になる木にする */
function nestHeadings(headings: SideTocHeading[]): SideTocItem[] {
  const roots: SideTocItem[] = [];
  // 今の見出しまでの祖先の項目（浅いレベルから順）
  const ancestors: SideTocItem[] = [];
  for (const heading of headings) {
    // 同じか浅いレベルの項目は祖先にならない
    while (
      (ancestors[ancestors.length - 1]?.heading.level ?? 0) >= heading.level
    ) {
      ancestors.pop();
    }
    const item: SideTocItem = { heading, children: [] };
    (ancestors[ancestors.length - 1]?.children ?? roots).push(item);
    ancestors.push(item);
  }
  return roots;
}

/** 項目の並びを `li` の並びにする */
function renderItems(
  items: SideTocItem[],
  current: string | undefined,
): string {
  return items
    .map(({ heading, children }) => {
      const mark = heading.id === current ? ' aria-current="location"' : "";
      const link = `<a href="#${escapeHtml(heading.id)}"${mark}>${escapeHtml(heading.text)}</a>`;
      const nested = children.length
        ? `<ul>${renderItems(children, current)}</ul>`
        : "";
      return `<li>${link}${nested}</li>`;
    })
    .join("");
}

/** すべて展開・すべて折りたたむのボタンの HTML を返す。文字を持たず、読み上げの名前とツールチップで操作を伝える */
function renderFoldAll(): string {
  return [
    ["open", "すべて展開", "chevrons-up-down"],
    ["close", "すべて折りたたむ", "chevrons-down-up"],
  ]
    .map(
      ([name, label, icon]) =>
        `<button class="mdmark-fold-all" type="button" data-fold-all="${name}" aria-label="${label}" title="${label}">${iconSvg(icon as "chevrons-up-down" | "chevrons-down-up")}</button>`,
    )
    .join("");
}

/** 右側の目次の HTML を返す。深いレベルの見出しは直前の浅いレベルの入れ子にし、右端の線を見出しの数だけ並べる */
export function renderSideToc(options: {
  /** 文書の頭からの h1・h2・h3 */
  headings: SideTocHeading[];
  /** 出し方（既定 `hover`） */
  mode?: SideTocMode;
  /** すべて展開・すべて折りたたむのボタンを置くか（既定 `true`） */
  sections?: boolean;
  /** 目次を出しているか（既定 `false`） */
  open?: boolean;
  /** ピン止めしているか（既定 `false`） */
  pinned?: boolean;
  /** 今いる節の見出しの ID */
  current?: string;
  /** パネルの ID */
  panelId?: string;
}): string {
  const {
    headings,
    mode = "hover",
    sections = true,
    open = false,
    pinned = false,
    current,
    panelId = DEFAULT_PANEL_ID,
  } = options;
  const escapedPanelId = escapeHtml(panelId);
  const currentText = headings.find((heading) => heading.id === current)?.text;
  const bars = headings
    .map(
      ({ level, id }) =>
        `<span class="mdmark-side-toc-bar" data-level="${level}"${id === current ? " data-current" : ""}></span>`,
    )
    .join("");
  const actions = sections
    ? `<div class="mdmark-side-toc-actions">${renderFoldAll()}</div>`
    : "";
  return `<aside class="mdmark-side-toc" data-mode="${mode}"${open ? " data-open" : ""}${pinned ? " data-pinned" : ""}><button class="mdmark-side-toc-toggle" type="button" aria-expanded="${open}" aria-controls="${escapedPanelId}" aria-label="目次を表示" title="目次を表示"><span class="mdmark-side-toc-current">${currentText === undefined ? "" : escapeHtml(currentText)}</span>${iconSvg("ellipsis")}</button><div class="mdmark-side-toc-rail" aria-hidden="true">${bars}</div><nav class="mdmark-side-toc-panel" id="${escapedPanelId}" aria-label="右側の目次"><div class="mdmark-side-toc-head"><p class="mdmark-side-toc-title">目次</p><button class="mdmark-side-toc-pin" type="button" aria-pressed="${pinned}" aria-label="目次をピン止め" title="目次をピン止め">${iconSvg("pin")}</button></div>${actions}<ul class="mdmark-side-toc-list">${renderItems(nestHeadings(headings), current)}</ul></nav></aside>`;
}
