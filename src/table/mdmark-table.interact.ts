import {
  cellText,
  type MdmarkTableColumn,
  type MdmarkTableRow,
  type MdmarkTableValue,
} from "./mdmark-table.logic.ts";
import { cellEditorLabel, renderCellEditor } from "./table.part.ts";

/** セルの編集のイベントの値 */
export type MdmarkTableCellEditDetail = {
  /** 行のキー */
  key: string;
  /** 列のキー */
  column: string;
  /** 編集する前の値 */
  oldValue: MdmarkTableValue;
  /** 確定した入力欄の文字列 */
  value: string;
};

/** 行とセルの操作の通知先 */
export type TableRowHandlers = {
  /** 行の押下 */
  onRowClick: (key: string) => void;
  /** セルの編集の確定。`false` を返却するとセルを前の値に戻す */
  onCellEdit: (detail: MdmarkTableCellEditDetail) => boolean;
  /** 行の追加 */
  onRowAdd: () => void;
  /** 編集を確定したセルをもう一度描く */
  renderCell: (cell: HTMLTableCellElement, key: string, column: number) => void;
  /** 編集する前の値 */
  valueOf: (key: string, column: number) => MdmarkTableValue;
};

/** 押しても行の押下にしない要素 */
const INTERACTIVE = "button, input, a, select, textarea, label";

/** 編集中のセル */
type Editing = {
  cell: HTMLTableCellElement;
  row: HTMLTableRowElement;
  column: number;
  before: string;
  input: HTMLInputElement;
};

/** 表示している本文の行 */
const shownRows = (wrapper: HTMLElement): HTMLTableRowElement[] =>
  [
    ...wrapper.querySelectorAll<HTMLTableRowElement>(
      "tbody tr.mdmark-row-pressable",
    ),
  ].filter((row) => !row.hidden);

/** `tabindex="0"` にする行を 1 つにする */
const setFocusRow = (
  wrapper: HTMLElement,
  target: HTMLTableRowElement,
): void => {
  for (const row of wrapper.querySelectorAll<HTMLTableRowElement>(
    "tbody tr.mdmark-row-pressable",
  )) {
    row.tabIndex = row === target ? 0 : -1;
  }
};

/** `tabindex="0"` の行が表示されていなければ、表示している最初の行へ移す */
const keepFocusRow = (wrapper: HTMLElement): void => {
  const rows = shownRows(wrapper);
  if (rows.some((row) => row.tabIndex === 0)) {
    return;
  }
  const first = rows[0];
  if (first) {
    setFocusRow(wrapper, first);
  }
};

/** セルの列の位置（行の子の順番） */
const columnOf = (cell: HTMLTableCellElement): number =>
  [...(cell.parentElement?.children ?? [])].indexOf(cell);

/** 最下段の見出しの列のキーと列名 */
const headOf = (
  wrapper: HTMLElement,
  column: number,
): { key: string; label: string } => {
  const head = wrapper.querySelectorAll<HTMLTableCellElement>(
    "thead tr:last-child th",
  )[column];
  const label =
    head?.querySelector(".mdmark-sort, .mdmark-th-label")?.textContent ??
    head?.textContent ??
    "";
  return { key: head?.dataset.columnKey ?? "", label: label.trim() };
};

/** 行とセルの操作を付け、受け取りを解除して編集中のセルを取り消す関数を返却する */
export const attachTableRows = (
  wrapper: HTMLElement,
  handlers: TableRowHandlers,
): (() => void) => {
  let editing: Editing | undefined;
  keepFocusRow(wrapper);

  /** 編集中のセルを記録した中身に戻す */
  const restore = (): void => {
    if (!editing) {
      return;
    }
    const current = editing;
    editing = undefined;
    current.cell.classList.remove("mdmark-cell-editing");
    current.cell.innerHTML = current.before;
  };

  /** 編集を確定する。値が変わっていれば通知し、拒まれたら戻す */
  const commit = (focusRow: boolean): void => {
    if (!editing) {
      return;
    }
    const current = editing;
    const key = current.row.dataset.key ?? "";
    const oldValue = handlers.valueOf(key, current.column);
    const value = current.input.value;
    if (value === cellText(oldValue)) {
      restore();
    } else {
      const accepted = handlers.onCellEdit({
        key,
        column: headOf(wrapper, current.column).key,
        oldValue,
        value,
      });
      if (accepted) {
        editing = undefined;
        current.cell.classList.remove("mdmark-cell-editing");
        current.cell.dataset.value = value;
        current.cell.textContent = value;
        handlers.renderCell(current.cell, key, current.column);
      } else {
        restore();
      }
    }
    if (focusRow) {
      current.row.focus();
    }
  };

  /** セルの編集を始める */
  const startEdit = (cell: HTMLTableCellElement): void => {
    const row = cell.parentElement;
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    if (editing?.cell === cell) {
      return;
    }
    commit(false);
    const column = columnOf(cell);
    const key = row.dataset.key ?? "";
    const rows = shownRows(wrapper);
    const before = cell.innerHTML;
    cell.classList.add("mdmark-cell-editing");
    cell.innerHTML = renderCellEditor({
      value: cellText(handlers.valueOf(key, column)),
      label: cellEditorLabel(
        headOf(wrapper, column).label,
        rows.indexOf(row) + 1,
      ),
      hintId: `mdmark-cell-hint-${key}-${column}`,
    });
    const input = cell.querySelector<HTMLInputElement>("input");
    if (!input) {
      return;
    }
    editing = { cell, row, column, before, input };
    setFocusRow(wrapper, row);
    input.focus();
    input.select();
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.closest(".mdmark-table-add-button")) {
      handlers.onRowAdd();
      return;
    }
    if (target.closest(INTERACTIVE)) {
      return;
    }
    const cell = target.closest<HTMLTableCellElement>("tbody td, tbody th");
    const row = cell?.closest<HTMLTableRowElement>("tr.mdmark-row-pressable");
    if (!cell || !row) {
      return;
    }
    if (cell.classList.contains("mdmark-cell-editable")) {
      startEdit(cell);
      return;
    }
    commit(false);
    setFocusRow(wrapper, row);
    handlers.onRowClick(row.dataset.key ?? "");
  };

  /** 入力欄のキー */
  const onInputKey = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      const row = editing?.row;
      restore();
      row?.focus();
    }
    event.stopPropagation();
  };

  /** 行のキー */
  const onRowKey = (event: KeyboardEvent, row: HTMLTableRowElement): void => {
    const rows = shownRows(wrapper);
    const position = rows.indexOf(row);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const next = rows[position + (event.key === "ArrowDown" ? 1 : -1)];
      event.preventDefault();
      if (next) {
        setFocusRow(wrapper, next);
        next.focus();
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      handlers.onRowClick(row.dataset.key ?? "");
    } else if (event.key === "F2") {
      event.preventDefault();
      const cell = row.querySelector<HTMLTableCellElement>(
        "td.mdmark-cell-editable, th.mdmark-cell-editable",
      );
      if (cell) {
        startEdit(cell);
      }
    }
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (editing && target === editing.input) {
      onInputKey(event);
      return;
    }
    if (
      target instanceof HTMLTableRowElement &&
      target.matches(".mdmark-row-pressable")
    ) {
      onRowKey(event, target);
    }
  };

  const onFocusout = (event: FocusEvent): void => {
    if (!editing || event.target !== editing.input) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && editing.cell.contains(next)) {
      return;
    }
    commit(false);
  };

  const onFocusin = (event: FocusEvent): void => {
    if (
      editing &&
      event.target instanceof Node &&
      !editing.cell.contains(event.target)
    ) {
      commit(false);
    }
  };

  const tbody = wrapper.querySelector("tbody");
  const observer = new MutationObserver(() => keepFocusRow(wrapper));
  if (tbody) {
    observer.observe(tbody, {
      attributes: true,
      attributeFilter: ["hidden"],
      subtree: true,
      childList: true,
    });
  }
  wrapper.addEventListener("click", onClick);
  wrapper.addEventListener("keydown", onKeydown);
  wrapper.addEventListener("focusout", onFocusout);
  wrapper.addEventListener("focusin", onFocusin);
  return () => {
    observer.disconnect();
    wrapper.removeEventListener("click", onClick);
    wrapper.removeEventListener("keydown", onKeydown);
    wrapper.removeEventListener("focusout", onFocusout);
    wrapper.removeEventListener("focusin", onFocusin);
    restore();
  };
};

/** セル 1 つの中身を `render(value, row)` の返却値に置き換える（例外のときは値を文字で出す） */
export const renderCellContent = (options: {
  cell: HTMLTableCellElement;
  column: MdmarkTableColumn;
  row: MdmarkTableRow;
  value: MdmarkTableValue;
}): void => {
  const { cell, column, row, value } = options;
  const text = cellText(value);
  cell.dataset.value = text;
  if (!column.render) {
    return;
  }
  try {
    const content = column.render(value, row);
    if (content instanceof Node) {
      cell.replaceChildren(content);
    } else if (typeof content === "string") {
      cell.textContent = content;
    } else {
      cell.textContent = text;
      console.error(
        "[mdmark] セルの中身の描き方が Node か文字列でない値を返却しました",
        content,
      );
    }
  } catch (error) {
    cell.textContent = text;
    console.error("[mdmark] セルの中身の描き方が例外を投げました", error);
  }
};

/** `render` を持つ列のセルに `data-value` を付け、中身を `render(value, row)` の返却値に置き換える */
export const applyCellRenderers = (
  wrapper: HTMLElement,
  spec: { columns: MdmarkTableColumn[]; rows: MdmarkTableRow[] },
): void => {
  const rowOf = new Map(spec.rows.map((row) => [row.key, row]));
  for (const tr of wrapper.querySelectorAll<HTMLTableRowElement>(
    "tbody tr[data-key]",
  )) {
    const row = rowOf.get(tr.dataset.key ?? "");
    if (!row) {
      continue;
    }
    for (const [index, column] of spec.columns.entries()) {
      const cell = tr.children[index];
      if (column.render && cell instanceof HTMLTableCellElement) {
        renderCellContent({
          cell,
          column,
          row,
          value: row.values[column.key] ?? null,
        });
      }
    }
  }
};
