import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../helpers/html.ts";

/** 表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTable = () => import("../../../../src/parts/table.ts");

/** 中身の差し込み口の処理を読み込む */
const loadOwn = () => import("../../../../src/parts/own.ts");

// 囲みに種類・機能・絞り込みを属性で持たせる（正常系）
test("test_render_table", async () => {
  // 準備
  const { renderTable } = await loadTable();
  const { SLOT_MARKER } = await loadOwn();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    filters: [{ column: 0, kind: "select" }],
    body: SLOT_MARKER,
  });
  // 検証
  expect(
    html.startsWith(
      '<div class="mdmark-table" data-kind="data" data-features="sort pin filter" data-filter="0:select">',
    ),
  ).toBe(true);
  expect(html).toContain(SLOT_MARKER);
});

// 閉じた表は折り畳みに入れる（正常系）
test("test_render_table_when_closed", async () => {
  // 準備
  const { renderTable } = await loadTable();
  const { SLOT_MARKER } = await loadOwn();
  // 実行
  const html = renderTable({
    features: [],
    collapse: "closed",
    body: SLOT_MARKER,
  });
  // 検証
  expect(html).toContain(
    '<details class="mdmark-table-details"><summary>表を開く</summary>',
  );
  expect(findTag(html, "<details")).not.toMatch(/\sopen\b/);
});

// 当てた絞り込みに合わない行を隠し、一致する行が無ければ知らせの行を出す（正常系）
test("test_render_table_when_filtered", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["filter"],
    columns: ["名前", "値"],
    rows: [
      ["a", "1"],
      ["b", "2"],
    ],
    filters: [{ column: 1, kind: "text" }],
    filterValues: [{ column: 1, text: "存在しない" }],
  });
  // 検証
  const body = innerHtml(html, "<tbody");
  const rows = body.match(/<tr\b[^>]*>/g) ?? [];
  const empty = rows.filter((row) => row.includes("mdmark-table-empty"));
  const dataRows = rows.filter((row) => !row.includes("mdmark-table-empty"));
  expect(dataRows).toHaveLength(2);
  for (const row of dataRows) {
    expect(row).toMatch(/\shidden\b/);
  }
  expect(empty).toHaveLength(1);
  expect(empty[0]).not.toMatch(/\shidden\b/);
  expect(body).toContain("一致する行がありません");
});

// 値を選ぶドロワーとボタンを返す（正常系）
test("test_render_table_tools", async () => {
  // 準備
  const { renderTableTools } = await loadTable();
  // 実行
  const { header, drawer } = renderTableTools({
    id: "t1",
    column: 0,
    label: "名前",
    features: ["sort", "pin", "filter"],
    filter: { kind: "select", values: ["りんご", "みかん"] },
  });
  // 検証
  expect(header).toContain("mdmark-sort");
  expect(findTag(header, 'aria-label="「名前」で絞り込む"')).toContain(
    "mdmark-filter",
  );
  expect(findTag(header, "mdmark-pin")).toMatch(/\shidden\b/);
  expect(findTag(drawer, "mdmark-filter-drawer")).toMatch(/\shidden\b/);
  expect(drawer).toContain("候補を検索");
  expect(findTags(drawer, 'type="checkbox"')).toHaveLength(2);
  expect(drawer).toContain("絞り込みを外す");
});

// 日付のドロワーは開始日と終了日の欄を持つ（正常系）
test("test_render_table_tools_when_date", async () => {
  // 準備
  const { renderTableTools } = await loadTable();
  // 実行
  const { drawer } = renderTableTools({
    id: "t1",
    column: 2,
    label: "更新日",
    features: ["filter"],
    filter: { kind: "date", values: [] },
  });
  // 検証
  expect(drawer).toContain("開始日");
  expect(drawer).toContain("終了日");
  expect(findTags(drawer, 'type="date"')).toHaveLength(2);
});
