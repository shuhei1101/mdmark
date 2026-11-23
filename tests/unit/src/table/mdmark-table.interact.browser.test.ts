import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 表のカスタム要素の行とセルの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRows = () => import("../../../../src/table/mdmark-table.interact.ts");
/** 表の部品を読み込む */
const loadPart = () => import("../../../../src/table/table.part.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** 3 行の表（担当の列を編集できる・行追加のボタンを持つ）を描いた要素と、その中の表の囲み */
async function createTable(): Promise<{
  root: HTMLElement;
  wrapper: HTMLElement;
}> {
  const { renderTable } = await loadPart();
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    columns: ["タイトル", "状態", "担当"],
    rows: [
      ["設計", "未着手", "佐藤"],
      ["列の幅", "進行中", "鈴木"],
      ["ピン止め", "完了", "佐藤"],
    ],
    columnKeys: ["title", "state", "owner"],
    rowKeys: ["R1", "R2", "R3"],
    pressable: true,
    editable: [2],
    addRow: true,
  });
  const root = createRootFromHtml(html);
  const wrapper = root.querySelector<HTMLElement>(".mdmark-table");
  if (!wrapper) {
    throw new Error("表の囲みがありません");
  }
  return { root, wrapper };
}

/** 本文の行 */
function bodyRows(root: HTMLElement): HTMLTableRowElement[] {
  return [
    ...root.querySelectorAll<HTMLTableRowElement>(
      "tbody tr:not(.mdmark-table-empty)",
    ),
  ];
}

/** 本文の行の指定した列のセル */
function cellAt(root: HTMLElement, row: number, column: number): HTMLElement {
  const cell = bodyRows(root)[row]?.children[column];
  if (!(cell instanceof HTMLElement)) {
    throw new Error("セルがありません");
  }
  return cell;
}

/** 行の値（行のキーと列の位置から、編集する前の値を返却する） */
const values: Record<string, Array<string | number | null>> = {
  R1: ["設計", "未着手", "佐藤"],
  R2: ["列の幅", "進行中", "鈴木"],
  R3: ["ピン止め", "完了", "佐藤"],
};

/** 呼ばれた引数を記録する通知先 */
function createHandlers(options: { editResult?: boolean } = {}) {
  return {
    onRowClick: vi.fn<(key: string) => void>(),
    onCellEdit: vi.fn(() => options.editResult ?? true),
    onRowAdd: vi.fn<() => void>(),
    renderCell: vi.fn(),
    valueOf: (key: string, column: number) => values[key]?.[column] ?? null,
  };
}

/** キーを押す */
function press(target: Element, key: string): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

// 編集できない列のセルを押すと行のキーで通知し、ボタンでは通知しない（正常系）
test("test_attach_table_rows_when_row_clicked", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  detachers.push(attachTableRows(wrapper, handlers));
  // 実行
  cellAt(root, 1, 0).click();
  root.querySelector<HTMLButtonElement>("thead button")?.click();
  // 検証
  expect(handlers.onRowClick).toHaveBeenCalledTimes(1);
  expect(handlers.onRowClick).toHaveBeenCalledWith("R2");
  expect(bodyRows(root)[1]?.tabIndex).toBe(0);
});

// ↑↓ で行を移し、Enter で通知する（正常系）
test("test_attach_table_rows_when_keyboard", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  detachers.push(attachTableRows(wrapper, handlers));
  bodyRows(root)[0]?.focus();
  // 実行
  press(document.activeElement ?? root, "ArrowDown");
  press(document.activeElement ?? root, "ArrowDown");
  press(document.activeElement ?? root, "ArrowUp");
  press(document.activeElement ?? root, "Enter");
  // 検証
  expect(document.activeElement).toBe(bodyRows(root)[1]);
  expect(bodyRows(root).filter((row) => row.tabIndex === 0)).toHaveLength(1);
  expect(handlers.onRowClick).toHaveBeenCalledWith("R2");
});

// tabindex=0 の行が隠れると表示している最初の行へ移す（正常系）
test("test_attach_table_rows_when_hidden_by_filter", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  detachers.push(attachTableRows(wrapper, createHandlers()));
  // 実行
  const first = bodyRows(root)[0];
  if (first) {
    first.hidden = true;
  }
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // 検証
  expect(bodyRows(root)[1]?.tabIndex).toBe(0);
});

// 編集して Enter で確定すると通知し、セルを変更後の値にする（正常系）
test("test_attach_table_rows_when_cell_edited", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  detachers.push(attachTableRows(wrapper, handlers));
  // 実行
  cellAt(root, 1, 2).click();
  const input = cellAt(root, 1, 2).querySelector<HTMLInputElement>("input");
  if (input) {
    input.value = "田中";
    press(input, "Enter");
  }
  // 検証
  expect(input?.parentElement).not.toBeNull();
  expect(handlers.onCellEdit).toHaveBeenCalledTimes(1);
  expect(handlers.onCellEdit).toHaveBeenCalledWith({
    key: "R2",
    column: "owner",
    oldValue: "鈴木",
    value: "田中",
  });
  expect(cellAt(root, 1, 2).dataset.value).toBe("田中");
  expect(cellAt(root, 1, 2).textContent).toBe("田中");
  expect(handlers.renderCell).toHaveBeenCalledTimes(1);
  expect(handlers.onRowClick).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(bodyRows(root)[1]);
});

// Esc と値を変えない確定は通知しない（正常系）
test("test_attach_table_rows_when_edit_cancelled", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  detachers.push(attachTableRows(wrapper, handlers));
  const before = cellAt(root, 2, 2).innerHTML;
  // 実行
  bodyRows(root)[2]?.focus();
  press(bodyRows(root)[2] ?? root, "F2");
  const first = cellAt(root, 2, 2).querySelector<HTMLInputElement>("input");
  if (first) {
    first.value = "田中";
    press(first, "Escape");
  }
  cellAt(root, 2, 2).click();
  const second = cellAt(root, 2, 2).querySelector<HTMLInputElement>("input");
  if (second) {
    press(second, "Enter");
  }
  // 検証
  expect(first).not.toBeNull();
  expect(handlers.onCellEdit).not.toHaveBeenCalled();
  expect(cellAt(root, 2, 2).innerHTML).toBe(before);
});

// 通知先が false を返却すると前の値に戻す（正常系）
test("test_attach_table_rows_when_edit_rejected", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers({ editResult: false });
  detachers.push(attachTableRows(wrapper, handlers));
  const before = cellAt(root, 1, 2).innerHTML;
  // 実行
  cellAt(root, 1, 2).click();
  const input = cellAt(root, 1, 2).querySelector<HTMLInputElement>("input");
  if (input) {
    input.value = "田中";
    input.blur();
    cellAt(root, 0, 0).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  }
  // 検証
  expect(handlers.onCellEdit).toHaveBeenCalledTimes(1);
  expect(cellAt(root, 1, 2).innerHTML).toBe(before);
});

// 行追加 のボタンで通知する（正常系）
test("test_attach_table_rows_when_row_added", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  detachers.push(attachTableRows(wrapper, handlers));
  // 実行
  root.querySelector<HTMLButtonElement>(".mdmark-table-add-button")?.click();
  // 検証
  expect(handlers.onRowAdd).toHaveBeenCalledTimes(1);
});

// 解除した後は通知せず、編集中のセルを戻す（正常系）
test("test_attach_table_rows_when_detached", async () => {
  // 準備
  const { attachTableRows } = await loadRows();
  const { root, wrapper } = await createTable();
  const handlers = createHandlers();
  const detach = attachTableRows(wrapper, handlers);
  const before = cellAt(root, 1, 2).innerHTML;
  // 実行
  cellAt(root, 1, 2).click();
  detach();
  cellAt(root, 0, 0).click();
  // 検証
  expect(handlers.onRowClick).not.toHaveBeenCalled();
  expect(handlers.onCellEdit).not.toHaveBeenCalled();
  expect(cellAt(root, 1, 2).innerHTML).toBe(before);
});

// 返却した要素を配置し、data-value に値を持たせる（正常系）
test("test_apply_cell_renderers", async () => {
  // 準備
  const { applyCellRenderers } = await loadRows();
  const { root, wrapper } = await createTable();
  const render = vi.fn((value: string | number | null) => {
    const badge = document.createElement("span");
    badge.className = "app-badge";
    badge.textContent = String(value);
    return badge;
  });
  const spec = {
    columns: [
      { key: "title", title: "タイトル" },
      { key: "state", title: "状態", render },
      { key: "owner", title: "担当" },
    ],
    rows: Object.entries(values).map(([key, row]) => ({
      key,
      values: { title: row[0] ?? null, state: row[1] ?? null, owner: row[2] ?? null },
    })),
  };
  // 実行
  applyCellRenderers(wrapper, spec);
  // 検証
  expect(cellAt(root, 0, 1).querySelector("span.app-badge")?.textContent).toBe(
    "未着手",
  );
  expect(cellAt(root, 0, 1).dataset.value).toBe("未着手");
  expect(render).toHaveBeenCalledWith("未着手", spec.rows[0]);
});

// 例外を投げると値を文字で出す（異常系）
test("test_apply_cell_renderers_when_render_throws", async () => {
  // 準備
  const { applyCellRenderers } = await loadRows();
  const { root, wrapper } = await createTable();
  const failure = new Error("描けません");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const spec = {
    columns: [
      { key: "title", title: "タイトル" },
      {
        key: "state",
        title: "状態",
        render: () => {
          throw failure;
        },
      },
      { key: "owner", title: "担当" },
    ],
    rows: [{ key: "R1", values: { title: "設計", state: "未着手", owner: "佐藤" } }],
  };
  // 実行
  applyCellRenderers(wrapper, spec);
  errorSpy.mockRestore();
  // 検証
  expect(cellAt(root, 0, 1).textContent).toBe("未着手");
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy.mock.calls[0]).toContain(failure);
});
