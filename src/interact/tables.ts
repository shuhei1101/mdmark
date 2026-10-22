import { iconSvg } from "../parts/icons.ts";
import {
  COPY_STATES,
  type CopyState,
  renderTableBar,
  renderTableTools,
  renderTotalRow,
  type TableTotal,
} from "../parts/table.ts";
import {
  compareCells,
  computeTotal,
  FILTER_KINDS,
  type FilterKind,
  type FilterValue,
  matchesFilter,
  rowIdFromHash,
  TOTAL_CALCS,
  type TotalCalc,
  tableToTsv,
} from "../table-logic.ts";
import { visibleText } from "./text.ts";

export { compareCells, type FilterValue, matchesFilter };

// 並べ替えの向きの順番（押すたびに次へ進み、最後の次は先頭へ戻る）
const SORT_CYCLE = ["none", "ascending", "descending"] as const;

// ドロワーとボタンの間の隙間と、画面の端に残す余白（px）
const DRAWER_GAP = 4;
const VIEWPORT_GUTTER = 16;

// コピーしたことの知らせをボタンに出しておく時間（ミリ秒）。できなかったことの知らせは次に押すまで残す
const COPIED_NOTICE_MS = 2000;

// 表の id を文書の中で重ならせないための通し番号
let tableCounter = 0;

/** 絞り込みを付ける列と種類を、`data-filter`（`0:select 2:date`）から読む */
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

/** `data-hide`（`1 3`）から隠す列の位置を読む */
function readColumnList(value: string | undefined): number[] {
  return (value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isInteger);
}

/** `data-total`（`2:sum 0:count`）から集計する列と計算を読む */
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

/** 行の直後に続く行の詳細の行を返す */
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

/** 表の本文の行（行の詳細の行と一致なしの行を除く）を返す */
function bodyRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return [...(table.tBodies[0]?.rows ?? [])].filter(
    (row) =>
      !row.classList.contains("mdmark-row-detail") &&
      !row.classList.contains("mdmark-table-empty"),
  );
}

/** 表 1 つに、並べ替え・ピン止め・絞り込みを付け、外す関数を返す */
function attachTable(
  wrapper: HTMLElement,
  table: HTMLTableElement,
): () => void {
  tableCounter += 1;
  const id = `mdmark-table-${tableCounter}`;
  const features = (wrapper.dataset.features ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const filterKinds = readFilterKinds(wrapper.dataset.filter);
  const headCells = [...(table.tHead?.rows[0]?.cells ?? [])];
  const tbody = table.tBodies[0];
  const originalRows = bodyRows(table);
  const originalHeads = headCells.map((cell) => cell.innerHTML);
  // 見出しのボタンを置く前の列名（列の表示のメニューとコピーの見出しの行に使う）
  const labels = headCells.map((cell) => visibleText(cell));
  const hiddenColumns = new Set(
    features.includes("columns") ? readColumnList(wrapper.dataset.hide) : [],
  );
  const totalSpecs = features.includes("total")
    ? readTotalSpecs(wrapper.dataset.total)
    : [];
  const cleanups: Array<() => void> = [];
  /** 行の指定した列のセルの文字 */
  const cellText = (row: HTMLTableRowElement, column: number): string => {
    const cell = row.cells[column];
    return cell ? visibleText(cell) : "";
  };

  // ─── 見出しのボタンとドロワー ───
  const drawers = new Map<number, HTMLElement>();
  const tools = features.some((feature) =>
    ["sort", "filter", "pin"].includes(feature),
  );
  if (tools) {
    headCells.forEach((cell, column) => {
      const kind = filterKinds.get(column);
      const parts = renderTableTools({
        id,
        column,
        label: visibleText(cell),
        features,
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
    for (const drawer of wrapper.querySelectorAll<HTMLElement>(
      ".mdmark-filter-drawer",
    )) {
      drawers.set(Number(drawer.dataset.column), drawer);
    }
  }
  // 絞り込み・並べ替えで列の幅が変わらないよう、描いたときの幅を最小の幅にする
  for (const cell of headCells) {
    cell.style.setProperty(
      "--mdmark-column-min-width",
      `${cell.offsetWidth}px`,
    );
  }
  const empty = document.createElement("tr");
  empty.className = "mdmark-table-empty";
  empty.hidden = true;
  empty.innerHTML = `<td colspan="${headCells.length}">一致する行がありません</td>`;
  if (drawers.size > 0) {
    tbody?.append(empty);
  }

  // ─── 表の上の帯と列の表示のメニュー ───
  const barParts = renderTableBar({
    id,
    features,
    labels,
    shown: originalRows.length,
    total: originalRows.length,
    hiddenColumns: [...hiddenColumns],
  });
  if (barParts.bar) {
    table.insertAdjacentHTML("beforebegin", barParts.bar);
    const bar = table.previousElementSibling;
    if (bar) {
      cleanups.push(() => bar.remove());
    }
  }
  if (barParts.menu) {
    table.insertAdjacentHTML("afterend", barParts.menu);
    const menuElement = table.nextElementSibling;
    if (menuElement) {
      cleanups.push(() => menuElement.remove());
    }
  }
  const menu = wrapper.querySelector<HTMLElement>(".mdmark-columns-menu");

  // ─── 並べ替え ───
  /** 見出しの並べ替えの向きを `aria-sort` に当てる */
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
  /** 列の値で行を並べ替える。向きを昇順 → 降順 → 元の並びの順に進める */
  const sortBy = (cell: HTMLTableCellElement): void => {
    const column = cell.cellIndex;
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
  };

  // ─── 絞り込み ───
  /** ドロワーの入力から、当てている絞り込みを読む */
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
  /** 絞り込みを当てているか */
  const isActive = (value: FilterValue): boolean =>
    Boolean(value.values?.length || value.text || value.from || value.to);
  /** 全ての列の絞り込みを当て、絞り込み中の列のボタンを示し、1 行も無ければ一致なしの行を出す */
  const applyFilters = (): void => {
    const values: Array<{ value: FilterValue; kind: FilterKind }> = [];
    for (const [column, drawer] of drawers) {
      const kind = filterKinds.get(column) ?? "select";
      const value = readFilterValue(column, kind, drawer);
      const active = isActive(value);
      const button = wrapper.querySelector(`[aria-controls="${drawer.id}"]`);
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
  /** この表の全ての列の絞り込みを外す */
  const clearFilters = (): void => {
    for (const drawer of drawers.values()) {
      clearDrawer(drawer);
    }
    applyFilters();
  };

  // ─── ドロワーの開閉 ───
  let openState: { drawer: HTMLElement; button: HTMLElement } | undefined;
  /** ドロワーを押したボタンの下に置き、画面の端からはみ出さないようにする */
  const placeDrawer = (drawer: HTMLElement, button: HTMLElement): void => {
    const rect = button.getBoundingClientRect();
    // 列の表示のメニューはボタンの左端に、絞り込みのドロワーはボタンの右端に揃える
    const start = drawer.classList.contains("mdmark-columns-menu")
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
  /** ドロワーを開いてボタンの下に置き、最初の入力欄へフォーカスを移す。ほかのドロワーは閉じる */
  const openDrawer = (drawer: HTMLElement, button: HTMLElement): void => {
    closeDrawer(false);
    drawer.hidden = false;
    button.setAttribute("aria-expanded", "true");
    placeDrawer(drawer, button);
    drawer
      .querySelector<HTMLInputElement>("input:not(:disabled)")
      ?.focus({ preventScroll: true });
    openState = { drawer, button };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
  };

  // ─── ピン止め ───
  let pinned = 0;
  /** 先頭から `count` 列までを表の左端に留める（0 で外す） */
  const pinColumns = (count: number): void => {
    pinned = count;
    // 留める列の左の位置: 前の列までの幅の合計
    const lefts: number[] = [];
    let left = 0;
    for (const cell of headCells) {
      lefts.push(left);
      left += cell.offsetWidth;
    }
    for (const row of [...table.rows]) {
      // 行の詳細の行（1 つのセルが全ての列にまたがる）は留めない
      if (
        row.classList.contains("mdmark-row-detail") ||
        row.classList.contains("mdmark-table-empty")
      ) {
        continue;
      }
      [...row.cells].forEach((cell, index) => {
        const isPinned = index < count;
        cell.classList.toggle("is-pinned-col", isPinned);
        cell.classList.toggle(
          "is-pinned-edge",
          isPinned && index === count - 1,
        );
        cell.style.left = isPinned ? `${lefts[index]}px` : "";
      });
    }
    headCells.forEach((cell, index) => {
      cell
        .querySelector(".mdmark-pin")
        ?.setAttribute("aria-pressed", String(index === count - 1));
    });
  };
  /** 表が横にはみ出すときだけピン止めのボタンを出す（留めている間は戻せるよう出したまま） */
  const updatePinVisibility = (): void => {
    const overflow =
      table.scrollWidth > table.clientWidth ||
      table.scrollWidth > wrapper.clientWidth ||
      pinned > 0;
    for (const pin of wrapper.querySelectorAll<HTMLElement>(".mdmark-pin")) {
      pin.hidden = !overflow;
    }
  };
  /** 行の詳細を持つ表に、表の見えている幅を変数で渡す（詳細の中身をその幅に収める） */
  const updateVisibleWidth = (): void => {
    if (table.querySelector(".mdmark-row-detail")) {
      table.style.setProperty(
        "--mdmark-table-visible-width",
        `${table.clientWidth}px`,
      );
    }
  };

  // ─── 件数と集計の行 ───
  /** 表の上の件数を、表示している行の数と全ての行の数に書き換える */
  const updateCount = (): void => {
    const [visible, spoken] = wrapper.querySelectorAll(
      ".mdmark-table-count span",
    );
    if (!visible || !spoken) {
      return;
    }
    const shown = originalRows.filter((row) => !row.hidden).length;
    visible.textContent = `${shown} / ${originalRows.length} 件`;
    spoken.textContent = `${originalRows.length} 件中 ${shown} 件を表示`;
  };
  /** 集計の行を、表示している行で計算し直して置き換える */
  const renderTotals = (): void => {
    if (totalSpecs.length === 0) {
      return;
    }
    table.tFoot?.remove();
    const shownRows = originalRows.filter((row) => !row.hidden);
    table.insertAdjacentHTML(
      "beforeend",
      renderTotalRow({
        columns: headCells.length,
        totals: totalSpecs.map((total) => ({
          ...total,
          value: computeTotal(
            shownRows.map((row) => cellText(row, total.column)),
            total.calc,
          ),
        })),
        hiddenColumns: [...hiddenColumns],
        labels,
      }),
    );
    // 列の揃えは、本文のセルから写す
    const cells = [...(table.tFoot?.rows[0]?.cells ?? [])];
    cells.forEach((cell, index) => {
      for (const name of originalRows[0]?.cells[index]?.classList ?? []) {
        if (name.startsWith("mdmark-align-")) {
          cell.classList.add(name);
        }
      }
    });
    if (pinned > 0) {
      pinColumns(pinned);
    }
  };
  /** 件数と集計の行を、表示している行に合わせる */
  const updateSummary = (): void => {
    updateCount();
    renderTotals();
  };
  cleanups.push(() => table.tFoot?.remove());

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
        cell.hidden = hiddenColumns.has(index);
      });
    }
    for (const input of menu?.querySelectorAll<HTMLInputElement>(
      ".mdmark-columns-options input",
    ) ?? []) {
      const column = Number(input.value);
      input.checked = !hiddenColumns.has(column);
      // 先頭の列は隠せない
      input.disabled = column === 0;
    }
    const toggle = wrapper.querySelector<HTMLElement>(".mdmark-columns-toggle");
    toggle?.classList.toggle("is-active", hiddenColumns.size > 0);
    const status = toggle?.querySelector(".mdmark-visually-hidden");
    if (status) {
      status.textContent =
        hiddenColumns.size > 0
          ? `（${hiddenColumns.size} 列を隠しています）`
          : "";
    }
    renderTotals();
    if (pinned > 0) {
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
  /** コピーのボタンに状態の文言とアイコンを当て、読み上げにも知らせる */
  const setCopyState = (state: CopyState): void => {
    const button = wrapper.querySelector<HTMLElement>(".mdmark-copy");
    if (!button) {
      return;
    }
    const { label, icon } = COPY_STATES[state];
    button.dataset.state = state;
    button.innerHTML = `${iconSvg(icon)}${label}`;
    const status = wrapper.querySelector(".mdmark-copy-status");
    if (status) {
      status.textContent = state === "idle" ? "" : label;
    }
  };
  /** 見出しの行と、画面の並びで表示している行の、表示している列をクリップボードへ写し、結果をボタンで知らせる */
  const copyTable = async (): Promise<void> => {
    clearTimeout(copyTimer);
    const columns = labels.flatMap((_, column) =>
      hiddenColumns.has(column) ? [] : [column],
    );
    const rows = [
      columns.map((column) => labels[column] ?? ""),
      ...bodyRows(table)
        .filter((row) => !row.hidden)
        .map((row) => columns.map((column) => cellText(row, column))),
    ];
    try {
      await navigator.clipboard.writeText(tableToTsv(rows));
      setCopyState("copied");
      copyTimer = setTimeout(() => setCopyState("idle"), COPIED_NOTICE_MS);
    } catch {
      // 拒まれたことはボタンで知らせ、例外は外へ出さない
      setCopyState("failed");
    }
  };
  cleanups.push(() => clearTimeout(copyTimer));

  // ─── 行へのリンク ───
  /** URL の `#ID` がこの表の行を指すとき、閉じた表を開き、絞り込みで隠れていれば外してから行へ移り、その行だけを強調する */
  const revealRow = (): void => {
    const id = rowIdFromHash(location.hash);
    const target = id ? originalRows.find((row) => row.id === id) : undefined;
    for (const row of originalRows) {
      if (row !== target) {
        row.removeAttribute("data-target");
      }
    }
    if (!target) {
      return;
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
  if (features.includes("rowlink")) {
    window.addEventListener("hashchange", revealRow);
    cleanups.push(() => {
      window.removeEventListener("hashchange", revealRow);
      for (const row of originalRows) {
        row.removeAttribute("data-target");
      }
    });
  }

  // ─── 受け取り ───
  const onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const sort = target.closest<HTMLElement>(".mdmark-sort");
    const filter = target.closest<HTMLElement>(".mdmark-filter");
    const pin = target.closest<HTMLElement>(".mdmark-pin");
    const clear = target.closest<HTMLElement>(".mdmark-filter-clear");
    const columnsToggle = target.closest<HTMLElement>(".mdmark-columns-toggle");
    const columnsReset = target.closest<HTMLElement>(".mdmark-columns-reset");
    const copy = target.closest<HTMLElement>(".mdmark-copy");
    const cell = target.closest<HTMLTableCellElement>("th");
    if (sort && cell) {
      sortBy(cell);
    } else if (filter) {
      const drawer = drawers.get(Number(filter.closest("th")?.cellIndex));
      if (drawer) {
        if (drawer.hidden) {
          openDrawer(drawer, filter);
        } else {
          closeDrawer(false);
        }
      }
    } else if (pin && cell) {
      pinColumns(
        pin.getAttribute("aria-pressed") === "true" ? 0 : cell.cellIndex + 1,
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
    } else if (columnsReset) {
      hiddenColumns.clear();
      for (const column of readColumnList(wrapper.dataset.hide)) {
        hiddenColumns.add(column);
      }
      applyColumns();
    } else if (copy) {
      void copyTable();
    }
  };
  /** 列の表示のメニューのチェックボックスに合わせて、列を隠す・出す */
  const onChange = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    if (!input.closest(".mdmark-columns-options")) {
      return;
    }
    const column = Number(input.value);
    if (input.checked) {
      hiddenColumns.delete(column);
    } else {
      hiddenColumns.add(column);
    }
    applyColumns();
  };
  const onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    const drawer = input.closest<HTMLElement>(".mdmark-filter-drawer");
    if (!drawer) {
      return;
    }
    if (input.classList.contains("mdmark-filter-search")) {
      narrowOptions(drawer, input.value);
    } else {
      applyFilters();
    }
  };
  wrapper.addEventListener("click", onClick);
  wrapper.addEventListener("input", onInput);
  wrapper.addEventListener("change", onChange);
  const observer = new ResizeObserver(() => {
    updatePinVisibility();
    updateVisibleWidth();
    if (pinned > 0) {
      pinColumns(pinned);
    }
  });
  observer.observe(table);
  observer.observe(wrapper);
  updatePinVisibility();
  updateVisibleWidth();
  if (features.includes("rowlink")) {
    revealRow();
  }
  cleanups.push(() => {
    closeDrawer(false);
    observer.disconnect();
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
    pinColumns(0);
    table.style.removeProperty("--mdmark-table-visible-width");
  });
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}

/** 各 `mdmark-table` の `data-features`・`data-filter` を読み、見出しにボタンとドロワーを置いて、並べ替え・ピン止め・絞り込みを付ける。ボタン・ドロワー・受け取り・`ResizeObserver` を外す関数を返す */
export function attachTables(root: HTMLElement): () => void {
  const detachers: Array<() => void> = [];
  for (const wrapper of root.querySelectorAll<HTMLElement>(".mdmark-table")) {
    const table = wrapper.querySelector("table");
    if (table) {
      detachers.push(attachTable(wrapper, table));
    }
  }
  return () => {
    for (const detach of detachers) {
      detach();
    }
  };
}
