import { CodeXml } from "lucide";
import type { TablePinMode } from "../config.ts";
import {
  bottomHeadCells,
  compareCells,
  computeTotal,
  type FilterKind,
  type FilterValue,
  findUnreadableTotals,
  matchesFilter,
  mergeSpans,
  TOTAL_CALCS,
  TOTAL_LABELS,
  type TotalCalc,
} from "../table-logic.ts";
import { planTreeRows, splitKeyPath } from "../tree-logic.ts";
import type { ColorName } from "./colors.ts";
import { escapeHtml } from "./escape.ts";
import { iconNodeBody, iconSvgOf } from "./icon-node.ts";
import { iconSvg } from "./icons.ts";
import { renderTabs } from "./tabs.ts";

/** 表の種類 */
export type TableKind = "default" | "data" | "plain";

/** 表の機能 */
export type TableFeature =
  | "sort"
  | "pin"
  | "filter"
  | "resize"
  | "count"
  | "columns"
  | "reorder"
  | "total"
  | "copy"
  | "rowlink";

/** 集計する列 */
export type TableTotal = {
  /** 列の位置 */
  column: number;
  /** 計算 */
  calc: TotalCalc;
};

/** コピーのボタンの状態 */
export type CopyState = "idle" | "copied" | "failed";

/** コピーの形式 */
export type CopyFormat = "markdown" | "tsv";

/** 絞り込みを付ける列 */
export type TableFilter = {
  /** 列の位置 */
  column: number;
  /** 絞り込みの種類 */
  kind: FilterKind;
};

/** 表の部品の引数 */
export type TableOptions = {
  /** 表の種類（既定 `default`） */
  kind?: TableKind;
  /** 付ける機能 */
  features: string[];
  /** 列の見出しの HTML。`body` を指定するときは省く */
  columns?: string[];
  /** 行ごとのセルの HTML。`body` を指定するときは省く */
  rows?: string[][];
  /** 絞り込みを付ける列 */
  filters?: TableFilter[];
  /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
  collapse?: "none" | "closed" | "open";
  /** 折り畳みの見出し（既定は `表（{本文の行の数} 行）`） */
  title?: string | undefined;
  /** `rows` を省いたときの本文の行の数。折り畳みの見出しに使用する */
  rowCount?: number;
  /** 並べ替えた列と向き */
  sort?: { column: number; direction: "ascending" | "descending" };
  /** 表が幅からはみ出しているか。`true` のときだけピン止めのボタンを出す */
  overflow?: boolean;
  /** 留める列の位置（小さい順。省くと `rowHeader` の全ての列） */
  pinned?: number[];
  /** `pinned` のうち、表の見えている幅に収まらず留めない列の位置 */
  unpinned?: number[];
  /** ピン止めの動き（既定 `each`）。ボタンの名前と押した状態にする列が変わる */
  pinMode?: TablePinMode;
  /** 開いた絞り込みのドロワーの列の位置 */
  openFilter?: number;
  /** 適用している絞り込み */
  filterValues?: FilterValue[];
  /** 既定で隠す列の位置（`data-hide`。先頭の列は含まない） */
  hide?: number[];
  /** 今隠している列の位置（既定は `hide`） */
  hiddenColumns?: number[];
  /** 列の表示のメニューを開いているか */
  openColumns?: boolean;
  /** 集計する列（`data-total`） */
  totals?: TableTotal[];
  /** コピーのボタンの状態（既定 `idle`） */
  copyState?: CopyState;
  /** 本文の行ごとの `id`。行に `id` と行へのリンクを付ける */
  rowIds?: string[];
  /** URL の `#ID` が指す行の位置 */
  targetRow?: number;
  /** 出している集計の行の計算（既定は `totals` の全ての計算） */
  shownTotals?: TotalCalc[];
  /** 集計のメニューを開いているか */
  openTotals?: boolean;
  /** コピーの形式のメニューを開いているか */
  openCopy?: boolean;
  /** クリップボードに書き込めなかったときに手でコピーさせるパネルの中身 */
  copyFallback?: { format: CopyFormat; text: string };
  /** `targetRow` の行の URL をコピーした結果 */
  rowLinkNotice?: "copied" | "failed";
  /** 長文の列の位置（`data-long`） */
  long?: number[] | undefined;
  /** 並べ替えを付けない列の位置（`data-no-sort`） */
  noSort?: number[] | undefined;
  /** `width.min`・`width.max` を記載した列（`data-width`。em の数） */
  widthRanges?:
    | Array<{ column: number; min?: number; max?: number }>
    | undefined;
  /** `mount` が自動で決めた列の幅（見出しのセルの外側の幅の px） */
  autoWidths?: Array<{ column: number; width: number }>;
  /** 表の代わりに配置する HTML（`SLOT_MARKER` を指定できる） */
  body?: string;
  /** ドロワーの `id` の頭（既定 `mdmark-table`）。ビューの中の表のように、文書の中に表が 2 つ以上あるときに重ならない値を指定する */
  id?: string;
  /** 強調する列の位置と色 */
  highlight?: Array<{ column: number; color: ColorName }>;
  /** 本文の行ごとの色（色を付けない行は `null`） */
  rowColors?: Array<ColorName | null>;
  /** `columns.{列名}.pinned` の `true` の列の位置（小さい順。`data-pin` に半角の空白で区切って写す） */
  pin?: number[] | undefined;
  /** `columns.{列名}.pinned` の `false` の列の位置（既定で留める列から除く。`data-unpin` に半角の空白で区切って写す） */
  unpin?: number[] | undefined;
  /** 幅を指定した列と、その列の外側の幅（px） */
  widths?: Array<{ column: number; width: number }>;
  /** つまみをドラッグしている列の位置 */
  resizing?: number;
  /** 折り返さずに広く取る列の位置 */
  wide?: number[];
  /** 真偽値を ✓ と空欄で出す列の位置（`data-check`） */
  check?: number[];
  /** 階層にするキーの列の位置（`data-tree`） */
  tree?: number | undefined;
  /** 今の列の順（元の列の位置の並び。ストーリーで使用する） */
  order?: number[];
  /** ドラッグしている列と、落とす先の列と向き（ストーリーで使用する） */
  dragging?: { column: number; target: number; side: "before" | "after" };
  /** 階層の表の型の列の位置 */
  treeType?: number;
  /** 階層の表の必須の列の位置 */
  treeRequired?: number;
  /** 階層の表の既定の列の位置 */
  treeDefault?: number;
  /** 畳んだ行のパス（ストーリーで使用する） */
  collapsedPaths?: string[];
  /** キーの列の絞り込みの単語（ストーリーで使用する） */
  treeFilter?: string;
  /** 選んだ行のパス（ストーリーで使用する） */
  selectedPath?: string;
  /** 表の下に配置する YAML の見本（ストーリーで使用する） */
  example?: {
    heading: string;
    tabs: Array<{
      name: string;
      lines?: Array<{ text: string; path?: string }>;
    }>;
    active?: number;
    hidden?: boolean;
  };
  /** 見出しの行ごとのセル。指定すると `columns` の代わりに見出しの行をこの行の並びで描く */
  headRows?: TableHeadCell[][];
  /** 本文の各行で `<th scope="row">` にする先頭の列の数（既定 0） */
  rowHeader?: number;
  /** 表示している行の隣り合う同じ値を結合する列の位置（小さい順） */
  mergeColumns?: number[];
  /** 言語 `csv` のコードブロックから作った表の、記載したとおりの CSV */
  rawCsv?: string | undefined;
  /** 元の CSV を出しているか（既定 `false`） */
  rawShown?: boolean;
};

/** CSV の表の RAW のボタンを右端に配置する帯の HTML を返却する */
export const renderRawBar = (pressed: boolean): string =>
  `<div class="mdmark-table-bar mdmark-raw-bar"><div class="mdmark-table-tools">${renderRawToggle(pressed)}</div></div>`;

/** CSV の表の RAW のボタンの HTML を返却する */
export const renderRawToggle = (pressed: boolean): string =>
  `<button class="mdmark-raw-toggle" type="button" aria-label="元の CSV を表示" aria-pressed="${pressed}">${iconSvgOf(iconNodeBody(CodeXml))}</button>`;

/** 多段の見出しのセル */
export type TableHeadCell = {
  /** セルの HTML */
  html: string;
  /** セルの左端の列の位置 */
  column: number;
  /** 覆う行の数（既定 1） */
  rowspan?: number;
  /** 覆う列の数（既定 1） */
  colspan?: number;
};

/** 見出しのボタンとドロワーを作る引数 */
export type TableToolsOptions = {
  /** ドロワーの id の頭 */
  id: string;
  /** 列の位置 */
  column: number;
  /** 列名 */
  label: string;
  /** 機能 */
  features: string[];
  /** 並べ替えのボタンにするか（既定 `true`。`false` なら `features` に `sort` があっても列名を文字のままにする） */
  sortable?: boolean;
  /** 絞り込み（`select` は候補の値） */
  filter?: { kind: FilterKind; values: string[] } | undefined;
  /** 絞り込みを適用しているか */
  active?: boolean;
  /** ドロワーを開いているか */
  open?: boolean;
  /** 適用している絞り込み */
  value?: FilterValue | undefined;
  /** ピン止めのボタンを出すか（既定 `false`。`mount` が幅を測って決める） */
  pinVisible?: boolean;
  /** ピン止めのボタンを押した状態にするか */
  pinPressed?: boolean;
  /** ピン止めのボタンを、表の見えている幅に収まらず留まっていない状態にするか */
  pinUnpinned?: boolean;
  /** ピン止めの動き（既定 `each`）。ボタンの名前が変わる */
  pinMode?: TablePinMode;
};

/** タグを除き、文字参照を文字に戻して、画面に出る文字を取り出す */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/** 絞り込みのドロワーの id */
function drawerId(id: string, column: number): string {
  return `${id}-drawer-${column}`;
}

/** 種類ごとの入力欄を作る */
function renderFilterFields(options: TableToolsOptions): string {
  const { filter, value } = options;
  if (filter?.kind === "text") {
    return `<label class="mdmark-filter-field">含む文字<input type="text" value="${escapeHtml(value?.text ?? "")}"></label>`;
  }
  if (filter?.kind === "date") {
    return `<div class="mdmark-filter-range"><label class="mdmark-filter-field">開始日<input type="date" value="${escapeHtml(value?.from ?? "")}"></label><label class="mdmark-filter-field">終了日<input type="date" value="${escapeHtml(value?.to ?? "")}"></label></div>`;
  }
  const checked = new Set(value?.values ?? []);
  const items = (filter?.values ?? [])
    .map(
      (candidate) =>
        `<li><label><input type="checkbox" value="${escapeHtml(candidate)}"${checked.has(candidate) ? " checked" : ""}>${escapeHtml(candidate)}</label></li>`,
    )
    .join("");
  return `<label class="mdmark-filter-field">候補を検索<input class="mdmark-filter-search" type="search"></label><ul class="mdmark-filter-options">${items}</ul><p class="mdmark-filter-none" hidden>一致する候補がありません</p>`;
}

/** 表の見えている幅に収まらず留まっていない列のピン止めのボタンの名前に付ける文言 */
export const PIN_UNPINNED_SUFFIX = "（表の幅に収まらないため留まっていません）";

/** ピン止めのボタンの名前（`aria-label`）を返却する。留まっていない列は `PIN_UNPINNED_SUFFIX` を付ける */
export function pinButtonLabel(options: {
  /** 列名 */
  label: string;
  /** ピン止めの動き */
  mode: TablePinMode;
  /** 表の見えている幅に収まらず留まっていないか */
  unpinned: boolean;
}): string {
  const { label, mode, unpinned } = options;
  const base = `「${label}」${mode === "each" ? "の列をピン止め" : "の列までピン止め"}`;
  return unpinned ? `${base}${PIN_UNPINNED_SUFFIX}` : base;
}

/** 列 1 つの見出しの中身（並べ替え・絞り込み・ピン止めのボタンと、`resize` のときは列の幅のつまみ）と、その列の絞り込みのドロワーの HTML を返却する */
export function renderTableTools(options: TableToolsOptions): {
  header: string;
  drawer: string;
} {
  const {
    id,
    column,
    label,
    features,
    sortable = true,
    filter,
    active = false,
    pinVisible = false,
    pinPressed = false,
    pinUnpinned = false,
    pinMode = "each",
  } = options;
  const open = options.open ?? false;
  const escapedLabel = escapeHtml(label);
  const controls = drawerId(id, column);
  const filterable = features.includes("filter") && filter !== undefined;
  const title =
    features.includes("sort") && sortable
      ? `<button class="mdmark-sort" type="button">${escapedLabel}</button>`
      : `<span class="mdmark-th-label">${escapedLabel}</span>`;
  const filterButton = filterable
    ? `<button class="mdmark-filter${active ? " is-active" : ""}" type="button" aria-label="「${escapedLabel}」で絞り込む" aria-expanded="${open}" aria-controls="${escapeHtml(controls)}"><span class="mdmark-visually-hidden">${active ? "（絞り込み中）" : ""}</span></button>`
    : "";
  const pinLabel = pinButtonLabel({
    label: escapedLabel,
    mode: pinMode,
    unpinned: pinUnpinned,
  });
  const pinButton = features.includes("pin")
    ? `<button class="mdmark-pin${pinUnpinned ? " is-unpinned" : ""}" type="button" aria-label="${pinLabel}"${pinUnpinned ? ` title="${pinLabel}"` : ""} aria-pressed="${pinPressed}"${pinVisible ? "" : " hidden"}></button>`
    : "";
  const tools =
    filterButton || pinButton
      ? `<span class="mdmark-th-tools">${filterButton}${pinButton}</span>`
      : "";
  const drawer = filterable
    ? `<div class="mdmark-filter-drawer" id="${escapeHtml(controls)}" role="dialog" aria-label="「${escapedLabel}」で絞り込む" data-filter-kind="${filter.kind}" data-column="${column}"${open ? "" : " hidden"}><p class="mdmark-filter-title">「${escapedLabel}」で絞り込む</p>${renderFilterFields(options)}<button class="mdmark-filter-clear" type="button">絞り込みを解除</button></div>`
    : "";
  const resizeHandle = features.includes("resize")
    ? `<span class="mdmark-col-resize" role="separator" aria-orientation="vertical" tabindex="0" aria-label="「${escapedLabel}」の列の幅"></span>`
    : "";
  return {
    header: `<span class="mdmark-th">${title}${tools}</span>${resizeHandle}`,
    drawer,
  };
}

/** 絞り込みを適用しているか（空の絞り込みは適用していない） */
function isActive(value: FilterValue | undefined): boolean {
  return Boolean(
    value?.values?.length || value?.text || value?.from || value?.to,
  );
}

/** 行を並べ替えた順の位置を返却する */
function sortedIndexes(options: TableOptions): number[] {
  const rows = options.rows ?? [];
  const indexes = rows.map((_, index) => index);
  const sort = options.sort;
  if (!sort) {
    return indexes;
  }
  const sign = sort.direction === "ascending" ? 1 : -1;
  return indexes.sort(
    (a, b) =>
      sign *
      compareCells(
        plainText(rows[a]?.[sort.column] ?? ""),
        plainText(rows[b]?.[sort.column] ?? ""),
      ),
  );
}

/** コピーのボタンの状態ごとの文言とアイコン */
export const COPY_STATES = {
  idle: { label: "表をコピー", icon: "copy" },
  copied: { label: "コピーしました", icon: "check" },
  failed: { label: "コピーできませんでした", icon: "circle-alert" },
} as const;

/** コピーのボタンの中身（アイコンとスクリーンリーダー向けの名前）の HTML */
export function renderCopyButtonContent(state: CopyState): string {
  const { icon, label } = COPY_STATES[state];
  return `${iconSvg(icon)}<span class="mdmark-visually-hidden mdmark-copy-label">${label}</span>`;
}

/** コピーの形式の名前と用途 */
export const COPY_FORMATS = {
  markdown: {
    name: "Markdown の表",
    note: "文書に貼るとそのまま表になる",
  },
  tsv: { name: "TSV", note: "表計算ソフトに貼るとセルに分かれる" },
} as const;

/** テーブル設定のパネルの id */
function menuId(id: string): string {
  return `${id}-settings`;
}

/** 集計のメニューの id */
function totalsMenuId(id: string): string {
  return `${id}-totals`;
}

/** コピーの形式のメニューの id */
function copyMenuId(id: string): string {
  return `${id}-copy`;
}

/** 表の上の帯（件数・テーブル設定・集計・コピーのボタン）と、テーブル設定のパネル・集計・コピーの形式のメニューの HTML を返却する。付けた機能が無ければ空 */
export function renderTableBar(options: {
  /** メニューの id の頭 */
  id: string;
  /** 付ける機能 */
  features: string[];
  /** 列名 */
  labels: string[];
  /** 表示している行の数 */
  shown: number;
  /** 全ての行の数 */
  total: number;
  /** 隠している列の位置 */
  hiddenColumns: number[];
  /** テーブル設定のパネルを開いているか（既定 `false`） */
  openColumns?: boolean;
  /** 今の列の順（既定は元の列の順） */
  order?: number[];
  /** 列ごとの結合した見出しの範囲（既定は全て範囲の外） */
  groups?: Array<string | undefined>;
  /** 結合した見出しの範囲ごとの見出しの文字 */
  groupLabels?: Record<string, string>;
  /** 留めている列の数（既定 0） */
  pinned?: number;
  /** ドラッグしている列と、落とす先の列と向き */
  dragging?: { column: number; target: number; side: "before" | "after" };
  /** コピーのボタンの状態（既定 `idle`） */
  copyState?: CopyState;
  /** 集計する計算 */
  totals?: TotalCalc[];
  /** 出している集計の行の計算（既定は `totals` の全て） */
  shownTotals?: TotalCalc[];
  /** 集計のメニューを開いているか（既定 `false`） */
  openTotals?: boolean;
  /** コピーの形式のメニューを開いているか（既定 `false`） */
  openCopy?: boolean;
}): { bar: string; menus: string } {
  const { id, features, labels, shown, total, hiddenColumns } = options;
  const copyState = options.copyState ?? "idle";
  const open = options.openColumns ?? false;
  const hidden = new Set(hiddenColumns);
  const calcs = TOTAL_CALCS.filter((calc) => options.totals?.includes(calc));
  const shownCalcs = new Set(options.shownTotals ?? calcs);
  const hiddenCalcs = calcs.filter((calc) => !shownCalcs.has(calc));
  const counting = features.includes("count");
  const columns = features.includes("columns");
  const settings = columns || features.includes("reorder");
  const totaling = features.includes("total") && calcs.length > 0;
  const copying = features.includes("copy");
  const count = counting
    ? `<p class="mdmark-table-count" aria-live="polite"><span aria-hidden="true">${shown} / ${total} 件</span><span class="mdmark-visually-hidden">${total} 件中 ${shown} 件を表示</span></p>`
    : "";
  const settingsToggle = settings
    ? renderSettingsToggle({ id, hidden: hidden.size, open })
    : "";
  const totalsToggle = totaling
    ? `<button class="mdmark-table-tool mdmark-totals-toggle${hiddenCalcs.length > 0 ? " is-active" : ""}" type="button" aria-expanded="${options.openTotals ?? false}" aria-controls="${escapeHtml(totalsMenuId(id))}">${iconSvg("sigma")}集計<span class="mdmark-visually-hidden">${hiddenCalcs.length > 0 ? `（${hiddenCalcs.length} 件を非表示にしています）` : ""}</span></button>`
    : "";
  const copy = copying
    ? `<button class="mdmark-table-tool mdmark-copy is-icon-only" type="button" title="${COPY_STATES[copyState].label}" data-state="${copyState}" aria-expanded="${options.openCopy ?? false}" aria-controls="${escapeHtml(copyMenuId(id))}">${renderCopyButtonContent(copyState)}</button>`
    : "";
  const tools =
    settingsToggle || totalsToggle || copy
      ? `<div class="mdmark-table-tools">${settingsToggle}${totalsToggle}${copy}</div>`
      : "";
  const status =
    totaling || copying
      ? `<span class="mdmark-visually-hidden mdmark-table-status" role="status">${copying && copyState !== "idle" ? COPY_STATES[copyState].label : ""}</span>`
      : "";
  const settingsPanel = settings
    ? renderTableSettings({
        id,
        columns: labels,
        order: options.order ?? labels.map((_, index) => index),
        hidden: [...hidden],
        features: features.filter(
          (feature): feature is TableFeature =>
            feature === "columns" || feature === "reorder",
        ),
        groups: options.groups ?? labels.map(() => undefined),
        groupLabels: options.groupLabels,
        pinned: options.pinned ?? 0,
        dragging: options.dragging,
      }).replace(/^<div /, `<div${open ? "" : " hidden"} `)
    : "";
  const totalItems = calcs
    .map(
      (calc) =>
        `<li><label><input type="checkbox" value="${calc}"${shownCalcs.has(calc) ? " checked" : ""}>${TOTAL_LABELS[calc]}</label></li>`,
    )
    .join("");
  const totalsMenu = totaling
    ? `<div class="mdmark-totals-menu mdmark-table-menu" id="${escapeHtml(totalsMenuId(id))}" role="dialog" aria-label="表示する集計"${options.openTotals ? "" : " hidden"}><p class="mdmark-totals-title">表示する集計</p><ul class="mdmark-totals-options">${totalItems}</ul></div>`
    : "";
  const formats = (["markdown", "tsv"] as const)
    .map(
      (format) =>
        `<button class="mdmark-copy-format" type="button" data-format="${format}"><span class="mdmark-copy-format-name">${COPY_FORMATS[format].name}</span><span class="mdmark-copy-format-note">${COPY_FORMATS[format].note}</span></button>`,
    )
    .join("");
  const copyMenu = copying
    ? `<div class="mdmark-copy-menu mdmark-table-menu" id="${escapeHtml(copyMenuId(id))}" role="dialog" aria-label="コピーの形式"${options.openCopy ? "" : " hidden"}>${formats}</div>`
    : "";
  return {
    bar:
      count || tools
        ? `<div class="mdmark-table-bar">${count}${tools}${status}</div>`
        : "",
    menus: `${settingsPanel}${totalsMenu}${copyMenu}`,
  };
}

/** テーブル設定のボタンのスクリーンリーダー向けの名前 */
function settingsLabel(hidden: number): string {
  return hidden > 0 ? `テーブル設定（${hidden} 列を非表示）` : "テーブル設定";
}

/** 表の帯に配置する、テーブル設定のアイコンだけのボタンの HTML を返却する */
export function renderSettingsToggle(options: {
  /** パネルの id の頭 */
  id: string;
  /** 隠している列の数 */
  hidden: number;
  /** パネルを開いているか */
  open: boolean;
}): string {
  const { id, hidden, open } = options;
  return `<button class="mdmark-table-tool mdmark-table-settings-toggle is-icon-only${hidden > 0 ? " is-active" : ""}" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(menuId(id))}" aria-label="${settingsLabel(hidden)}" title="テーブル設定">${iconSvg("settings-2")}<span class="mdmark-table-tool-badge" aria-hidden="true"${hidden > 0 ? "" : " hidden"}>${hidden}</span></button>`;
}

/** テーブル設定のボタンの隠した列の数とスクリーンリーダー向けの名前を書き換える */
export function updateSettingsToggle(
  toggle: HTMLElement,
  hidden: number,
): void {
  toggle.setAttribute("aria-label", settingsLabel(hidden));
  toggle.classList.toggle("is-active", hidden > 0);
  const badge = toggle.querySelector<HTMLElement>(".mdmark-table-tool-badge");
  if (badge) {
    badge.textContent = String(hidden);
    badge.hidden = hidden === 0;
  }
}

/** 一覧の項目が属するまとまりの鍵（ピン止めの列は `pinned`、範囲の外は空） */
function placeKey(options: {
  column: number;
  groups: Array<string | undefined>;
  pinned: number;
}): string {
  const { column, groups, pinned } = options;
  return column < pinned ? "pinned" : (groups[column] ?? "");
}

/** テーブル設定のパネル（タイトル・列名の一覧・案内）の HTML を返却する。`hidden` は付けない */
export function renderTableSettings(options: {
  /** パネルの id の頭 */
  id: string;
  /** 元の列の順の列名 */
  columns: string[];
  /** 今の列の順（元の列の位置の並び） */
  order: number[];
  /** 隠している列の位置 */
  hidden: number[];
  /** `columns`・`reorder` のうち付けた機能 */
  features: TableFeature[];
  /** 列ごとの結合した見出しの範囲 */
  groups: Array<string | undefined>;
  /** 結合した見出しの範囲ごとの見出しの文字 */
  groupLabels?: Record<string, string>;
  /** 留めている列の数 */
  pinned: number;
  /** ドラッグしている列と、落とす先の列と向き */
  dragging?: { column: number; target: number; side: "before" | "after" };
}): string {
  const { id, columns, order, groups, pinned, dragging } = options;
  const hidden = new Set(options.hidden);
  const showing = options.features.includes("columns");
  const reordering = options.features.includes("reorder");
  const noteId = `${id}-settings-note`;
  const keys = order.map((column) => placeKey({ column, groups, pinned }));
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const split = counts.size > 1;
  const items: string[] = [];
  let previous: string | undefined;
  for (const [index, column] of order.entries()) {
    const key = keys[index] ?? "";
    if (split && key !== previous) {
      const heading =
        key === "pinned"
          ? "ピン止めの列"
          : key === ""
            ? "範囲の外の列"
            : (options.groupLabels?.[key] ?? "結合した見出しの範囲");
      items.push(
        `<li class="mdmark-table-settings-group" aria-hidden="true">${escapeHtml(heading)}</li>`,
      );
    }
    previous = key;
    const name = columns[column] ?? "";
    const movable = (counts.get(key) ?? 0) > 1;
    const draggingClass =
      dragging?.column === column
        ? " is-dragging"
        : dragging?.target === column
          ? ` is-drop-${dragging.side}`
          : "";
    const grip = reordering
      ? `<button class="mdmark-table-settings-grip" type="button" aria-label="「${escapeHtml(name)}」の列を並べ替える" aria-describedby="${escapeHtml(noteId)}"${movable ? ' draggable="true"' : " disabled"}>${iconSvg("grip-vertical")}</button>`
      : "";
    const isHidden = hidden.has(column);
    const eye = showing
      ? `<button class="mdmark-table-settings-eye" type="button" aria-pressed="${isHidden}" aria-label="「${escapeHtml(name)}」を${isHidden ? "表示" : "隠す"}"${column === 0 ? " disabled" : ""}>${iconSvg(isHidden ? "eye-off" : "eye")}</button>`
      : "";
    items.push(
      `<li class="mdmark-table-settings-item${draggingClass}" data-column="${column}" data-name="${escapeHtml(name)}" data-place="${escapeHtml(key)}">${grip}<span class="mdmark-table-settings-name">${escapeHtml(name)}</span>${eye}</li>`,
    );
  }
  const note = [
    reordering
      ? "つまみをドラッグするか、つまみにフォーカスして ↑・↓ キーで並べ替えます。"
      : "",
    showing ? "先頭の列は隠せません" : "",
  ].join("");
  return `<div class="mdmark-table-settings" id="${escapeHtml(menuId(id))}" role="dialog" aria-label="テーブル設定"><p class="mdmark-table-settings-title">${showing ? "表示と並び順" : "並び順"}</p><ul class="mdmark-table-settings-list">${items.join("")}</ul><p class="mdmark-table-settings-note" id="${escapeHtml(noteId)}">${note}</p></div>`;
}

/** 階層の表のキーのセルの中身（深さの数の縦線・末尾の名前・配列の `[]`・必須の *）の HTML を返却する */
export function renderTreeKeyCell(options: {
  /** `splitKeyPath` の末尾の名前 */
  name: string;
  /** 深さ */
  depth: number;
  /** 必須か */
  required: boolean;
}): string {
  const { name, depth, required } = options;
  const array = name.endsWith("[]");
  const base = array ? name.slice(0, -2) : name;
  const guides =
    '<span class="mdmark-tree-guide" aria-hidden="true"></span>'.repeat(depth);
  return `<span class="mdmark-tree-cell">${guides}<span class="mdmark-tree-name" tabindex="0">${escapeHtml(base)}</span>${array ? '<span class="mdmark-tree-array">[]</span>' : ""}${required ? '<span class="mdmark-tree-required" aria-label="必須">*</span>' : ""}</span>`;
}

/** 型のセルの文字を、`a | b` の構造なら値ごとのチップ、それ以外はバッジにした HTML を返却する */
export function renderTypeCell(text: string): string {
  const value = text.trim();
  if (value === "") {
    return "";
  }
  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts
      .map(
        (part) => `<span class="mdmark-type-chip">${escapeHtml(part)}</span>`,
      )
      .join(" ");
  }
  return `<span class="mdmark-type-badge" data-type="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

/** 階層の行の開閉・パスのコピー・見本の表示を切り替えるボタンの HTML を返却する */
export function renderTreeTools(options: {
  /** 返却するボタン */
  kind: "toggle" | "copy" | "example";
  /** 行のパス */
  path?: string;
  /** 開いているか */
  expanded?: boolean;
  /** 見本の `id` */
  controls?: string;
}): string {
  const { kind, path = "", expanded = true, controls = "" } = options;
  switch (kind) {
    case "toggle":
      return `<button class="mdmark-tree-toggle mdmark-table-tree-toggle" type="button" aria-expanded="${expanded}" aria-label="${escapeHtml(path)} を${expanded ? "畳む" : "開く"}">${iconSvg("chevron-down")}</button>`;
    case "copy":
      return `<button class="mdmark-tree-copy" type="button" aria-label="全体のパスをコピー">${iconSvg("copy")}<span class="mdmark-tree-copy-status" role="status"></span></button>`;
    case "example":
      return `<button class="mdmark-tree-example-toggle" type="button" aria-expanded="${expanded}" aria-controls="${escapeHtml(controls)}">${expanded ? "見本を隠す" : "見本を表示"}</button>`;
    default: {
      const unknown: never = kind;
      throw new Error(`知らないボタン: ${String(unknown)}`);
    }
  }
}

/** 集計の行（`<tfoot>`）の HTML を返却する。計算ごとに 1 行（`sum`・`avg`・`count` の順）で、列の数だけセルを持つ。先頭のセルに計算の名前、集計する列のセルに値を出し、隠している列のセルと出さない計算の行は隠す */
export function renderTotalRows(options: {
  /** 列の数 */
  columns: number;
  /** 集計する列と計算と整えた値 */
  totals: Array<TableTotal & { value: string }>;
  /** 出す計算（既定は全て） */
  shown?: TotalCalc[];
  /** 隠している列の位置 */
  hiddenColumns: number[];
  /** 列名（`data-label`） */
  labels: string[];
}): string {
  const { columns, totals, shown, hiddenColumns, labels } = options;
  const rows = TOTAL_CALCS.filter((calc) =>
    totals.some((total) => total.calc === calc),
  ).map((calc) => {
    const own = totals.filter((total) => total.calc === calc);
    const cells = Array.from({ length: columns }, (_, column) => {
      const total = own.find((candidate) => candidate.column === column);
      const hidden = hiddenColumns.includes(column) ? " hidden" : "";
      const label = ` data-label="${escapeHtml(labels[column] ?? "")}"`;
      const name =
        column === 0
          ? `<span class="mdmark-total-name">${TOTAL_LABELS[calc]}</span>`
          : "";
      if (!total) {
        return `<td${label}${hidden}>${name}</td>`;
      }
      return `<td${label} data-total="${calc}"${hidden}>${name}<span class="mdmark-total-value">${escapeHtml(total.value)}</span></td>`;
    });
    const rowHidden =
      shown !== undefined && !shown.includes(calc) ? " hidden" : "";
    return `<tr class="mdmark-table-total" data-total-kind="${calc}"${rowHidden}>${cells.join("")}</tr>`;
  });
  return `<tfoot>${rows.join("")}</tfoot>`;
}

/** 手でコピーさせるパネルの形式。`tree` はファイルツリーの元の罫線のテキスト */
export type CopyPanelFormat = CopyFormat | "tree";

/** クリップボードに書き込めなかったときに、帯の直後へ配置する手でコピーさせるパネルの HTML を返却する */
export function renderCopyPanel(options: {
  /** タイトルの id の頭 */
  id: string;
  /** コピーの形式 */
  format: CopyPanelFormat;
  /** コピーする文字 */
  text: string;
}): string {
  const { id, format, text } = options;
  const titleId = `${id}-title`;
  const noteId = `${id}-note`;
  const target =
    format === "tree"
      ? "ツリーのテキスト"
      : `「${COPY_FORMATS[format].name}」の中身`;
  return `<div class="mdmark-copy-panel" role="group" aria-labelledby="${escapeHtml(titleId)}"><div class="mdmark-copy-panel-head"><p class="mdmark-copy-panel-title" id="${escapeHtml(titleId)}">${iconSvg("circle-alert")}クリップボードにコピーできませんでした</p><button class="mdmark-copy-panel-close" type="button" aria-label="閉じる">${iconSvg("x")}</button></div><p class="mdmark-copy-panel-note" id="${escapeHtml(noteId)}">${target}を選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p><textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="${escapeHtml(titleId)} ${escapeHtml(noteId)}">${escapeHtml(text)}</textarea></div>`;
}

/** 行へのリンクのマーカーを持つ先頭のセルの HTML を返却する。`content` は先頭のセルの中身（`SLOT_MARKER` を指定して前後に分けられる）。`notice` を指定すると、URL をコピーした結果をマーカーの横の通知に出す */
export function renderRowLink(
  content: string,
  id: string,
  label: string,
  notice?: "copied" | "failed",
): string {
  const message =
    notice === "copied"
      ? `${iconSvg("check")}リンクをコピーしました`
      : notice === "failed"
        ? `${iconSvg("circle-alert")}リンクをコピーできませんでした`
        : "";
  const state = notice === undefined ? "" : ` data-state="${notice}"`;
  return `<span class="mdmark-row-link-cell">${content}<a class="mdmark-row-anchor" href="#${escapeHtml(id)}" aria-label="「${escapeHtml(label)}」の行へのリンク">${iconSvg("link")}</a><span class="mdmark-row-link-notice" role="status"${state}>${message}</span></span>`;
}

/** 真偽値のセルの中身の HTML を返却する。`true` は ✓ のアイコン、`false` はスクリーンリーダー向けの `いいえ` */
export function renderCheckCell(value: "true" | "false"): string {
  return value === "true"
    ? `<span class="mdmark-check" role="img" aria-label="はい">${iconSvg("check")}</span>`
    : '<span class="mdmark-visually-hidden">いいえ</span>';
}

/** セルの文字が真偽値か */
export function isCheckValue(text: string): text is "true" | "false" {
  return text === "true" || text === "false";
}

/** 列と行から表の HTML を作る（Storybook 用。操作を付けた後の外観になる） */
function renderTableBody(options: TableOptions, id: string): string {
  const columns = options.columns ?? [];
  const rows = options.rows ?? [];
  const filters = options.filters ?? [];
  const values = options.filterValues ?? [];
  const pinMode = options.pinMode ?? "each";
  const pinned = new Set(
    options.overflow
      ? (options.pinned ??
          Array.from({ length: options.rowHeader ?? 0 }, (_, index) => index))
      : [],
  );
  // 選んだ列のうち、表の見えている幅に収まらず留めない列
  const unpinned = new Set(options.overflow ? (options.unpinned ?? []) : []);
  const stuck = (column: number): boolean =>
    pinned.has(column) && !unpinned.has(column);
  // 境の線は、左端から続けて留めた列の最も右の列に引く（描いた直後のスクロールの位置での見え方）
  let pinnedEdge = -1;
  while (stuck(pinnedEdge + 1)) {
    pinnedEdge += 1;
  }
  const pinnedLast = Math.max(-1, ...pinned);
  const rowHeader = options.rowHeader ?? 0;
  const hidden = new Set(
    options.features.includes("columns")
      ? (options.hiddenColumns ?? options.hide ?? [])
      : [],
  );
  const hiddenAttribute = (column: number): string =>
    hidden.has(column) ? " hidden" : "";
  const drawers: string[] = [];
  /** 強調する列の色 */
  const highlightOf = (column: number): ColorName | undefined =>
    options.highlight?.find((item) => item.column === column)?.color;
  const wideColumns = new Set(options.wide ?? []);
  const checkColumns = new Set(options.check ?? []);
  const widthOf = new Map(
    (options.widths ?? []).map((item) => [item.column, item.width]),
  );
  const autoWidthOf = new Map(
    (options.autoWidths ?? []).map((item) => [item.column, item.width]),
  );
  /** セルの class 属性（ピン止めした列・強調する列・広く取る列・真偽値の列・`extra`）と色 */
  const cellClass = (column: number, extra: string[] = []): string => {
    const names = [
      ...(stuck(column)
        ? column === pinnedEdge
          ? ["is-pinned-col", "is-pinned-edge"]
          : ["is-pinned-col"]
        : []),
      ...(highlightOf(column) ? ["mdmark-col-highlight"] : []),
      ...(wideColumns.has(column) ? ["mdmark-wide"] : []),
      ...(checkColumns.has(column) ? ["mdmark-align-center"] : []),
      ...(widthOf.has(column) ? ["is-resized"] : []),
      ...extra,
    ];
    const color = highlightOf(column);
    const colorAttribute = color ? ` data-color="${color}"` : "";
    return `${names.length > 0 ? ` class="${names.join(" ")}"` : ""}${colorAttribute}`;
  };
  /** 列の見出しのセルの中身（ボタンを付けるときはボタンとドロワー） */
  const headCell = (column: string, index: number): string => {
    const filter = filters.find((candidate) => candidate.column === index);
    const value = values.find((candidate) => candidate.column === index);
    const tools = renderTableTools({
      id,
      column: index,
      label: plainText(column),
      features: options.features,
      sortable: !(options.noSort ?? []).includes(index),
      filter: filter && {
        kind: filter.kind,
        values: [...new Set(rows.map((row) => plainText(row[index] ?? "")))],
      },
      active: isActive(value),
      open: options.openFilter === index,
      value,
      pinVisible: options.overflow === true,
      pinPressed: pinMode === "each" ? pinned.has(index) : index === pinnedLast,
      pinUnpinned:
        pinMode === "each"
          ? unpinned.has(index)
          : index === pinnedLast && unpinned.size > 0,
      pinMode,
    });
    drawers.push(tools.drawer);
    const sorted =
      options.sort?.column === index
        ? ` aria-sort="${options.sort.direction}"`
        : "";
    const header = ["sort", "filter", "pin", "resize"].some((feature) =>
      options.features.includes(feature),
    )
      ? tools.header
      : escapeHtml(plainText(column));
    const resizedHeader =
      options.resizing === index
        ? header.replace(
            'class="mdmark-col-resize"',
            'class="mdmark-col-resize is-dragging"',
          )
        : header;
    const width = widthOf.get(index);
    const autoWidth = autoWidthOf.get(index);
    const declarations = [
      ...(width === undefined
        ? []
        : [
            `width:${width}px`,
            `min-width:${width}px`,
            `--mdmark-column-min-width:${width}px`,
          ]),
      ...(autoWidth === undefined || width !== undefined
        ? []
        : [`--mdmark-auto-width:${autoWidth}px`]),
    ];
    const style =
      declarations.length === 0 ? "" : ` style="${declarations.join(";")}"`;
    return `<th${cellClass(index)}${style}${sorted}${hiddenAttribute(index)}>${resizedHeader}</th>`;
  };
  const head = options.headRows
    ? renderHeadRows(options.headRows, columns, headCell)
    : `<tr>${columns.map(headCell).join("")}</tr>`;
  const rowLinking = options.features.includes("rowlink");
  const labels = columns.map(plainText);
  const shownRows: string[][] = [];
  /** 本文の行が絞り込みに合うか */
  const matches = (row: string[]): boolean =>
    values.every((value) => {
      const filter = filters.find((c) => c.column === value.column);
      return filter
        ? matchesFilter(plainText(row[value.column] ?? ""), filter.kind, value)
        : true;
    });
  const order = sortedIndexes(options);
  const mergeColumns = options.mergeColumns ?? [];
  const shownOrder = order.filter((rowIndex) => matches(rows[rowIndex] ?? []));
  const spans = mergeSpans({
    values: shownOrder.map((rowIndex) =>
      mergeColumns.map((column) => plainText(rows[rowIndex]?.[column] ?? "")),
    ),
    columns: mergeColumns,
  });
  const spanOf = new Map(
    shownOrder.map((rowIndex, position) => [rowIndex, spans[position] ?? []]),
  );
  const body = order
    .map((rowIndex) => {
      const row = rows[rowIndex] ?? [];
      const match = matches(row);
      if (match) {
        shownRows.push(row);
      }
      const rowId = rowLinking ? options.rowIds?.[rowIndex] : undefined;
      const targeted = rowLinking && options.targetRow === rowIndex;
      const cells = row
        .map((text, index) => {
          const checkValue =
            checkColumns.has(index) && isCheckValue(text) ? text : undefined;
          const cell = checkValue ? renderCheckCell(checkValue) : text;
          const valueAttribute = checkValue
            ? ` data-value="${checkValue}"`
            : "";
          const linked =
            index === 0 && rowId !== undefined
              ? renderRowLink(
                  cell,
                  rowId,
                  plainText(cell),
                  targeted ? options.rowLinkNotice : undefined,
                )
              : cell;
          const content = linked;
          const merge = mergeColumns.indexOf(index);
          const span = merge >= 0 ? spanOf.get(rowIndex)?.[merge] : undefined;
          const spanAttribute =
            span !== undefined && span > 1 ? ` rowspan="${span}"` : "";
          const mergedHidden =
            span === 0 && !hidden.has(index) ? " hidden" : "";
          const classes = cellClass(index, spanAttribute ? ["is-merged"] : []);
          const tag = index < rowHeader ? "th" : "td";
          const scope = tag === "th" ? ' scope="row"' : "";
          return `<${tag}${scope}${classes}${spanAttribute}${valueAttribute} data-label="${escapeHtml(labels[index] ?? "")}"${hiddenAttribute(index)}${mergedHidden}>${content}</${tag}>`;
        })
        .join("");
      const idAttribute =
        rowId === undefined ? "" : ` id="${escapeHtml(rowId)}"`;
      const target = targeted ? " data-target" : "";
      const rowColor = options.rowColors?.[rowIndex];
      const colorAttribute = rowColor ? ` data-color="${rowColor}"` : "";
      const line = `<tr${idAttribute}${target}${colorAttribute}${match ? "" : " hidden"}>${cells}</tr>`;
      return line;
    })
    .join("");
  const empty = `<tr class="mdmark-table-empty"${shownRows.length > 0 ? " hidden" : ""}><td colspan="${columns.length - hidden.size}">一致する行がありません</td></tr>`;
  const totals = options.features.includes("total")
    ? (options.totals ?? [])
    : [];
  const unreadable = findUnreadableTotals({
    rows: rows.map((row) => row.map(plainText)),
    totals,
  });
  const footer =
    totals.length > 0
      ? renderTotalRows({
          columns: columns.length,
          totals: totals.map((total) => ({
            ...total,
            value: unreadable.some(
              (item) =>
                item.column === total.column && item.calc === total.calc,
            )
              ? ""
              : computeTotal(
                  shownRows.map((row) => plainText(row[total.column] ?? "")),
                  total.calc,
                ),
          })),
          shown: options.shownTotals,
          hiddenColumns: [...hidden],
          labels,
        })
      : "";
  const { bar, menus } = renderTableBar({
    id,
    features: options.features,
    labels,
    shown: shownRows.length,
    total: rows.length,
    hiddenColumns: [...hidden],
    openColumns: options.openColumns ?? false,
    copyState: options.copyState ?? "idle",
    totals: totals.map((total) => total.calc),
    shownTotals: options.shownTotals,
    openTotals: options.openTotals ?? false,
    openCopy: options.openCopy ?? false,
    order: options.order,
    groups: options.headRows ? headGroupsOf(options.headRows) : undefined,
    groupLabels: options.headRows
      ? headGroupLabelsOf(options.headRows)
      : undefined,
    pinned:
      options.pinMode === "through" && options.pin !== undefined
        ? Math.max(...options.pin) + 1
        : 0,
    dragging: options.dragging,
  });
  const panel = options.copyFallback
    ? renderCopyPanel({ id: `${id}-panel`, ...options.copyFallback })
    : "";
  const autoTotal = [...autoWidthOf.values()].reduce(
    (sum, width) => sum + width,
    0,
  );
  const autoAttribute =
    autoWidthOf.size > 0
      ? ` data-auto-width style="--mdmark-auto-table-width:${autoTotal}px"`
      : "";
  const tableHtml = `<table tabindex="0" aria-label="表"${autoAttribute}><thead>${head}</thead><tbody>${body}${empty}</tbody>${footer}</table>`;
  return `${bar}${panel}<div class="mdmark-table-scroll">${options.order ? reorderCellsHtml(tableHtml, options.order) : tableHtml}</div>${menus}${drawers.join("")}`;
}

/** 表の HTML の各行のセルを、列の順 `order` にもう一度並べる（セルの数が列の数と同じ行だけ） */
function reorderCellsHtml(html: string, order: number[]): string {
  return html.replace(
    /(<tr\b[^>]*>)([\s\S]*?)(<\/tr>)/g,
    (whole, open: string, inner: string, close: string) => {
      const cells = inner.match(/<t([hd])\b[\s\S]*?<\/t\1>/g) ?? [];
      if (cells.length !== order.length) {
        return whole;
      }
      return `${open}${order.map((column) => cells[column] ?? "").join("")}${close}`;
    },
  );
}

/** 多段の見出しから、最下段の列ごとに、その列を覆う上の行の結合した見出しの `{行}:{位置}` を返却する */
function headGroupsOf(headRows: TableHeadCell[][]): Array<string | undefined> {
  const bottom = headRows.length - 1;
  const columns = Math.max(
    ...headRows.flatMap((row) =>
      row.map((cell) => cell.column + (cell.colspan ?? 1)),
    ),
  );
  return Array.from({ length: columns }, (_, column) => {
    for (let row = bottom - 1; row >= 0; row -= 1) {
      const cell = headRows[row]?.find(
        (candidate) =>
          (candidate.colspan ?? 1) > 1 &&
          candidate.column <= column &&
          column < candidate.column + (candidate.colspan ?? 1) &&
          row + (candidate.rowspan ?? 1) - 1 < bottom,
      );
      if (cell) {
        return `${row}:${cell.column}`;
      }
    }
    return undefined;
  });
}

/** 多段の見出しの結合した見出しの `{行}:{位置}` から、見出しの文字を参照する表を返却する */
function headGroupLabelsOf(
  headRows: TableHeadCell[][],
): Record<string, string> {
  const labels: Record<string, string> = {};
  headRows.forEach((row, index) => {
    for (const cell of row) {
      if ((cell.colspan ?? 1) > 1) {
        labels[`${index}:${cell.column}`] = plainText(cell.html);
      }
    }
  });
  return labels;
}

/** 階層の表のストーリーの HTML（表・見本の表示を切り替えるボタン・見本）を返却する */
function renderTreeTable(options: TableOptions, id: string): string {
  const columns = options.columns ?? [];
  const rows = options.rows ?? [];
  const tree = options.tree ?? 0;
  const required = options.treeRequired;
  const keys = rows.map((row) => plainText(row[tree] ?? ""));
  const plans = planTreeRows(keys);
  const collapsed = new Set(options.collapsedPaths ?? []);
  const word = (options.treeFilter ?? "").trim().toLowerCase();
  const selected = options.selectedPath;
  const selectedPlan = plans.find((plan) => plan.path === selected);
  const ancestorsOf = (path: string): string[] => splitKeyPath(path).parents;
  const hits = new Set(
    word === ""
      ? []
      : plans
          .filter((plan) => plan.name.toLowerCase().includes(word))
          .map((plan) => plan.path),
  );
  const keep = new Set(
    [...hits].flatMap((path) => [path, ...ancestorsOf(path)]),
  );
  const inScope = (path: string): boolean => {
    if (!selectedPlan) {
      return false;
    }
    return plans.some(
      (plan) =>
        plan.parent === selectedPlan.parent &&
        (plan.path === path || path.startsWith(`${plan.path}.`)),
    );
  };
  const shownColumns = columns.flatMap((_, column) =>
    column === required ? [] : [column],
  );
  const head = shownColumns
    .map((column) => `<th>${columns[column] ?? ""}</th>`)
    .join("");
  let shown = 0;
  const body = plans
    .map((plan) => {
      const row = plan.source === undefined ? undefined : rows[plan.source];
      const folded = ancestorsOf(plan.path).some((path) => collapsed.has(path));
      const hidden = word === "" ? folded : !keep.has(plan.path);
      if (!hidden && !plan.virtual) {
        shown += 1;
      }
      const isRequired =
        row !== undefined &&
        required !== undefined &&
        ["✓", "true"].includes(plainText(row[required] ?? "").trim());
      let key = renderTreeKeyCell({
        name: plan.name,
        depth: plan.depth,
        required: isRequired,
      });
      if (selectedPlan && inScope(plan.path)) {
        let count = 0;
        key = key.replace(/class="mdmark-tree-guide"/g, (match) => {
          count += 1;
          return count === selectedPlan.depth
            ? 'class="mdmark-tree-guide is-active"'
            : match;
        });
      }
      const tool = plan.hasChildren
        ? renderTreeTools({
            kind: "toggle",
            path: plan.path,
            expanded: !collapsed.has(plan.path),
          })
        : '<span class="mdmark-tree-spacer" aria-hidden="true"></span>';
      key = key.replace(
        '<span class="mdmark-tree-name"',
        `${tool}<span class="mdmark-tree-name"`,
      );
      if (hits.has(plan.path)) {
        key = key.replace(
          /(<span class="mdmark-tree-name" tabindex="0">)([^<]*)(<\/span>)/,
          (_whole, open: string, text: string, close: string) => {
            const at = text.toLowerCase().indexOf(word);
            return at < 0
              ? `${open}${text}${close}`
              : `${open}${text.slice(0, at)}<mark class="mdmark-tree-hit">${text.slice(at, at + word.length)}</mark>${text.slice(at + word.length)}${close}`;
          },
        );
      }
      key = key.replace(
        /<\/span>$/,
        `${renderTreeTools({ kind: "copy" })}</span>`,
      );
      const cells = shownColumns
        .map((column) => {
          if (column === tree) {
            return `<td class="mdmark-tree-key">${key}</td>`;
          }
          const text = row?.[column] ?? "";
          if (column === options.treeType && text !== "") {
            return `<td>${renderTypeCell(plainText(text))}</td>`;
          }
          if (column === options.treeDefault && text !== "") {
            return `<td><span class="mdmark-tree-default">${text}</span></td>`;
          }
          return `<td>${row ? text : ""}</td>`;
        })
        .join("");
      const classes = [
        "mdmark-tree-row",
        ...(plan.virtual ? ["is-virtual"] : []),
        ...(plan.hasChildren ? ["has-children"] : []),
      ].join(" ");
      return `<tr class="${classes}" data-path="${escapeHtml(plan.path)}" data-parent="${escapeHtml(plan.parent)}" data-depth="${plan.depth}" aria-selected="${plan.path === selected}"${hidden ? " hidden" : ""}>${cells}</tr>`;
    })
    .join("");
  const counted = plans.filter((plan) => !plan.virtual).length;
  const count = options.features.includes("count")
    ? `<div class="mdmark-table-bar"><p class="mdmark-table-count" aria-live="polite"><span aria-hidden="true">${shown} / ${counted} 件</span><span class="mdmark-visually-hidden">${counted} 件中 ${shown} 件を表示</span></p></div>`
    : "";
  const table = `<div class="mdmark-table" data-kind="${options.kind ?? "default"}" data-features="${options.features.join(" ")}" data-tree="${tree}">${count}<div class="mdmark-table-scroll"><table tabindex="0" aria-label="表"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
  const example = options.example;
  if (!example) {
    return table;
  }
  const exampleId = `${id}-example`;
  const active = example.active ?? 0;
  const panels = example.tabs.map((tab, index) => {
    const lines = (tab.lines ?? [])
      .map((line) => {
        const linked =
          index === active && line.path !== undefined && line.path === selected;
        const path = line.path ? ` data-path="${escapeHtml(line.path)}"` : "";
        return `<span class="mdmark-code-line mdmark-yaml-line${linked ? " is-linked" : ""}"${path}><span class="mdmark-code-text">${escapeHtml(line.text)}</span></span>`;
      })
      .join("\n");
    return `<div class="mdmark-code"><pre class="mdmark-code-lines"><code class="language-yaml">${lines}</code></pre></div>`;
  });
  const tabs = renderTabs({
    id: `${id}-tabs`,
    titles: example.tabs.map((tab) => escapeHtml(tab.name)),
    panels,
    selected: active,
  });
  const hidden = example.hidden === true;
  return `<div class="mdmark-tree-layout${hidden ? " is-example-hidden" : ""}"><div class="mdmark-tree-bar">${renderTreeTools({ kind: "example", expanded: !hidden, controls: exampleId })}</div>${table}<aside class="mdmark-tree-example" id="${exampleId}" aria-label="見本: ${escapeHtml(example.heading)}"${hidden ? " hidden" : ""}>${tabs}</aside></div>`;
}

/** 多段の見出しの行を描く。`bottomHeadCells` で決めた列ごとの最下段のセルは `headCell` で、ほかのセルは文字だけで描く */
function renderHeadRows(
  headRows: TableHeadCell[][],
  columns: string[],
  headCell: (column: string, index: number) => string,
): string {
  const bottom = bottomHeadCells(
    headRows.map((cells) =>
      cells.map((cell) => ({
        rowSpan: cell.rowspan ?? 1,
        colSpan: cell.colspan ?? 1,
      })),
    ),
  );
  return headRows
    .map((cells, row) => {
      const html = cells
        .map((cell, index) => {
          const column = bottom.findIndex(
            (item) => item?.row === row && item.cell === index,
          );
          const rowspan = cell.rowspan ?? 1;
          const colspan = cell.colspan ?? 1;
          const spans = `${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}${colspan > 1 ? ` colspan="${colspan}"` : ""}`;
          const scope = colspan > 1 ? "colgroup" : "col";
          if (column >= 0) {
            // 列のボタンを持つセルに、セルの結合の属性を追加する
            return headCell(columns[column] ?? cell.html, column).replace(
              "<th",
              `<th${spans} scope="${scope}"`,
            );
          }
          return `<th${spans} scope="${scope}">${escapeHtml(plainText(cell.html))}</th>`;
        })
        .join("");
      return `<tr>${html}</tr>`;
    })
    .join("");
}

/** 表を囲む HTML を返却する。`body` を指定すると囲みだけを作り、指定しなければ `columns`・`rows` から表を作る */
export function renderTable(options: TableOptions): string {
  if (options.tree !== undefined && options.rows !== undefined) {
    return renderTreeTable(options, options.id ?? "mdmark-table");
  }
  const kind = options.kind ?? "default";
  const filters = options.features.includes("filter")
    ? (options.filters ?? [])
    : [];
  const filterAttribute = filters.length
    ? ` data-filter="${filters.map((filter) => `${filter.column}:${filter.kind}`).join(" ")}"`
    : "";
  const hide = options.features.includes("columns") ? (options.hide ?? []) : [];
  const hideAttribute = hide.length ? ` data-hide="${hide.join(" ")}"` : "";
  const totals = options.features.includes("total")
    ? (options.totals ?? [])
    : [];
  const totalAttribute = totals.length
    ? ` data-total="${totals.map((total) => `${total.column}:${total.calc}`).join(" ")}"`
    : "";
  const pinAttribute =
    options.pin !== undefined && options.features.includes("pin")
      ? ` data-pin="${options.pin.join(" ")}"`
      : "";
  const unpinAttribute =
    options.unpin !== undefined &&
    options.unpin.length > 0 &&
    options.features.includes("pin")
      ? ` data-unpin="${options.unpin.join(" ")}"`
      : "";
  const check = options.check ?? [];
  const checkAttribute = check.length ? ` data-check="${check.join(" ")}"` : "";
  const treeAttribute =
    options.tree !== undefined ? ` data-tree="${options.tree}"` : "";
  const content =
    options.body === undefined
      ? renderTableBody(options, options.id ?? "mdmark-table")
      : `<div class="mdmark-table-scroll">${options.body}</div>`;
  const collapse = options.collapse ?? "none";
  const title =
    options.title ??
    `表（${options.rows?.length ?? options.rowCount ?? 0} 行）`;
  const inner =
    collapse === "none"
      ? content
      : `<details class="mdmark-table-details"${collapse === "open" ? " open" : ""}><summary>${escapeHtml(title)}</summary>${content}</details>`;
  const long = options.long ?? [];
  const longAttribute = long.length ? ` data-long="${long.join(" ")}"` : "";
  const noSort = options.noSort ?? [];
  const noSortAttribute = noSort.length
    ? ` data-no-sort="${noSort.join(" ")}"`
    : "";
  const ranges = options.widthRanges ?? [];
  const widthAttribute = ranges.length
    ? ` data-width="${ranges.map((range) => `${range.column}:${range.min ?? ""}-${range.max ?? ""}`).join(" ")}"`
    : "";
  const mergeColumns = options.mergeColumns ?? [];
  const mergeAttribute = mergeColumns.length
    ? ` data-merge-columns="${mergeColumns.join(" ")}"`
    : "";
  if (options.rawCsv === undefined) {
    return `<div class="mdmark-table" data-kind="${kind}" data-features="${options.features.join(" ")}"${filterAttribute}${hideAttribute}${totalAttribute}${pinAttribute}${unpinAttribute}${checkAttribute}${treeAttribute}${mergeAttribute}${longAttribute}${noSortAttribute}${widthAttribute}>${inner}</div>`;
  }
  // CSV の表: 表の後ろに元の CSV を配置する。帯の右端の RAW のボタンは、表を描いたとき（`body` を指定しないとき）だけ配置し、記法の表には `mount` が付ける
  const shown = options.rawShown ?? false;
  const bar = options.body === undefined ? renderRawBar(shown) : "";
  const raw = `<pre class="mdmark-raw"${shown ? "" : " hidden"} tabindex="0" aria-label="元の CSV"><code class="language-csv">${escapeHtml(options.rawCsv)}</code></pre>`;
  const viewAttribute = shown ? ' data-view="raw"' : "";
  // 元の CSV を出しているときは、表を包む要素（無ければ表）を隠す
  const shownInner = shown
    ? inner.includes('<div class="mdmark-table-scroll">')
      ? inner.replace(
          '<div class="mdmark-table-scroll">',
          '<div class="mdmark-table-scroll" hidden>',
        )
      : inner.replace(/^<table(?=[\s>])/, "<table hidden")
    : inner;
  return `<div class="mdmark-table" data-kind="${kind}" data-features="${options.features.join(" ")}" data-source="csv"${viewAttribute}${filterAttribute}${hideAttribute}${totalAttribute}${pinAttribute}${unpinAttribute}${checkAttribute}${treeAttribute}${mergeAttribute}${longAttribute}${noSortAttribute}${widthAttribute}>${bar}${shownInner}${raw}</div>`;
}
