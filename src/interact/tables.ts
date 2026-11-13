import type { TablePinMode } from "../config.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import { iconSvg } from "../parts/icons.ts";
import {
  COPY_FORMATS,
  COPY_STATES,
  type CopyFormat,
  type CopyState,
  renderCopyButtonContent,
  renderCopyPanel,
  renderTableBar,
  renderTableTools,
  renderTotalRows,
  type TableTotal,
  updateSettingsToggle,
} from "../parts/table.ts";
import {
  bottomHeadCells,
  columnWidthLimit,
  compareCells,
  computeTotal,
  DEFAULT_LONG_COLUMN_MIN_EM,
  FILTER_KINDS,
  type FilterKind,
  type FilterValue,
  findUnreadableTotals,
  initialPinnedColumns,
  matchesFilter,
  mergeSpans,
  pinOffsets,
  rowIdFromHash,
  TOTAL_CALCS,
  TOTAL_LABELS,
  type TotalCalc,
  tableToMarkdown,
  tableToTsv,
  togglePinnedColumn,
} from "../table-logic.ts";
import { COPIED_NOTICE_MS, copyText } from "./clipboard.ts";
import { attachColumnResize } from "./table-resize.ts";
import { attachTableSettings, reorderRowCells } from "./table-settings.ts";
import { attachTableTree, TREE_FOLDED_ATTRIBUTE } from "./table-tree.ts";
import { attachAutoColumnWidths } from "./table-width.ts";
import { cellValue, visibleText } from "./text.ts";

export { compareCells, type FilterValue, matchesFilter };

// 表を横にスクロールさせる、表を包む要素の class
const SCROLL_CLASS = "mdmark-table-scroll";

// 並べ替えの向きの順番（押すたびに次へ進み、最後の次は先頭へ戻る）
const SORT_CYCLE = ["none", "descending", "ascending"] as const;

// ドロワーとボタンの間の隙間と、画面の端に残す余白（px）
const DRAWER_GAP = 4;
const VIEWPORT_GUTTER = 16;

// 表の id を文書の中で重ならせないための通し番号
let tableCounter = 0;

/** 絞り込みを付ける列と種類を、`data-filter`（`0:select 2:date`）から読み込む */
function readFilterKinds(value: string | undefined): Map<number, FilterKind> {
  const kinds = new Map<number, FilterKind>();
  for (const item of (value ?? "").split(/\s+/).filter(Boolean)) {
    const [column, kind] = item.split(":");
    if (FILTER_KINDS.includes(kind as FilterKind)) {
      kinds.set(Number(column), kind as FilterKind);
    }
  }
  return kinds;
}

/** `data-hide`（`1 3`）から隠す列の位置を読み込む */
function readColumnList(value: string | undefined): number[] {
  return (value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
}

/** `data-total`（`2:sum 0:count`）から集計する列と計算を読み込む */
function readTotalSpecs(value: string | undefined): TableTotal[] {
  const totals: TableTotal[] = [];
  for (const item of (value ?? "").split(/\s+/).filter(Boolean)) {
    const [column, calc] = item.split(":");
    if (TOTAL_CALCS.includes(calc as TotalCalc)) {
      totals.push({ column: Number(column), calc: calc as TotalCalc });
    }
  }
  return totals;
}

/** 行の直後に続く行の詳細の行を返却する */
function detailsOf(row: HTMLTableRowElement): HTMLTableRowElement[] {
  const details: HTMLTableRowElement[] = [];
  for (
    let next = row.nextElementSibling;
    next instanceof HTMLTableRowElement &&
    next.classList.contains("mdmark-row-detail");
    next = next.nextElementSibling
  ) {
    details.push(next);
  }
  return details;
}

/** 表の本文の行（行の詳細の行と一致なしの行を除く）を返却する */
function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return [...(table.tBodies[0]?.rows ?? [])].filter(
    (row) =>
      !row.classList.contains("mdmark-row-detail") &&
      !row.classList.contains("mdmark-table-empty"),
  );
}

/** 囲みの中の要素のうち、その囲み自身の表に属するもの（中の表の囲みの要素を除く）を返却する */
function ownElements<T extends Element>(
  wrapper: HTMLElement,
  selector: string,
): T[] {
  return [...wrapper.querySelectorAll<T>(selector)].filter(
    (element) => element.closest(".mdmark-table") === wrapper,
  );
}

/** 囲みの中の要素のうち、その囲み自身の表に属する最初のもの（無ければ `null`）を返却する */
function ownElement<T extends Element>(
  wrapper: HTMLElement,
  selector: string,
): T | null {
  return ownElements<T>(wrapper, selector)[0] ?? null;
}

/** 見出しの行ごとのセルの左端の列の位置を、`rowspan`・`colspan` の格子から決める */
function headColumnsOf(
  table: HTMLTableElement,
): Map<HTMLTableCellElement, number> {
  const columns = new Map<HTMLTableCellElement, number>();
  const taken: Array<Set<number>> = [];
  for (const [row, line] of [...(table.tHead?.rows ?? [])].entries()) {
    let column = 0;
    for (const cell of line.cells) {
      while (taken[row]?.has(column)) {
        column += 1;
      }
      columns.set(cell, column);
      for (let r = row; r < row + cell.rowSpan; r++) {
        taken[r] ??= new Set();
        for (let c = column; c < column + cell.colSpan; c++) {
          taken[r]?.add(c);
        }
      }
      column += cell.colSpan;
    }
  }
  return columns;
}

/** 列ごとの、ボタンを配置する見出しのセルを返却する。見出しが多段なら `bottomHeadCells` で決めた最下段のセルで、複数の列をまたぐセルしか無い列は DOM に配置しない空のセルにする */
function columnHeadsOf(table: HTMLTableElement): HTMLTableCellElement[] {
  const rows = [...(table.tHead?.rows ?? [])];
  if (rows.length <= 1) {
    return [...(rows[0]?.cells ?? [])];
  }
  return bottomHeadCells(
    rows.map((row) =>
      [...row.cells].map((cell) => ({
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
      })),
    ),
  ).map(
    (item) =>
      (item ? rows[item.row]?.cells[item.cell] : undefined) ??
      document.createElement("th"),
  );
}

/** 描いた直後に留める列（元の列の位置）。`data-pin` の列、無ければ行見出しの列（行見出しも無ければ先頭の列）を `initialPinnedColumns` で決める。`pin` の無い表は空 */
function initialPinned(options: {
  wrapper: HTMLElement;
  features: string[];
  originalRows: HTMLTableRowElement[];
  mode: TablePinMode;
}): number[] {
  const { wrapper, features, originalRows, mode } = options;
  if (!features.includes("pin")) {
    return [];
  }
  const pin = readColumnList(wrapper.dataset.pin);
  const rowHeadCount = [...(originalRows[0]?.cells ?? [])].findIndex(
    (cell) => !(cell.tagName === "TH" && cell.scope === "row"),
  );
  return initialPinnedColumns({
    pin,
    rowHeadCount,
    mode,
    unpin: readColumnList(wrapper.dataset.unpin),
  });
}

/** 表 1 つに、並べ替え・ピン止め・絞り込みを付け、削除する関数を返却する */
function attachTable(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  notifyColumns?: (hidden: string[]) => void,
  pinMode: TablePinMode = "each",
  longColumnMin: number = DEFAULT_LONG_COLUMN_MIN_EM,
): () => void {
  tableCounter += 1;
  const id = `mdmark-table-${tableCounter}`;
  // 横にスクロールさせる、表を包む要素（包まれていない表はその表）
  const scroller =
    table.parentElement?.classList.contains(SCROLL_CLASS) === true
      ? table.parentElement
      : table;
  const features = (wrapper.dataset.features ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const filterKinds = readFilterKinds(wrapper.dataset.filter);
  const headCells = columnHeadsOf(table);
  const headColumns = headColumnsOf(table);
  /** 見出しのセルの列の位置（`cellIndex` は多段の見出しで列と合わないため使用しない） */
  const columnOf = (cell: HTMLTableCellElement | null | undefined): number =>
    cell ? headCells.indexOf(cell) : -1;
  const mergeColumns = readColumnList(wrapper.dataset.mergeColumns);
  const tbody = table.tBodies[0];
  const originalRows = bodyRows(table);
  // 列を並べ替えてもセルの元の列の位置で参照できるよう、各セルに描いたときの列の位置を持たせる
  for (const row of originalRows) {
    [...row.cells].forEach((cell, column) => {
      cell.dataset.col = String(column);
    });
  }
  for (const [cell, column] of headColumns) {
    cell.dataset.col = String(column);
  }
  /** 行の元の列の位置のセル（並べ替えた後もセルの `data-col` で参照する） */
  const cellAt = (
    row: HTMLTableRowElement,
    column: number,
  ): HTMLTableCellElement | undefined =>
    row.querySelector<HTMLTableCellElement>(
      `:scope > [data-col="${column}"]`,
    ) ??
    row.cells[column] ??
    undefined;
  const originalHeads = headCells.map((cell) => cell.innerHTML);
  // 階層の表は、キーの列の絞り込み・開閉・行の選択を階層の操作に任せる
  const treeColumn =
    wrapper.dataset.tree === undefined
      ? undefined
      : Number(wrapper.dataset.tree);
  const tree =
    treeColumn === undefined
      ? undefined
      : attachTableTree({ wrapper, placement: "top" });
  /** 件数に数える本文の行（階層の表の補った行を除く） */
  const countedRows = originalRows.filter(
    (row) => !row.classList.contains("is-virtual"),
  );
  // 見出しのボタンを配置する前の列名（列の表示のメニューとコピーの見出しの行に使用する）
  const labels = headCells.map((cell) => visibleText(cell));
  const hiddenColumns = new Set(
    features.includes("columns") ? readColumnList(wrapper.dataset.hide) : [],
  );
  const totalSpecs = features.includes("total")
    ? readTotalSpecs(wrapper.dataset.total)
    : [];
  const shownCalcs = new Set<TotalCalc>(totalSpecs.map((total) => total.calc));
  const cleanups: Array<() => void> = [];
  /** 行の指定した列のセルの値（`data-value` があればその値） */
  const cellText = (row: HTMLTableRowElement, column: number): string => {
    const cell = cellAt(row, column);
    return cell ? cellValue(cell) : "";
  };
  // 結合する列のセルの、描いたときの結合（削除するときに戻す）
  const originalMerges = originalRows.flatMap((row) =>
    mergeColumns.flatMap((column) => {
      const cell = cellAt(row, column);
      return cell
        ? [
            {
              cell,
              rowSpan: cell.getAttribute("rowspan"),
              merged: cell.classList.contains("is-merged"),
              hidden: cell.hidden,
            },
          ]
        : [];
    }),
  );
  /** 表示している本文の行の並びで、結合する列の隣り合う同じ値をもう一度結合する。結合で隠したセルも値を持ったまま残す */
  function applyMerges(): void {
    if (mergeColumns.length === 0) {
      return;
    }
    const shownRows = bodyRows(table).filter((row) => !row.hidden);
    const spans = mergeSpans({
      values: shownRows.map((row) =>
        mergeColumns.map((column) => cellText(row, column)),
      ),
      columns: mergeColumns,
    });
    for (const row of originalRows) {
      for (const column of mergeColumns) {
        const cell = cellAt(row, column);
        cell?.removeAttribute("rowspan");
        cell?.classList.remove("is-merged");
      }
    }
    shownRows.forEach((row, position) => {
      mergeColumns.forEach((column, index) => {
        const cell = cellAt(row, column);
        const span = spans[position]?.[index] ?? 1;
        if (!cell) {
          return;
        }
        if (span > 1) {
          cell.rowSpan = span;
          cell.classList.add("is-merged");
        }
        cell.hidden = span === 0 || hiddenColumns.has(column);
      });
    });
  }
  applyMerges();

  // ─── 見出しのボタンとドロワー ───
  const drawers = new Map<number, HTMLElement>();
  const tools = features.some((feature) =>
    ["sort", "filter", "pin", "resize"].includes(feature),
  );
  if (tools) {
    headCells.forEach((cell, column) => {
      const kind = filterKinds.get(column);
      const parts = renderTableTools({
        id,
        column,
        label: visibleText(cell),
        features,
        pinMode,
        filter: kind && {
          kind,
          values: [
            ...new Set(originalRows.map((row) => cellText(row, column))),
          ],
        },
      });
      cell.innerHTML = parts.header;
      if (parts.drawer) {
        wrapper.insertAdjacentHTML("beforeend", parts.drawer);
      }
    });
    for (const drawer of ownElements<HTMLElement>(
      wrapper,
      ".mdmark-filter-drawer",
    )) {
      drawers.set(Number(drawer.dataset.column), drawer);
    }
  }
  // 絞り込み・並べ替えで列の幅が変わらないよう、描いたときの幅を最小の幅にする（本文の幅に広げる前の幅で測る）
  const width = table.style.width;
  table.style.width = "auto";
  for (const cell of headCells) {
    cell.style.setProperty(
      "--mdmark-column-min-width",
      `${cell.offsetWidth}px`,
    );
  }
  table.style.width = width;
  const empty = document.createElement("tr");
  empty.className = "mdmark-table-empty";
  empty.hidden = true;
  empty.innerHTML = `<td colspan="${headCells.length}">一致する行がありません</td>`;
  if (drawers.size > 0) {
    tbody?.append(empty);
  }

  // ─── 表の上の帯とテーブル設定のパネル ───
  // 今の列の順（元の列の位置の並び）。覚えず、再描画すると Markdown に記載した順に戻る
  let order = labels.map((_, column) => column);
  const groups = headCells.map((cell) => cell.dataset.group);
  const groupLabels: Record<string, string> = {};
  for (const [cell, column] of headColumns) {
    const row = (cell.parentElement as HTMLTableRowElement | null)
      ?.sectionRowIndex;
    const key = `${row}:${column}`;
    if (groups.includes(key)) {
      groupLabels[key] = visibleText(cell);
    }
  }
  const barParts = renderTableBar({
    id,
    features,
    labels,
    shown: originalRows.length,
    total: originalRows.length,
    hiddenColumns: [...hiddenColumns],
    totals: totalSpecs.map((total) => total.calc),
    order,
    groups,
    groupLabels,
    // 一覧を分けるのは `through` の表の `pin=` で留めた列だけ（既定の先頭の列の留めは、表がはみ出す間だけ該当する。`each` の表は分けない）
    pinned:
      pinMode === "through" && wrapper.dataset.pin !== undefined
        ? initialPinned({ wrapper, features, originalRows, mode: pinMode })
            .length
        : 0,
  });
  if (barParts.bar) {
    scroller.insertAdjacentHTML("beforebegin", barParts.bar);
    const bar = scroller.previousElementSibling;
    if (bar) {
      cleanups.push(() => bar.remove());
    }
  }
  if (barParts.menus) {
    const before = new Set(wrapper.children);
    scroller.insertAdjacentHTML("afterend", barParts.menus);
    const added = [...wrapper.children].filter((child) => !before.has(child));
    cleanups.push(() => {
      for (const menuElement of added) {
        menuElement.remove();
      }
    });
  }
  const menu = ownElement<HTMLElement>(wrapper, ".mdmark-table-settings");
  const totalsMenu = ownElement<HTMLElement>(wrapper, ".mdmark-totals-menu");
  const copyMenu = ownElement<HTMLElement>(wrapper, ".mdmark-copy-menu");
  /** 帯のスクリーンリーダー向けの要素に通知を入れる */
  const announce = (message: string): void => {
    const status = ownElement(wrapper, ".mdmark-table-status");
    if (status) {
      status.textContent = message;
    }
  };

  // ─── 並べ替え ───
  /** 見出しの並べ替えの向きを `aria-sort` に適用する */
  const setSortState = (
    cell: HTMLTableCellElement,
    direction: (typeof SORT_CYCLE)[number],
  ): void => {
    if (direction === "none") {
      cell.removeAttribute("aria-sort");
    } else {
      cell.setAttribute("aria-sort", direction);
    }
  };
  /** 列の値で行を並べ替える。向きを降順 → 昇順 → 元の並びの順に進める */
  const sortBy = (cell: HTMLTableCellElement): void => {
    const column = columnOf(cell);
    const current = (cell.getAttribute("aria-sort") ??
      "none") as (typeof SORT_CYCLE)[number];
    const direction =
      SORT_CYCLE[(SORT_CYCLE.indexOf(current) + 1) % SORT_CYCLE.length] ??
      "none";
    const rows = [...originalRows];
    if (direction !== "none") {
      const sign = direction === "ascending" ? 1 : -1;
      rows.sort(
        (a, b) => sign * compareCells(cellText(a, column), cellText(b, column)),
      );
    }
    // 行の詳細の行は、親の行に付けたまま動かす
    for (const row of rows) {
      tbody?.append(row, ...detailsOf(row));
    }
    if (drawers.size > 0) {
      tbody?.append(empty);
    }
    for (const other of headCells) {
      setSortState(other, other === cell ? direction : "none");
    }
    applyMerges();
  };

  // ─── 絞り込み ───
  /** ドロワーの入力から、適用している絞り込みを読み込む */
  const readFilterValue = (
    column: number,
    kind: FilterKind,
    drawer: HTMLElement,
  ): FilterValue => {
    if (kind === "select") {
      const values = [
        ...drawer.querySelectorAll<HTMLInputElement>(
          ".mdmark-filter-options input:checked",
        ),
      ].map((input) => input.value);
      return { column, values };
    }
    const inputs = [...drawer.querySelectorAll<HTMLInputElement>("input")];
    if (kind === "text") {
      return { column, text: inputs[0]?.value.trim() ?? "" };
    }
    return { column, from: inputs[0]?.value ?? "", to: inputs[1]?.value ?? "" };
  };
  /** 絞り込みを適用しているか */
  const isActive = (value: FilterValue): boolean =>
    Boolean(value.values?.length || value.text || value.from || value.to);
  /** 全ての列の絞り込みを当て、絞り込み中の列のボタンを示し、1 行も無ければ一致なしの行を出す */
  const applyFilters = (): void => {
    const values: Array<{ value: FilterValue; kind: FilterKind }> = [];
    for (const [column, drawer] of drawers) {
      const kind = filterKinds.get(column) ?? "select";
      const value = readFilterValue(column, kind, drawer);
      const active = isActive(value);
      const button = ownElement(wrapper, `[aria-controls="${drawer.id}"]`);
      button?.classList.toggle("is-active", active);
      const status = button?.querySelector(".mdmark-visually-hidden");
      if (status) {
        status.textContent = active ? "（絞り込み中）" : "";
      }
      if (active) {
        values.push({ value, kind });
      }
    }
    let shown = 0;
    if (tree) {
      // キーの列の文字の絞り込みは、末尾の名前で照合して祖先の行を残す
      const keyFilter = values.find(
        ({ value, kind }) => kind === "text" && value.column === treeColumn,
      );
      const others = values.filter((entry) => entry !== keyFilter);
      shown = tree.refresh({
        word: keyFilter?.value.text ?? "",
        matches: (row) =>
          others.every(({ value, kind }) =>
            matchesFilter(cellText(row, value.column), kind, value),
          ),
      });
      empty.hidden = shown > 0;
      applyMerges();
      updateSummary();
      return;
    }
    for (const row of originalRows) {
      const match = values.every(({ value, kind }) =>
        matchesFilter(cellText(row, value.column), kind, value),
      );
      row.hidden = !match;
      // 行の詳細の行は、親の行が隠れたら一緒に隠す。出すときは開閉の状態に戻す
      const toggle = row.querySelector(".mdmark-row-toggle");
      for (const detail of detailsOf(row)) {
        detail.hidden =
          !match ||
          (toggle !== null && toggle.getAttribute("aria-expanded") !== "true");
      }
      if (match) {
        shown += 1;
      }
    }
    empty.hidden = shown > 0;
    applyMerges();
    updateSummary();
  };
  /** 値の候補を、検索欄の文字を含むものだけにする */
  const narrowOptions = (drawer: HTMLElement, query: string): void => {
    const needle = query.trim().toLowerCase();
    let shown = 0;
    for (const item of drawer.querySelectorAll<HTMLElement>(
      ".mdmark-filter-options li",
    )) {
      const match = (item.textContent ?? "").toLowerCase().includes(needle);
      item.hidden = !match;
      if (match) {
        shown += 1;
      }
    }
    const none = drawer.querySelector<HTMLElement>(".mdmark-filter-none");
    if (none) {
      none.hidden = shown > 0;
    }
  };

  /** ドロワーの入力を全て空にして、候補の絞り込みも戻す */
  const clearDrawer = (drawer: HTMLElement): void => {
    for (const input of drawer.querySelectorAll<HTMLInputElement>("input")) {
      if (input.type === "checkbox") {
        input.checked = false;
      } else {
        input.value = "";
      }
    }
    narrowOptions(drawer, "");
  };
  /** この表の全ての列の絞り込みを解除する */
  const clearFilters = (): void => {
    for (const drawer of drawers.values()) {
      clearDrawer(drawer);
    }
    applyFilters();
  };

  // ─── ドロワーの開閉 ───
  let openState: { drawer: HTMLElement; button: HTMLElement } | undefined;
  /** ドロワーを押したボタンの下に配置し、画面の端からはみ出さないようにする */
  const placeDrawer = (drawer: HTMLElement, button: HTMLElement): void => {
    const rect = button.getBoundingClientRect();
    // 帯のメニューはボタンの左端に、絞り込みのドロワーはボタンの右端に合わせる
    const start =
      drawer.classList.contains("mdmark-table-settings") ||
      drawer.classList.contains("mdmark-table-menu")
        ? rect.left
        : rect.right - drawer.offsetWidth;
    const left = Math.min(
      Math.max(start, VIEWPORT_GUTTER),
      window.innerWidth - drawer.offsetWidth - VIEWPORT_GUTTER,
    );
    const below = rect.bottom + DRAWER_GAP;
    const top =
      below + drawer.offsetHeight > window.innerHeight - VIEWPORT_GUTTER
        ? Math.max(VIEWPORT_GUTTER, rect.top - drawer.offsetHeight - DRAWER_GAP)
        : below;
    drawer.style.left = `${left}px`;
    drawer.style.top = `${top}px`;
  };
  /** 開いている間だけ受け取る: ドロワーの外を押したら閉じる */
  const onPointerDown = (event: Event): void => {
    const target = event.target as Node;
    if (
      openState &&
      !openState.drawer.contains(target) &&
      !openState.button.contains(target)
    ) {
      closeDrawer(false);
    }
  };
  /** 開いている間だけ受け取る: Esc で閉じてボタンへフォーカスを戻す */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && openState) {
      closeDrawer(true);
    }
  };
  /** 開いている間だけ受け取る: ボタンに付いて動かし、ボタンが画面から出たら閉じる */
  const onScrollOrResize = (event: Event): void => {
    if (!openState) {
      return;
    }
    // ドロワーの中のスクロール（候補の並び）では動かさない
    if (
      event.target instanceof Node &&
      openState.drawer.contains(event.target)
    ) {
      return;
    }
    const rect = openState.button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      closeDrawer(false);
    } else {
      placeDrawer(openState.drawer, openState.button);
    }
  };
  /** ドロワーを閉じる。`returnFocus` が真なら、開いたボタンへフォーカスを戻す */
  function closeDrawer(returnFocus: boolean): void {
    if (!openState) {
      return;
    }
    const { drawer, button } = openState;
    openState = undefined;
    drawer.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize);
    if (returnFocus) {
      button.focus();
    }
  }
  /** ドロワーを開いてボタンの下に配置し、最初の入力欄へフォーカスを移す。ほかのドロワーは閉じる */
  const openDrawer = (drawer: HTMLElement, button: HTMLElement): void => {
    closeDrawer(false);
    drawer.hidden = false;
    button.setAttribute("aria-expanded", "true");
    placeDrawer(drawer, button);
    drawer
      .querySelector<HTMLElement>(
        ".mdmark-table-settings-grip:not(:disabled), .mdmark-table-settings-eye:not(:disabled), input:not(:disabled), .mdmark-copy-format",
      )
      ?.focus({ preventScroll: true });
    openState = { drawer, button };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
  };

  // ─── ピン止め ───
  // 留める列（元の列の位置）: 描いた直後は `initialPinned`、ボタンを押すと `togglePinnedColumn`。表がはみ出す間だけ適用する
  let pinned = initialPinned({
    wrapper,
    features,
    originalRows,
    mode: pinMode,
  });
  /** 表が横にはみ出しているか */
  const isOverflowing = (): boolean =>
    scroller.scrollWidth > scroller.clientWidth ||
    (scroller === table && table.scrollWidth > wrapper.clientWidth);
  /** 今の列の並びでの、列ごとの幅（`offsetWidth`。隠した列は 0）と留める列の位置 */
  let pinLayout: {
    /** 並びの位置ごとの元の列の位置 */
    order: number[];
    /** 並びの位置ごとの幅 */
    widths: number[];
    /** 並びの位置ごとの、それより左の列の幅の合計 */
    naturalLefts: number[];
    /** 留める列の並びの位置から左右の位置 */
    offsets: Map<number, { start: number; end: number }>;
  } = { order: [], widths: [], naturalLefts: [], offsets: new Map() };
  /** 左端に留まった最も右の列に `is-pinned-edge`、右端に留まった最も左の列に `is-pinned-edge-end` を付ける */
  const markPinnedEdges = (): void => {
    const { order: positions, widths, naturalLefts, offsets } = pinLayout;
    const viewStart = scroller.scrollLeft;
    const viewEnd = viewStart + scroller.clientWidth;
    let startEdge = -1;
    let endEdge = -1;
    for (const [position, offset] of offsets) {
      const left = naturalLefts[position] ?? 0;
      const width = widths[position] ?? 0;
      if (pinMode === "through") {
        startEdge = Math.max(startEdge, position);
        continue;
      }
      if (left < viewStart + offset.start + 1) {
        startEdge = Math.max(startEdge, position);
      }
      if (
        left + width > viewEnd - offset.end - 1 &&
        (endEdge < 0 || position < endEdge)
      ) {
        endEdge = position;
      }
    }
    const startColumn = startEdge >= 0 ? positions[startEdge] : undefined;
    const endColumn = endEdge >= 0 ? positions[endEdge] : undefined;
    for (const row of [...table.rows]) {
      for (const cell of row.cells) {
        const first = Number(cell.dataset.col);
        const last = first + (headColumns.has(cell) ? cell.colSpan : 1) - 1;
        const isPinned = cell.classList.contains("is-pinned-col");
        cell.classList.toggle(
          "is-pinned-edge",
          isPinned && startColumn !== undefined && last === startColumn,
        );
        cell.classList.toggle(
          "is-pinned-edge-end",
          isPinned && endColumn !== undefined && first === endColumn,
        );
      }
    }
  };
  /** 留める列を `columns` にし、表がはみ出す間だけ、留める列のセルを `left`（`each` は `right` も）で留める（空で削除する） */
  const pinColumns = (columns: number[]): void => {
    pinned = columns;
    const applied = new Set(isOverflowing() ? columns : []);
    // 今の列の並びで幅を測る（列の幅は見出しの列ごとのセル。隠した列は 0）
    const widths = order.map((column) => {
      const cell = headCells[column];
      return cell && !cell.hidden ? cell.offsetWidth : 0;
    });
    const naturalLefts: number[] = [];
    let left = 0;
    for (const width of widths) {
      naturalLefts.push(left);
      left += width;
    }
    const positionOf = new Map(
      order.map((column, position) => [column, position]),
    );
    const offsets = pinOffsets({
      widths,
      pinned: [...applied].map((column) => positionOf.get(column) ?? -1),
    });
    pinLayout = { order: [...order], widths, naturalLefts, offsets };
    for (const row of [...table.rows]) {
      // 行の詳細の行（1 つのセルが全ての列にまたがる）は留めない
      if (
        row.classList.contains("mdmark-row-detail") ||
        row.classList.contains("mdmark-table-empty")
      ) {
        continue;
      }
      for (const cell of row.cells) {
        // 見出しのセルは格子の列で数え、またぐ列が全て留める列のときだけ留める
        const first =
          cell.dataset.col === undefined
            ? cell.cellIndex
            : Number(cell.dataset.col);
        const span = headColumns.has(cell) ? cell.colSpan : 1;
        const covered = Array.from({ length: span }, (_, i) => first + i);
        const isPinned =
          applied.size > 0 && covered.every((column) => applied.has(column));
        cell.classList.toggle("is-pinned-col", isPinned);
        if (!isPinned) {
          cell.style.left = "";
          cell.style.right = "";
          continue;
        }
        const positions = covered.map((column) => positionOf.get(column) ?? 0);
        const startOffset = offsets.get(Math.min(...positions));
        const endOffset = offsets.get(Math.max(...positions));
        cell.style.left = `${startOffset?.start ?? 0}px`;
        cell.style.right = pinMode === "each" ? `${endOffset?.end ?? 0}px` : "";
      }
    }
    const last = Math.max(-1, ...columns);
    headCells.forEach((cell, column) => {
      cell
        .querySelector(".mdmark-pin")
        ?.setAttribute(
          "aria-pressed",
          String(
            pinMode === "each" ? columns.includes(column) : column === last,
          ),
        );
    });
    markPinnedEdges();
  };
  /** 表が横にはみ出すときだけピン止めのボタンを出す */
  const updatePinVisibility = (): void => {
    const overflow = isOverflowing();
    for (const pin of ownElements<HTMLElement>(wrapper, ".mdmark-pin")) {
      pin.hidden = !overflow;
    }
  };
  /** 行の詳細を持つ表に、表の見えている幅を変数で指定する（詳細の中身をその幅に収める） */
  const updateVisibleWidth = (): void => {
    if (ownElement(wrapper, ".mdmark-row-detail")) {
      table.style.setProperty(
        "--mdmark-table-visible-width",
        `${table.clientWidth}px`,
      );
    }
  };

  // ─── 件数と集計の行 ───
  // 数として読み込めないセルを持つ列と計算は、絞り込んでも集計のセルを空にする
  const unreadableTotals = findUnreadableTotals({
    rows: originalRows.map((row) =>
      labels.map((_, column) => cellText(row, column)),
    ),
    totals: totalSpecs,
  });
  /** 表の上の件数を、表示している行の数と全ての行の数に書き換える */
  const updateCount = (): void => {
    const [visible, spoken] = ownElements(wrapper, ".mdmark-table-count span");
    if (!visible || !spoken) {
      return;
    }
    const shown = countedRows.filter((row) => !row.hidden).length;
    visible.textContent = `${shown} / ${countedRows.length} 件`;
    spoken.textContent = `${countedRows.length} 件中 ${shown} 件を表示`;
  };
  /** 集計の行を、表示している行でもう一度計算して置き換える */
  const renderTotals = (): void => {
    if (totalSpecs.length === 0) {
      return;
    }
    table.tFoot?.remove();
    const shownRows = originalRows.filter((row) => !row.hidden);
    table.insertAdjacentHTML(
      "beforeend",
      renderTotalRows({
        columns: headCells.length,
        totals: totalSpecs.map((total) => ({
          ...total,
          value: unreadableTotals.some(
            (item) => item.column === total.column && item.calc === total.calc,
          )
            ? ""
            : computeTotal(
                shownRows.map((row) => cellText(row, total.column)),
                total.calc,
              ),
        })),
        shown: [...shownCalcs],
        hiddenColumns: [...hiddenColumns],
        labels,
      }),
    );
    // 列の配置は、本文のセルから写す
    for (const footRow of table.tFoot?.rows ?? []) {
      [...footRow.cells].forEach((cell, index) => {
        cell.dataset.col = String(index);
        const source = originalRows[0]
          ? cellAt(originalRows[0], index)
          : undefined;
        for (const name of source?.classList ?? []) {
          if (name.startsWith("mdmark-align-")) {
            cell.classList.add(name);
          }
        }
      });
      reorderRowCells(footRow, order);
    }
    if (pinned.length > 0) {
      pinColumns(pinned);
    }
  };
  /** 件数と集計の行を、表示している行に合わせる */
  const updateSummary = (): void => {
    updateCount();
    renderTotals();
  };
  cleanups.push(() => table.tFoot?.remove());

  /** 集計のメニューのチェックボックスに合わせて、計算の行を出す・隠す */
  const toggleTotal = (calc: TotalCalc, shown: boolean): void => {
    if (shown) {
      shownCalcs.add(calc);
    } else {
      shownCalcs.delete(calc);
    }
    for (const footRow of table.tFoot?.rows ?? []) {
      footRow.hidden = !shownCalcs.has(footRow.dataset.totalKind as TotalCalc);
    }
    const hiding = totalSpecs
      .map((total) => total.calc)
      .filter((value, index, all) => all.indexOf(value) === index)
      .filter((value) => !shownCalcs.has(value)).length;
    const toggle = ownElement(wrapper, ".mdmark-totals-toggle");
    toggle?.classList.toggle("is-active", hiding > 0);
    const spoken = toggle?.querySelector(".mdmark-visually-hidden");
    if (spoken) {
      spoken.textContent =
        hiding > 0 ? `（${hiding} 件を非表示にしています）` : "";
    }
    announce(
      `${TOTAL_LABELS[calc]}の行を${shown ? "出しました" : "隠しました"}`,
    );
  };

  // ─── 列の表示の切り替え ───
  /** 隠している列を見出し・セル・集計のセルに当て、メニューとボタンの状態を合わせる */
  const applyColumns = (): void => {
    const shownCount = headCells.length - hiddenColumns.size;
    for (const row of table.rows) {
      // 行の詳細の行と一致なしの行（1 つのセルが全ての列にまたがる）は、表示している列の数にまたがらせる
      if (
        row.classList.contains("mdmark-row-detail") ||
        row.classList.contains("mdmark-table-empty")
      ) {
        const cell = row.cells[0];
        if (cell) {
          cell.colSpan = shownCount;
        }
        continue;
      }
      [...row.cells].forEach((cell, index) => {
        const column =
          cell.dataset.col === undefined ? index : Number(cell.dataset.col);
        cell.hidden = hiddenColumns.has(column);
      });
    }
    applyMerges();
    for (const eye of menu?.querySelectorAll<HTMLButtonElement>(
      ".mdmark-table-settings-eye",
    ) ?? []) {
      const item = eye.closest<HTMLElement>(".mdmark-table-settings-item");
      const column = Number(item?.dataset.column);
      const hidden = hiddenColumns.has(column);
      eye.setAttribute("aria-pressed", String(hidden));
      eye.setAttribute(
        "aria-label",
        `「${item?.dataset.name ?? ""}」を${hidden ? "表示" : "隠す"}`,
      );
      eye.innerHTML = iconSvg(hidden ? "eye-off" : "eye");
      // Markdown に記載した先頭の列は隠せない
      eye.disabled = column === 0;
    }
    const toggle = ownElement<HTMLElement>(
      wrapper,
      ".mdmark-table-settings-toggle",
    );
    if (toggle) {
      updateSettingsToggle(toggle, hiddenColumns.size);
    }
    renderTotals();
    if (pinned.length > 0) {
      pinColumns(pinned);
    }
  };
  if (features.includes("columns")) {
    applyColumns();
    cleanups.push(() => {
      for (const row of table.rows) {
        const wide =
          row.classList.contains("mdmark-row-detail") ||
          row.classList.contains("mdmark-table-empty");
        for (const cell of row.cells) {
          cell.hidden = false;
        }
        if (wide && row.cells[0]) {
          row.cells[0].colSpan = headCells.length;
        }
      }
    });
  }
  updateSummary();

  // ─── 表のコピー ───
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  const copyButton = ownElement<HTMLElement>(wrapper, ".mdmark-copy");
  /** コピーのボタンに状態の文言とアイコンを適用する */
  const setCopyState = (state: CopyState): void => {
    if (copyButton) {
      copyButton.dataset.state = state;
      copyButton.innerHTML = renderCopyButtonContent(state);
      copyButton.title = COPY_STATES[state].label;
    }
  };
  /** 手でコピーさせるパネルを取り除く。`returnFocus` が真なら `表をコピー` へフォーカスを戻す */
  const closeCopyPanel = (returnFocus: boolean): void => {
    ownElement(wrapper, ".mdmark-copy-panel")?.remove();
    if (returnFocus) {
      copyButton?.focus();
    }
  };
  /** 見出しの行と、画面の並びで表示している行の、表示している列を選んだ形式でクリップボードへコピーし、結果をボタンとスクリーンリーダーで通知する。書き込めなければ手でコピーさせるパネルを出す */
  const copyTable = async (format: CopyFormat): Promise<void> => {
    clearTimeout(copyTimer);
    closeCopyPanel(false);
    const columns = order.filter((column) => !hiddenColumns.has(column));
    // 階層の表は、畳んで隠した行も含め、補った行を除き、キーの列を全体のパスで記載する
    const copied = (row: HTMLTableRowElement): boolean =>
      treeColumn === undefined
        ? !row.hidden
        : !row.classList.contains("is-virtual") &&
          (!row.hidden || row.hasAttribute(TREE_FOLDED_ATTRIBUTE));
    const copiedText = (row: HTMLTableRowElement, column: number): string =>
      column === treeColumn ? (row.dataset.path ?? "") : cellText(row, column);
    const rows = [
      columns.map((column) => labels[column] ?? ""),
      ...bodyRows(table)
        .filter(copied)
        .map((row) => columns.map((column) => copiedText(row, column))),
    ];
    const text =
      format === "markdown" ? tableToMarkdown(rows) : tableToTsv(rows);
    const name = COPY_FORMATS[format].name;
    if (await copyText(text)) {
      setCopyState("copied");
      announce(`${name}をコピーしました`);
      copyTimer = setTimeout(() => setCopyState("idle"), COPIED_NOTICE_MS);
      return;
    }
    // 書き込めなかったことはボタンで通知し、中身を選択したパネルで手でコピーさせる
    setCopyState("failed");
    wrapper
      .querySelector(".mdmark-table-bar")
      ?.insertAdjacentHTML(
        "afterend",
        renderCopyPanel({ id: `${id}-panel`, format, text }),
      );
    const textarea = ownElement<HTMLTextAreaElement>(
      wrapper,
      ".mdmark-copy-panel-text",
    );
    textarea?.focus();
    textarea?.select();
    announce(
      `クリップボードにコピーできませんでした。選択した${name}を手動でコピーできます`,
    );
  };
  cleanups.push(() => {
    clearTimeout(copyTimer);
    closeCopyPanel(false);
  });

  // ─── 行へのリンク ───
  /** 行を強調して画面に出す。閉じた表を開き、絞り込みで隠れていれば絞り込みを解除してから移り、その行だけを強調する */
  const revealTarget = (target: HTMLTableRowElement): void => {
    for (const row of originalRows) {
      if (row !== target) {
        row.removeAttribute("data-target");
      }
    }
    for (
      let details = target.closest("details");
      details;
      details = details.parentElement?.closest("details") ?? null
    ) {
      details.open = true;
    }
    if (target.hidden) {
      clearFilters();
    }
    target.setAttribute("data-target", "");
    target.scrollIntoView({ block: "center" });
  };
  /** URL の `#ID` がこの表の行を指すとき、その行へ移る。指さないときは強調を解除する */
  const revealRow = (): void => {
    const id = rowIdFromHash(location.hash);
    const target = id ? originalRows.find((row) => row.id === id) : undefined;
    if (target) {
      revealTarget(target);
      return;
    }
    for (const row of originalRows) {
      row.removeAttribute("data-target");
    }
  };
  const noticeTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  /** 行へのリンクのマーカーを押したとき、行へ移る動きはそのままに、行を指す絶対 URL をコピーして結果をマーカーの横に出す */
  const copyRowLink = async (anchor: HTMLAnchorElement): Promise<void> => {
    const row = anchor.closest("tr");
    if (row && originalRows.includes(row)) {
      revealTarget(row);
    }
    const notice = anchor.parentElement?.querySelector<HTMLElement>(
      ".mdmark-row-link-notice",
    );
    if (!notice) {
      return;
    }
    clearTimeout(noticeTimers.get(notice));
    const copied = await copyText(anchor.href);
    notice.dataset.state = copied ? "copied" : "failed";
    notice.innerHTML = copied
      ? `${iconSvg("check")}リンクをコピーしました`
      : `${iconSvg("circle-alert")}リンクをコピーできませんでした`;
    noticeTimers.set(
      notice,
      setTimeout(() => {
        notice.textContent = "";
        delete notice.dataset.state;
      }, COPIED_NOTICE_MS),
    );
  };
  if (features.includes("rowlink")) {
    window.addEventListener("hashchange", revealRow);
    cleanups.push(() => {
      window.removeEventListener("hashchange", revealRow);
      for (const timer of noticeTimers.values()) {
        clearTimeout(timer);
      }
      for (const row of originalRows) {
        row.removeAttribute("data-target");
      }
    });
  }

  // ─── 受け取り ───
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.closest(".mdmark-table") !== wrapper) {
      return;
    }
    const sort = target.closest<HTMLElement>(".mdmark-sort");
    const filter = target.closest<HTMLElement>(".mdmark-filter");
    const pin = target.closest<HTMLElement>(".mdmark-pin");
    const clear = target.closest<HTMLElement>(".mdmark-filter-clear");
    const columnsToggle = target.closest<HTMLElement>(
      ".mdmark-table-settings-toggle",
    );
    const eye = target.closest<HTMLButtonElement>(".mdmark-table-settings-eye");
    const copy = target.closest<HTMLElement>(".mdmark-copy");
    const copyFormat = target.closest<HTMLElement>(".mdmark-copy-format");
    const totalsToggle = target.closest<HTMLElement>(".mdmark-totals-toggle");
    const panelClose = target.closest<HTMLElement>(".mdmark-copy-panel-close");
    const rowAnchor = target.closest<HTMLAnchorElement>(".mdmark-row-anchor");
    const cell = target.closest<HTMLTableCellElement>("th");
    if (sort && cell) {
      sortBy(cell);
    } else if (filter) {
      const drawer = drawers.get(columnOf(filter.closest("th")));
      if (drawer) {
        if (drawer.hidden) {
          openDrawer(drawer, filter);
        } else {
          closeDrawer(false);
        }
      }
    } else if (pin && cell) {
      pinColumns(
        togglePinnedColumn({ pinned, column: columnOf(cell), mode: pinMode }),
      );
    } else if (clear) {
      const drawer = clear.closest<HTMLElement>(".mdmark-filter-drawer");
      if (drawer) {
        clearDrawer(drawer);
        applyFilters();
      }
    } else if (columnsToggle && menu) {
      if (menu.hidden) {
        openDrawer(menu, columnsToggle);
      } else {
        closeDrawer(false);
      }
    } else if (eye && !eye.disabled) {
      const column = Number(
        eye.closest<HTMLElement>(".mdmark-table-settings-item")?.dataset.column,
      );
      if (hiddenColumns.has(column)) {
        hiddenColumns.delete(column);
      } else {
        hiddenColumns.add(column);
      }
      applyColumns();
      notifyHidden();
      eye.focus();
    } else if (totalsToggle && totalsMenu) {
      toggleMenu(totalsMenu, totalsToggle);
    } else if (copy && copyMenu) {
      toggleMenu(copyMenu, copy);
    } else if (copyFormat) {
      closeDrawer(true);
      void copyTable(copyFormat.dataset.format === "tsv" ? "tsv" : "markdown");
    } else if (panelClose) {
      closeCopyPanel(true);
    } else if (rowAnchor) {
      void copyRowLink(rowAnchor);
    }
  };
  /** 帯のメニューを開く・閉じる */
  const toggleMenu = (menuElement: HTMLElement, button: HTMLElement): void => {
    if (menuElement.hidden) {
      openDrawer(menuElement, button);
    } else {
      closeDrawer(false);
    }
  };
  /** 手でコピーさせるパネルの中の Esc で、パネルを閉じる */
  const onPanelKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key === "Escape" &&
      event.target instanceof Element &&
      event.target.closest(".mdmark-table") === wrapper &&
      event.target.closest(".mdmark-copy-panel")
    ) {
      closeCopyPanel(true);
    }
  };
  /** 隠している列の見出しを列の順に並べて通知する */
  const notifyHidden = (): void => {
    notifyColumns?.(
      [...hiddenColumns]
        .sort((a, b) => a - b)
        .map((column) => labels[column] ?? ""),
    );
  };
  /** 集計のメニューのチェックボックスに合わせて計算の行を出す・隠す */
  const onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (input.closest(".mdmark-table") !== wrapper) {
      return;
    }
    if (input.closest(".mdmark-totals-options")) {
      toggleTotal(input.value as TotalCalc, input.checked);
    }
  };
  const onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const drawer = input.closest<HTMLElement>(".mdmark-filter-drawer");
    if (!drawer || input.closest(".mdmark-table") !== wrapper) {
      return;
    }
    if (input.classList.contains("mdmark-filter-search")) {
      narrowOptions(drawer, input.value);
    } else {
      applyFilters();
    }
  };
  if (features.includes("reorder")) {
    cleanups.push(
      attachTableSettings({
        wrapper,
        table,
        onReorder: (next) => {
          order = next;
          applyMerges();
          if (pinned.length > 0) {
            pinColumns(pinned);
          }
        },
      }),
    );
  }
  wrapper.addEventListener("click", onClick);
  wrapper.addEventListener("keydown", onPanelKeyDown);
  // 左端・右端に留まった列はスクロールの位置で変わるので、境の線を引き直す
  scroller.addEventListener("scroll", markPinnedEdges, { passive: true });
  wrapper.addEventListener("input", onInput);
  wrapper.addEventListener("change", onChange);
  const observer = new ResizeObserver(() => {
    updatePinVisibility();
    updateVisibleWidth();
    if (pinned.length > 0) {
      pinColumns(pinned);
    }
  });
  observer.observe(table);
  observer.observe(wrapper);
  // 列の幅を中身から決め、幅を入れた後に留める位置を決め直す
  const autoWidths = attachAutoColumnWidths(table, {
    wrapper,
    scroller,
    headCells,
    longColumnMin,
    onApply: () => {
      updatePinVisibility();
      if (pinned.length > 0) {
        pinColumns(pinned);
      }
    },
  });
  cleanups.push(autoWidths.detach);
  updatePinVisibility();
  if (pinned.length > 0) {
    pinColumns(pinned);
  }
  updateVisibleWidth();
  if (features.includes("resize")) {
    cleanups.push(
      attachColumnResize(table, {
        headCells,
        maxWidth: (column) =>
          columnWidthLimit({
            visibleWidth: scroller.clientWidth,
            overflowing: isOverflowing(),
            widths: headCells.map((cell) =>
              cell.hidden ? 0 : cell.offsetWidth,
            ),
            pinned,
            column,
          }),
        // 幅を変えた後と戻した後は、列の幅と留める位置と境の線を今の列の幅で決め直す
        onResize: () => {
          autoWidths.refresh();
          if (pinned.length > 0) {
            pinColumns(pinned);
          }
        },
      }),
    );
  }
  if (features.includes("rowlink")) {
    revealRow();
  }
  cleanups.push(() => {
    tree?.detach();
    closeDrawer(false);
    observer.disconnect();
    wrapper.removeEventListener("keydown", onPanelKeyDown);
    wrapper.removeEventListener("click", onClick);
    wrapper.removeEventListener("input", onInput);
    wrapper.removeEventListener("change", onChange);
    headCells.forEach((cell, index) => {
      cell.innerHTML = originalHeads[index] ?? "";
      cell.removeAttribute("aria-sort");
      cell.style.removeProperty("--mdmark-column-min-width");
    });
    for (const drawer of drawers.values()) {
      drawer.remove();
    }
    empty.remove();
    for (const row of originalRows) {
      row.hidden = false;
      tbody?.append(row, ...detailsOf(row));
    }
    pinColumns([]);
    scroller.removeEventListener("scroll", markPinnedEdges);
    table.style.removeProperty("--mdmark-table-visible-width");
    for (const { cell, rowSpan, merged, hidden } of originalMerges) {
      if (rowSpan === null) {
        cell.removeAttribute("rowspan");
      } else {
        cell.setAttribute("rowspan", rowSpan);
      }
      cell.classList.toggle("is-merged", merged);
      cell.hidden = hidden;
    }
  });
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/** 各 `mdmark-table` の `data-features`・`data-filter`・`data-pin` を読み込み、見出しにボタンとドロワーを配置して、並べ替え・ピン止め・絞り込みを付ける。`onColumnsChange` を指定したときは列の表示を切り替えるたびに通知する。ボタン・ドロワー・受け取り・`ResizeObserver` を削除する関数を返却する */
export function attachTables(
  root: HTMLElement,
  options: {
    /** 列の表示を切り替えたときに通知する */
    onColumnsChange?: ((event: MdmarkColumnsChange) => void) | undefined;
    /** ピン止めの動き（既定 `each`） */
    pinMode?: TablePinMode | undefined;
    /** 長文の列の最小の幅（em。既定 `DEFAULT_LONG_COLUMN_MIN_EM`） */
    longColumnMin?: number | undefined;
  } = {},
): () => void {
  const {
    onColumnsChange,
    pinMode = "each",
    longColumnMin = DEFAULT_LONG_COLUMN_MIN_EM,
  } = options;
  const detachers: Array<() => void> = [];
  // 列の表示を付けた表の、削除したブロックの中を除いた文書の順の位置
  let columnsIndex = 0;
  for (const wrapper of root.querySelectorAll<HTMLElement>(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    if (!table) {
      continue;
    }
    const counted =
      (wrapper.dataset.features ?? "").split(/\s+/).includes("columns") &&
      wrapper.closest('.mdmark-diff-block[data-kind="del"]') === null;
    const tableIndex = columnsIndex;
    if (counted) {
      columnsIndex += 1;
    }
    const notify =
      onColumnsChange && counted
        ? (hidden: string[]): void => {
            try {
              onColumnsChange({ tableIndex, hidden });
            } catch (error) {
              console.error(
                "[mdmark] 列の表示の通知が例外を投げました",
                "onColumnsChange",
                error,
              );
            }
          }
        : undefined;
    detachers.push(attachTable(wrapper, table, notify, pinMode, longColumnMin));
  }
  return () => {
    for (const detach of detachers) {
      detach();
    }
  };
}
