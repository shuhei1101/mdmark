import { expect, test } from "vitest";

/** 表の列の幅を決めるモジュール（実装が無い間は各テストが個別に失敗する） */
const loadLayout = () => import("../../../../src/mdmark-style/table-layout.ts");

// 全角と半角を数える（正常系）
test("test_display_width", async () => {
  // 準備
  const { displayWidth } = await loadLayout();
  // 実行・検証
  expect(displayWidth("用語ab")).toBe(6);
});

// 空白で折り返す（正常系）
test("test_wrap_cell", async () => {
  // 準備
  const { wrapCell } = await loadLayout();
  // 実行・検証
  expect(wrapCell({ text: "read the config file", width: 10 })).toEqual([
    "read the",
    "config",
    "file",
  ]);
});

// 列の幅を超える単語だけ途中で切る（正常系）
test("test_wrap_cell_when_long_word", async () => {
  // 準備
  const { wrapCell } = await loadLayout();
  // 実行・検証
  expect(wrapCell({ text: "a mdmark.config.yaml", width: 8 })).toEqual([
    "a",
    "mdmark.c",
    "onfig.ya",
    "ml",
  ]);
});

// 全角の文字の間で折り返す（正常系）
test("test_wrap_cell_when_wide", async () => {
  // 準備
  const { wrapCell } = await loadLayout();
  // 実行・検証
  expect(wrapCell({ text: "用語を読み込む", width: 6 })).toEqual([
    "用語を",
    "読み込",
    "む",
  ]);
});

// 収まる表は中身の幅（正常系）
test("test_fit_columns", async () => {
  // 準備
  const { fitColumns } = await loadLayout();
  // 実行・検証
  expect(
    fitColumns({ cells: [["ab", "用語"]], columns: 80, wrap: true }),
  ).toEqual([2, 4]);
});

// 狭い幅では広い列から縮める（正常系）
test("test_fit_columns_when_narrow", async () => {
  // 準備
  const { fitColumns } = await loadLayout();
  const cells = [["a".repeat(10), Array(8).fill("word").join(" ")]];
  // 実行
  const widths = fitColumns({ cells, columns: 40, wrap: true });
  // 検証
  expect(widths[0]).toBe(10);
  expect((widths[0] ?? 0) + (widths[1] ?? 0) + 7).toBeLessThanOrEqual(40);
});

// 折り返さないときは中身の幅（正常系）
test("test_fit_columns_when_desktop", async () => {
  // 準備
  const { fitColumns } = await loadLayout();
  const cells = [["a".repeat(10), "b".repeat(40)]];
  // 実行・検証
  expect(fitColumns({ cells, columns: 40, wrap: false })).toEqual([10, 40]);
});
