import { afterEach, expect, test, vi } from "vitest";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 表の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTables = () => import("../../../../src/interact/tables.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** `+reorder +columns` の 4 列 3 行の表（列 `名前`・`型`・`既定`・`説明`） */
const REORDER_TABLE = [
  "<!-- table: data +reorder +columns -->",
  "",
  "| 名前 | 型 | 既定 | 説明 |",
  "| --- | --- | --- | --- |",
  "| table | bool | true | 表の機能 |",
  "| html | bool | true | 埋め込んだ HTML の機能 |",
  "| aliases | list | | 別名の行 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 2 段の見出しで `設定` が 3 列にまたがり、名前をピン止めした表 */
const GROUPED_TABLE = [
  "<!-- table: data +reorder header-rows=2 pin=名前 -->",
  "",
  "| 名前 | 設定 | << | << | 備考 |",
  "| --- | --- | --- | --- | --- |",
  "| ^^ | 型 | 既定 | 必須 | ^^ |",
  "| table | bool | true | ✓ | 表 |",
  "| html | bool | true | | HTML |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** 表を描いて操作を付け、テーブル設定のパネルを開いて返す */
async function openSettings(markdown: string, onColumnsChange?: () => void) {
  addStyles();
  const { attachTables } = await loadTables();
  const { root } = createRoot(markdown);
  detachers.push(
    attachTables(root, onColumnsChange ? { onColumnsChange } : undefined),
  );
  const toggle = root.querySelector<HTMLButtonElement>(
    "button.mdmark-table-settings-toggle",
  );
  if (!toggle) {
    throw new Error("テーブル設定のボタンが無い");
  }
  toggle.click();
  return { root, toggle };
}

/** 見出しの最下段の行と、本文の各行の、セルの `data-col` を並んだ順に返す */
function rowOrders(root: HTMLElement): string[][] {
  const head = [...root.querySelectorAll<HTMLTableRowElement>("thead tr")].at(
    -1,
  );
  const body = [
    ...root.querySelectorAll<HTMLTableRowElement>(
      "tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
    ),
  ];
  return [head, ...body].map((row) =>
    [...(row?.cells ?? [])].map((cell) => cell.dataset.col ?? ""),
  );
}

/** パネルの一覧の項目を、並んだ順に返す */
function items(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(".mdmark-table-settings-item"),
  ];
}

/** 列名の項目のつまみを返す */
function gripOf(root: HTMLElement, name: string): HTMLButtonElement {
  const grip = items(root)
    .find((item) => item.dataset.name === name)
    ?.querySelector<HTMLButtonElement>(".mdmark-table-settings-grip");
  if (!grip) {
    throw new Error(`つまみが無い: ${name}`);
  }
  return grip;
}

/** 列名の項目の上半分の位置で、ドラッグの受け取りを送る */
function dropOn(options: {
  root: HTMLElement;
  from: string;
  to: string;
  side: "before" | "after";
}): void {
  const target = items(options.root).find(
    (item) => item.dataset.name === options.to,
  );
  if (!target) {
    throw new Error(`項目が無い: ${options.to}`);
  }
  const rect = target.getBoundingClientRect();
  const clientY = options.side === "before" ? rect.top + 1 : rect.bottom - 1;
  const dataTransfer = new DataTransfer();
  gripOf(options.root, options.from).dispatchEvent(
    new DragEvent("dragstart", { bubbles: true, dataTransfer }),
  );
  for (const type of ["dragenter", "dragover", "drop"]) {
    target.dispatchEvent(
      new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + 4,
        clientY,
      }),
    );
  }
  gripOf(options.root, options.from).dispatchEvent(
    new DragEvent("dragend", { bubbles: true, dataTransfer }),
  );
}

// ドラッグ＆ドロップで列を動かし、全ての行のセルを並べ直す（正常系）
test("test_attach_table_settings_when_dragged", async () => {
  // 準備
  const { root } = await openSettings(REORDER_TABLE);
  // 実行: 説明のつまみを名前の上へ動かす
  dropOn({ root, from: "説明", to: "名前", side: "before" });
  // 検証
  for (const order of rowOrders(root)) {
    expect(order).toEqual(["3", "0", "1", "2"]);
  }
  expect(items(root).map((item) => item.dataset.column)).toEqual([
    "3",
    "0",
    "1",
    "2",
  ]);
});

// つまみの ↓ キーで 1 つ動かし、フォーカスを残す（正常系）
test("test_attach_table_settings_when_arrow_key", async () => {
  // 準備
  const { root } = await openSettings(REORDER_TABLE);
  const grip = gripOf(root, "型");
  grip.focus();
  // 実行
  grip.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  // 検証
  for (const order of rowOrders(root)) {
    expect(order).toEqual(["0", "2", "1", "3"]);
  }
  expect(document.activeElement).toBe(gripOf(root, "型"));
});

// 結合した見出しの範囲の外とピン止めの境には動かさず、動かせないつまみを `disabled` にする（正常系）
test("test_attach_table_settings_when_group_boundary", async () => {
  // 準備
  const { root } = await openSettings(GROUPED_TABLE);
  const before = rowOrders(root);
  // 実行: 型を備考の下へ動かす
  dropOn({ root, from: "型", to: "備考", side: "after" });
  // 検証
  expect(rowOrders(root)).toEqual(before);
  expect(gripOf(root, "名前").disabled).toBe(true);
  expect(gripOf(root, "備考").disabled).toBe(true);
  expect(gripOf(root, "型").disabled).toBe(false);
});

// 目のアイコンで列を隠し、バッジと読み上げの名前を書き換えて知らせる（正常系）
test("test_attach_table_settings_when_hidden", async () => {
  // 準備
  const onColumnsChange = vi.fn();
  const { root, toggle } = await openSettings(REORDER_TABLE, onColumnsChange);
  const eye = items(root)
    .find((item) => item.dataset.name === "説明")
    ?.querySelector<HTMLButtonElement>(".mdmark-table-settings-eye");
  // 実行
  eye?.click();
  // 検証
  const cells = [
    ...root.querySelectorAll<HTMLElement>("thead th, tbody td"),
  ].filter((cell) => cell.dataset.col === "3");
  expect(cells).toHaveLength(4);
  for (const cell of cells) {
    expect(cell.hasAttribute("hidden")).toBe(true);
  }
  expect(toggle.querySelector(".mdmark-table-tool-badge")?.textContent).toBe(
    "1",
  );
  expect(toggle.getAttribute("aria-label")).toBe("テーブル設定（1 列を非表示）");
  expect(onColumnsChange).toHaveBeenCalledTimes(1);
  expect(onColumnsChange).toHaveBeenCalledWith({
    tableIndex: 0,
    hidden: ["説明"],
  });
});
