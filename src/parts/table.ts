import {
  compareCells,
  type FilterKind,
  type FilterValue,
  matchesFilter,
} from "../table-logic.ts";
import { escapeHtml } from "./escape.ts";

/** 表の種類 */
export type TableKind = "default" | "data" | "plain";

/** 表の機能 */
export type TableFeature = "sort" | "pin" | "filter";

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

/** 列と行から表の HTML を作る（Storybook 用。操作を付けた後の見た目になる） */
function renderTableBody(options: TableOptions, id: string): string {
  const columns = options.columns ?? [];
  const rows = options.rows ?? [];
  const filters = options.filters ?? [];
  const values = options.filterValues ?? [];
  const pinned = options.overflow ? (options.pinned ?? 0) : 0;
  const drawers: string[] = [];
  /** セルの class（ピン止めした列） */
  const pinClass = (column: number): string => {
    if (column >= pinned) {
      return "";
    }
    return column === pinned - 1
      ? ' class="is-pinned-col is-pinned-edge"'
      : ' class="is-pinned-col"';
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
      return `<th${pinClass(index)}${sorted}>${header}</th>`;
    })
    .join("");
  let shown = 0;
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
        shown += 1;
      }
      const cells = row
        .map(
          (cell, index) =>
            `<td${pinClass(index)} data-label="${escapeHtml(plainText(columns[index] ?? ""))}">${cell}</td>`,
        )
        .join("");
      return `<tr${match ? "" : " hidden"}>${cells}</tr>`;
    })
    .join("");
  const empty = `<tr class="mdmark-table-empty"${shown > 0 ? " hidden" : ""}><td colspan="${columns.length}">一致する行がありません</td></tr>`;
  return `<table tabindex="0" aria-label="表"><thead><tr>${head}</tr></thead><tbody>${body}${empty}</tbody></table>${drawers.join("")}`;
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
  const content =
    options.body ?? renderTableBody(options, options.id ?? "mdmark-table");
  const collapse = options.collapse ?? "none";
  const inner =
    collapse === "none"
      ? content
      : `<details class="mdmark-table-details"${collapse === "open" ? " open" : ""}><summary>表を開く</summary>${content}</details>`;
  return `<div class="mdmark-table" data-kind="${kind}" data-features="${options.features.join(" ")}"${filterAttribute}>${inner}</div>`;
}
