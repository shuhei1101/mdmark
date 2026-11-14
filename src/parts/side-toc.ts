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
  /** 比較元から変わったセクションか。`true` なら項目と右端の線に変更のマーカーを付ける */
  changed?: boolean;
};

/** 変更のマーカーの読み上げで、項目の名前に続ける文言 */
const CHANGED_LABEL = "（変更）";

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
      const text = escapeHtml(heading.text);
      // 変わったセクションは読み上げの文言をリンクの名前に持たせ、リンクの文字には足さない（目次を出すボタンへ写す文字を変えない）
      const changed =
        heading.changed === true
          ? ` data-changed aria-label="${text}${CHANGED_LABEL}"`
          : "";
      const marker =
        heading.changed === true
          ? '<span class="mdmark-side-toc-changed" aria-hidden="true"></span>'
          : "";
      const link = `<a href="#${escapeHtml(heading.id)}" data-heading-id="${escapeHtml(heading.id)}"${mark}${changed}>${text}${marker}</a>`;
      const nested = children.length
        ? `<ul>${renderItems(children, current)}</ul>`
        : "";
      return `<li>${link}${nested}</li>`;
    })
    .join("");
}

/** すべて展開・すべて折りたたむのボタンの HTML を返却する。文字を持たず、スクリーンリーダー向けの名前とツールチップで操作を伝える */
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

/** 右端の線を見出しの数だけ並べた HTML を返却する */
function renderBars(headings: SideTocHeading[], current: string | undefined) {
  return headings
    .map(
      ({ level, id, changed }) =>
        `<span class="mdmark-side-toc-bar" data-level="${level}"${id === current ? " data-current" : ""}${changed === true ? " data-changed" : ""}></span>`,
    )
    .join("");
}

/** パネルの頭（すべて展開・すべて折りたたむのボタンとピン止めのボタン）の HTML を返却する */
function renderHead(options: { sections: boolean; pinned: boolean }): string {
  const { sections, pinned } = options;
  const actions = sections
    ? `<div class="mdmark-side-toc-actions">${renderFoldAll()}</div>`
    : "";
  // ピン止めのボタン: 押す前と押した後のアイコンを両方置き、CSS が aria-pressed で片方を出す
  const pin = `<button class="mdmark-side-toc-pin" type="button" aria-pressed="${pinned}" aria-label="目次をピン止め" title="目次をピン止め"><span class="mdmark-side-toc-pin-off">${iconSvg("panel-right-dashed")}</span><span class="mdmark-side-toc-pin-on">${iconSvg("panel-right")}</span></button>`;
  return `<div class="mdmark-side-toc-head">${actions}${pin}</div>`;
}

/** 右側の目次の HTML を返却する。深いレベルの見出しは直前の浅いレベルの入れ子にし、右端の線を見出しの数だけ並べる */
export function renderSideToc(options: {
  /** 文書の頭からの h1・h2・h3 */
  headings: SideTocHeading[];
  /** 出し方（既定 `hover`） */
  mode?: SideTocMode;
  /** すべて展開・すべて折りたたむのボタンを配置するか（既定 `true`） */
  sections?: boolean;
  /** 目次を出しているか（既定 `false`） */
  open?: boolean;
  /** ピン止めしているか（既定 `false`） */
  pinned?: boolean;
  /** 今いるセクションの見出しの ID */
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
  const bars = renderBars(headings, current);
  const head = renderHead({ sections, pinned });
  const flags = `${open ? " data-open" : ""}${pinned ? " data-pinned" : ""}`;
  return `<aside class="mdmark-side-toc" data-mode="${mode}"${flags}><button class="mdmark-side-toc-toggle" type="button" aria-expanded="${open}" aria-controls="${escapedPanelId}" aria-label="目次を表示" title="目次を表示"><span class="mdmark-side-toc-current">${escapeHtml(currentText ?? "")}</span>${iconSvg("ellipsis")}</button><div class="mdmark-side-toc-rail" aria-hidden="true">${bars}</div><nav class="mdmark-side-toc-panel" id="${escapedPanelId}" aria-label="右側の目次">${head}<ul class="mdmark-side-toc-list">${renderItems(nestHeadings(headings), current)}</ul></nav></aside>`;
}
