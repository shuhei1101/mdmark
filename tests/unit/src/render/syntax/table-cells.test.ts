import { expect, test } from "vitest";

/** セルの結合の計画を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTableCells = () =>
  import("../../../../../src/render/syntax/table-cells.ts");

// 見出しの横の結合と本文の縦の結合を決める（正常系）
test("test_plan_cell_merges", async () => {
  // 準備
  const { planCellMerges } = await loadTableCells();
  const cells = [
    ["地域", "上期", "<<"],
    ["^^", "売上", "件数"],
    ["東", "1", "2"],
    ["^^", "3", "4"],
  ];
  // 実行
  const plan = planCellMerges({ cells, headRows: 2 });
  // 検証
  expect(plan.cells[0]?.[0]).toMatchObject({ rowspan: 2, colspan: 1 });
  expect(plan.cells[0]?.[1]).toMatchObject({ rowspan: 1, colspan: 2 });
  expect(plan.cells[0]?.[2]).toMatchObject({ merged: "left", source: [0, 1] });
  expect(plan.cells[2]?.[0]).toMatchObject({ rowspan: 2, colspan: 1 });
  expect(plan.cells[3]?.[0]).toMatchObject({ merged: "up", source: [2, 0] });
  expect(plan.mergeColumns).toEqual([0]);
  expect(plan.warnings).toEqual([]);
});

// 続けて記載した ^^ を同じ始まりのセルにまとめる（正常系）
test("test_plan_cell_merges_when_chained", async () => {
  // 準備
  const { planCellMerges } = await loadTableCells();
  const cells = [["列"], ["A"], ["^^"], ["^^"], ["B"]];
  // 実行
  const plan = planCellMerges({ cells, headRows: 1 });
  // 検証
  expect(plan.cells[1]?.[0]).toMatchObject({ rowspan: 3, colspan: 1 });
  expect(plan.cells[2]?.[0]).toMatchObject({ merged: "up", source: [1, 0] });
  expect(plan.cells[3]?.[0]).toMatchObject({ merged: "up", source: [1, 0] });
  expect(plan.cells[4]?.[0]).toMatchObject({ rowspan: 1, colspan: 1 });
  expect(plan.cells[4]?.[0]).not.toHaveProperty("merged");
});

// 結合する相手の無い ^^・<< と、見出しと本文をまたぐ ^^ を警告にする（異常系）
test("test_plan_cell_merges_when_no_partner", async () => {
  // 準備
  const { planCellMerges } = await loadTableCells();
  const cells = [
    ["<<", "値"],
    ["a", "^^"],
  ];
  // 実行
  const plan = planCellMerges({ cells, headRows: 1 });
  // 検証
  for (const row of plan.cells) {
    for (const cell of row) {
      expect(cell.merged).toBeUndefined();
      expect(cell.rowspan).toBe(1);
      expect(cell.colspan).toBe(1);
    }
  }
  expect(plan.warnings.map((item) => item.label)).toEqual(["<<", "^^"]);
});

// 矩形にならない結合を警告にする（異常系）
test("test_plan_cell_merges_when_not_rectangle", async () => {
  // 準備
  const { planCellMerges } = await loadTableCells();
  const cells = [
    ["列", "値"],
    ["A", "<<"],
    ["^^", "x"],
  ];
  // 実行
  const plan = planCellMerges({ cells, headRows: 1 });
  // 検証
  expect(plan.cells[2]?.[0]?.merged).toBeUndefined();
  expect(plan.warnings.some((item) => item.label === "^^")).toBe(true);
});

// 上の行の結合した見出しが覆う列だけに範囲を返却する（正常系）
test("test_header_groups_of", async () => {
  // 準備
  const { planCellMerges, headerGroupsOf } = await loadTableCells();
  const head = [
    ["名前", "設定", "<<", "<<", "備考"],
    ["^^", "型", "既定", "必須", "^^"],
  ];
  const plan = planCellMerges({ cells: head, headRows: 2 });
  // 実行
  const groups = headerGroupsOf({ head, plan });
  // 検証
  expect(groups).toEqual([undefined, "0:1", "0:1", "0:1", undefined]);
});
