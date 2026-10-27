import {
  compareCells,
  computeTotal,
  type FilterKind,
  type FilterValue,
  findUnreadableTotals,
  matchesFilter,
  TOTAL_CALCS,
  TOTAL_LABELS,
  type TotalCalc,
} from "../table-logic.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 表の種類 */
export type TableKind = "default" | "data" | "plain";

/** 表の機能 */
export type TableFeature =
  | "sort"
  | "pin"
  | "filter"
  | "count"
  | "columns"
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
  /** 列の見出しの HTML。`body` を渡すときは省く */
  columns?: string[];
  /** 行ごとのセルの HTML。`body` を渡すときは省く */
  rows?: string[][];
  /** 絞り込みを付ける列 */
  filters?: TableFilter[];
  /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
  collapse?: "none" | "closed" | "open";
  /** 並べ替えた列と向き */
  sort?: { column: number; direction: "ascending" | "descending" };
  /** 表が幅からはみ出しているか。`true` のときだけピン止めのボタンを出す */
  overflow?: boolean;
  /** 左端に留める列の数 */
  pinned?: number;
  /** 開いた絞り込みのドロワーの列の位置 */
  openFilter?: number;
  /** 当てている絞り込み */
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
  /** クリップボードに書けなかったときに手でコピーさせるパネルの中身 */
  copyFallback?: { format: CopyFormat; text: string };
  /** `targetRow` の行の URL をコピーした結果 */
  rowLinkNotice?: "copied" | "failed";
  /** 最終列を畳んでいるか */
  folded?: boolean;
  /** 畳んだ最終列を開いている本文の行の位置 */
  unfoldedRows?: number[];
  /** 表の代わりに置く HTML（`SLOT_MARKER` を渡せる） */
  body?: string;
  /** ドロワーの `id` の頭（既定 `mdmark-table`）。ビューの中の表のように、文書の中に表が 2 つ以上あるときに重ならない値を渡す */
  id?: string;
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
  /** 絞り込み（`select` は候補の値） */
  filter?: { kind: FilterKind; values: string[] } | undefined;
  /** 絞り込みを当てているか */
  active?: boolean;
  /** ドロワーを開いているか */
  open?: boolean;
  /** 当てている絞り込み */
  value?: FilterValue | undefined;
  /** ピン止めのボタンを出すか（既定 `false`。`mount` が幅を測って決める） */
  pinVisible?: boolean;
  /** この列までを留めているか */
  pinPressed?: boolean;
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

/** 列 1 つの見出しの中身（並べ替え・絞り込み・ピン止めのボタン）と、その列の絞り込みのドロワーの HTML を返す */
export function renderTableTools(options: TableToolsOptions): {
  header: string;
  drawer: string;
} {
  const {
    id,
    column,
    label,
    features,
    filter,
    active = false,
    pinVisible = false,
    pinPressed = false,
  } = options;
  const open = options.open ?? false;
  const escapedLabel = escapeHtml(label);
  const controls = drawerId(id, column);
  const filterable = features.includes("filter") && filter !== undefined;
  const title = features.includes("sort")
    ? `<button class="mdmark-sort" type="button">${escapedLabel}</button>`
    : `<span class="mdmark-th-label">${escapedLabel}</span>`;
  const filterButton = filterable
    ? `<button class="mdmark-filter${active ? " is-active" : ""}" type="button" aria-label="「${escapedLabel}」で絞り込む" aria-expanded="${open}" aria-controls="${escapeHtml(controls)}"><span class="mdmark-visually-hidden">${active ? "（絞り込み中）" : ""}</span></button>`
    : "";
  const pinButton = features.includes("pin")
    ? `<button class="mdmark-pin" type="button" aria-label="「${escapedLabel}」までを左端に留める" aria-pressed="${pinPressed}"${pinVisible ? "" : " hidden"}></button>`
    : "";
  const tools =
    filterButton || pinButton
      ? `<span class="mdmark-th-tools">${filterButton}${pinButton}</span>`
      : "";
  const drawer = filterable
    ? `<div class="mdmark-filter-drawer" id="${escapeHtml(controls)}" role="dialog" aria-label="「${escapedLabel}」で絞り込む" data-filter-kind="${filter.kind}" data-column="${column}"${open ? "" : " hidden"}><p class="mdmark-filter-title">「${escapedLabel}」で絞り込む</p>${renderFilterFields(options)}<button class="mdmark-filter-clear" type="button">絞り込みを外す</button></div>`
    : "";
  return {
    header: `<span class="mdmark-th">${title}${tools}</span>`,
    drawer,
  };
}

/** 絞り込みを当てているか（空の絞り込みは当てていない） */
function isActive(value: FilterValue | undefined): boolean {
  return Boolean(
    value?.values?.length || value?.text || value?.from || value?.to,
  );
}

/** 行を並べ替えた順の位置を返す */
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

/** コピーのボタンの中身（状態のアイコン・文言・形式のメニューを開くことを示す下向きの矢印）の HTML */
export function renderCopyButtonContent(state: CopyState): string {
  const { icon, label } = COPY_STATES[state];
  return `${iconSvg(icon)}<span class="mdmark-copy-label">${label}</span><span class="mdmark-copy-caret" data-icon="chevron-down">${iconSvg("chevron-down")}</span>`;
}

/** コピーの形式の名前と使いどころ */
export const COPY_FORMATS = {
  markdown: {
    name: "Markdown の表",
    note: "文書に貼るとそのまま表になる",
  },
  tsv: { name: "TSV", note: "表計算ソフトに貼るとセルに分かれる" },
} as const;

/** 列の表示のメニューの id */
function menuId(id: string): string {
  return `${id}-columns`;
}

/** 集計のメニューの id */
function totalsMenuId(id: string): string {
  return `${id}-totals`;
}

/** コピーの形式のメニューの id */
function copyMenuId(id: string): string {
  return `${id}-copy`;
}

/** 表の上の帯（件数・列の表示・集計・コピーのボタン）と、列の表示・集計・コピーの形式のメニューの HTML を返す。付けた機能が無ければ空 */
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
  /** 列の表示のメニューを開いているか（既定 `false`） */
  openColumns?: boolean;
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
  const totaling = features.includes("total") && calcs.length > 0;
  const copying = features.includes("copy");
  const count = counting
    ? `<p class="mdmark-table-count" aria-live="polite"><span aria-hidden="true">${shown} / ${total} 件</span><span class="mdmark-visually-hidden">${total} 件中 ${shown} 件を表示</span></p>`
    : "";
  const columnsToggle = columns
    ? `<button class="mdmark-table-tool mdmark-columns-toggle${hidden.size > 0 ? " is-active" : ""}" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(menuId(id))}">${iconSvg("columns-3")}列の表示<span class="mdmark-visually-hidden">${hidden.size > 0 ? `（${hidden.size} 列を隠しています）` : ""}</span></button>`
    : "";
  const totalsToggle = totaling
    ? `<button class="mdmark-table-tool mdmark-totals-toggle${hiddenCalcs.length > 0 ? " is-active" : ""}" type="button" aria-expanded="${options.openTotals ?? false}" aria-controls="${escapeHtml(totalsMenuId(id))}">${iconSvg("sigma")}集計<span class="mdmark-visually-hidden">${hiddenCalcs.length > 0 ? `（${hiddenCalcs.length} 件を隠しています）` : ""}</span></button>`
    : "";
  const copy = copying
    ? `<button class="mdmark-table-tool mdmark-copy" type="button" data-state="${copyState}" aria-expanded="${options.openCopy ?? false}" aria-controls="${escapeHtml(copyMenuId(id))}">${renderCopyButtonContent(copyState)}</button>`
    : "";
  const tools =
    columnsToggle || totalsToggle || copy
      ? `<div class="mdmark-table-tools">${columnsToggle}${totalsToggle}${copy}</div>`
      : "";
  const status =
    totaling || copying
      ? `<span class="mdmark-visually-hidden mdmark-table-status" role="status">${copying && copyState !== "idle" ? COPY_STATES[copyState].label : ""}</span>`
      : "";
  const items = labels
    .map(
      (label, index) =>
        `<li><label><input type="checkbox" value="${index}"${hidden.has(index) ? "" : " checked"}${index === 0 ? " disabled" : ""}>${escapeHtml(label)}</label></li>`,
    )
    .join("");
  const columnsMenu = columns
    ? `<div class="mdmark-columns-menu" id="${escapeHtml(menuId(id))}" role="dialog" aria-label="表示する列"${open ? "" : " hidden"}><p class="mdmark-columns-title">表示する列</p><ul class="mdmark-columns-options">${items}</ul><p class="mdmark-columns-note">先頭の列は隠せません</p><button class="mdmark-columns-reset" type="button">既定に戻す</button></div>`
    : "";
  const totalItems = calcs
    .map(
      (calc) =>
        `<li><label><input type="checkbox" value="${calc}"${shownCalcs.has(calc) ? " checked" : ""}>${TOTAL_LABELS[calc]}</label></li>`,
    )
    .join("");
  const totalsMenu = totaling
    ? `<div class="mdmark-totals-menu mdmark-table-menu" id="${escapeHtml(totalsMenuId(id))}" role="dialog" aria-label="出す集計"${options.openTotals ? "" : " hidden"}><p class="mdmark-totals-title">出す集計</p><ul class="mdmark-totals-options">${totalItems}</ul></div>`
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
    menus: `${columnsMenu}${totalsMenu}${copyMenu}`,
  };
}

/** 集計の行（`<tfoot>`）の HTML を返す。計算ごとに 1 行（`sum`・`avg`・`count` の順）で、列の数だけセルを持つ。先頭のセルに計算の名前、集計する列のセルに値を出し、隠している列のセルと出さない計算の行は隠す */
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

/** クリップボードに書けなかったときに、帯の直後へ置く手でコピーさせるパネルの HTML を返す */
export function renderCopyPanel(options: {
  /** 題の id の頭 */
  id: string;
  /** コピーの形式 */
  format: CopyFormat;
  /** コピーする文字 */
  text: string;
}): string {
  const { id, format, text } = options;
  const titleId = `${id}-title`;
  const noteId = `${id}-note`;
  return `<div class="mdmark-copy-panel" role="group" aria-labelledby="${escapeHtml(titleId)}"><div class="mdmark-copy-panel-head"><p class="mdmark-copy-panel-title" id="${escapeHtml(titleId)}">${iconSvg("circle-alert")}クリップボードにコピーできませんでした</p><button class="mdmark-copy-panel-close" type="button" aria-label="閉じる">${iconSvg("x")}</button></div><p class="mdmark-copy-panel-note" id="${escapeHtml(noteId)}">「${COPY_FORMATS[format].name}」の中身を選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p><textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="${escapeHtml(titleId)} ${escapeHtml(noteId)}">${escapeHtml(text)}</textarea></div>`;
}

/** 最終列を畳んだ表の本文の行 1 つについて、先頭のセルに置く開閉のボタンと、行の直後に置く開閉の行の HTML を返す */
export function renderFoldedColumn(options: {
  /** 開閉の行の id（ボタンの `aria-controls` が指す） */
  id: string;
  /** 表の列の数 */
  columns: number;
  /** 行の先頭のセルの文字 */
  label: string;
  /** 最終列の見出しの文字 */
  name: string;
  /** 行の最終列のセルの中身の HTML */
  html: string;
  /** 開いているか（既定 `false`） */
  open?: boolean;
}): { toggle: string; row: string } {
  const { id, columns, label, name, html, open = false } = options;
  return {
    toggle: `<button class="mdmark-row-toggle mdmark-fold-toggle" type="button" aria-expanded="${open}" aria-controls="${escapeHtml(id)}" aria-label="「${escapeHtml(label)}」の${escapeHtml(name)}"></button>`,
    row: `<tr class="mdmark-row-detail mdmark-fold-detail" id="${escapeHtml(id)}"${open ? "" : " hidden"}><td colspan="${columns}"><div class="mdmark-fold-part"><p class="mdmark-fold-name">${escapeHtml(name)}</p><div class="mdmark-fold-value">${html}</div></div></td></tr>`,
  };
}

/** 行へのリンクの印を持つ先頭のセルの HTML を返す。`content` は先頭のセルの中身（`SLOT_MARKER` を渡して前後に分けられる）。`notice` を渡すと、URL をコピーした結果を印の横の知らせに出す */
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

/** 列と行から表の HTML を作る（Storybook 用。操作を付けた後の見た目になる） */
function renderTableBody(options: TableOptions, id: string): string {
  const columns = options.columns ?? [];
  const rows = options.rows ?? [];
  const filters = options.filters ?? [];
  const values = options.filterValues ?? [];
  const pinned = options.overflow ? (options.pinned ?? 0) : 0;
  const hidden = new Set(
    options.features.includes("columns")
      ? (options.hiddenColumns ?? options.hide ?? [])
      : [],
  );
  const hiddenAttribute = (column: number): string =>
    hidden.has(column) ? " hidden" : "";
  const lastColumn = columns.length - 1;
  const folded = isFolded(options, hidden);
  const unfolded = new Set(options.unfoldedRows ?? []);
  const drawers: string[] = [];
  /** セルの class 属性（ピン止めした列・畳んだ最終列） */
  const cellClass = (column: number): string => {
    const names = [
      ...(column < pinned
        ? column === pinned - 1
          ? ["is-pinned-col", "is-pinned-edge"]
          : ["is-pinned-col"]
        : []),
      ...(folded && column === lastColumn ? ["mdmark-fold-col"] : []),
    ];
    return names.length > 0 ? ` class="${names.join(" ")}"` : "";
  };
  const head = columns
    .map((column, index) => {
      const filter = filters.find((candidate) => candidate.column === index);
      const value = values.find((candidate) => candidate.column === index);
      const tools = renderTableTools({
        id,
        column: index,
        label: plainText(column),
        features: options.features,
        filter: filter && {
          kind: filter.kind,
          values: [...new Set(rows.map((row) => plainText(row[index] ?? "")))],
        },
        active: isActive(value),
        open: options.openFilter === index,
        value,
        pinVisible: options.overflow === true,
        pinPressed: pinned > 0 && index === pinned - 1,
      });
      drawers.push(tools.drawer);
      const sorted =
        options.sort?.column === index
          ? ` aria-sort="${options.sort.direction}"`
          : "";
      const header =
        options.features.includes("sort") ||
        options.features.includes("filter") ||
        options.features.includes("pin")
          ? tools.header
          : escapeHtml(plainText(column));
      return `<th${cellClass(index)}${sorted}${hiddenAttribute(index)}>${header}</th>`;
    })
    .join("");
  const rowLinking = options.features.includes("rowlink");
  const labels = columns.map(plainText);
  const shownRows: string[][] = [];
  const body = sortedIndexes(options)
    .map((rowIndex) => {
      const row = rows[rowIndex] ?? [];
      const match = values.every((value) => {
        const filter = filters.find((c) => c.column === value.column);
        return filter
          ? matchesFilter(
              plainText(row[value.column] ?? ""),
              filter.kind,
              value,
            )
          : true;
      });
      if (match) {
        shownRows.push(row);
      }
      const rowId = rowLinking ? options.rowIds?.[rowIndex] : undefined;
      const targeted = rowLinking && options.targetRow === rowIndex;
      const foldId = `${id}-fold-${rowIndex}`;
      const fold = folded
        ? renderFoldedColumn({
            id: foldId,
            columns: columns.length - hidden.size,
            label: plainText(row[0] ?? ""),
            name: labels[lastColumn] ?? "",
            html: row[lastColumn] ?? "",
            open: unfolded.has(rowIndex),
          })
        : undefined;
      const cells = row
        .map((cell, index) => {
          const linked =
            index === 0 && rowId !== undefined
              ? renderRowLink(
                  cell,
                  rowId,
                  plainText(cell),
                  targeted ? options.rowLinkNotice : undefined,
                )
              : cell;
          const content =
            index === 0 && fold
              ? `<span class="mdmark-row-head">${fold.toggle}${linked}</span>`
              : linked;
          return `<td${cellClass(index)} data-label="${escapeHtml(labels[index] ?? "")}"${hiddenAttribute(index)}>${content}</td>`;
        })
        .join("");
      const idAttribute =
        rowId === undefined ? "" : ` id="${escapeHtml(rowId)}"`;
      const target = targeted ? " data-target" : "";
      const line = `<tr${idAttribute}${target}${match ? "" : " hidden"}>${cells}</tr>`;
      return fold ? `${line}${fold.row}` : line;
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
  });
  const panel = options.copyFallback
    ? renderCopyPanel({ id: `${id}-panel`, ...options.copyFallback })
    : "";
  return `${bar}${panel}<table tabindex="0" aria-label="表"><thead><tr>${head}</tr></thead><tbody>${body}${empty}</tbody>${footer}</table>${menus}${drawers.join("")}`;
}

/** 最終列を畳んだ表として描くか。列が 2 つ以上あり、最終列を隠していないときだけ */
function isFolded(options: TableOptions, hidden: Set<number>): boolean {
  const lastColumn = (options.columns ?? []).length - 1;
  return options.folded === true && lastColumn > 0 && !hidden.has(lastColumn);
}

/** 表を囲む HTML を返す。`body` を渡すと囲みだけを作り、渡さなければ `columns`・`rows` から表を作る */
export function renderTable(options: TableOptions): string {
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
  const content =
    options.body ?? renderTableBody(options, options.id ?? "mdmark-table");
  const collapse = options.collapse ?? "none";
  const inner =
    collapse === "none"
      ? content
      : `<details class="mdmark-table-details"${collapse === "open" ? " open" : ""}><summary>表を開く</summary>${content}</details>`;
  const hiddenColumns = new Set(
    options.features.includes("columns")
      ? (options.hiddenColumns ?? options.hide ?? [])
      : [],
  );
  const foldedClass =
    options.body === undefined && isFolded(options, hiddenColumns)
      ? " is-folded"
      : "";
  return `<div class="mdmark-table${foldedClass}" data-kind="${kind}" data-features="${options.features.join(" ")}"${filterAttribute}${hideAttribute}${totalAttribute}>${inner}</div>`;
}
