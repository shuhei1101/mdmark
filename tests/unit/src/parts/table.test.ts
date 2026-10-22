import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";

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

// 囲みに隠す列と集計する列を属性で持たせる（正常系）
test("test_render_table_when_feature_attributes", async () => {
  // 準備
  const { renderTable } = await loadTable();
  const { SLOT_MARKER } = await loadOwn();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "columns", "total"],
    hide: [1],
    totals: [{ column: 2, calc: "sum" }],
    body: SLOT_MARKER,
  });
  // 検証
  const wrapper = findTag(html, 'class="mdmark-table"');
  expect(wrapper).toContain('data-hide="1"');
  expect(wrapper).toContain('data-total="2:sum"');
  expect(html).not.toContain("mdmark-table-bar");
  expect(html).not.toContain("mdmark-table-total");
});

// 5 つの機能の状態を描く（正常系）
test("test_render_table_when_all_features", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: [
      "sort",
      "pin",
      "filter",
      "count",
      "columns",
      "total",
      "copy",
      "rowlink",
    ],
    columns: ["名前", "説明", "数量"],
    rows: [
      ["なつめ", "描画を速くする", "12"],
      ["かりん", "印刷を直す", "8"],
      ["ざくろ", "描画の崩れを直す", "5"],
    ],
    hide: [1],
    totals: [{ column: 2, calc: "sum" }],
    rowIds: ["なつめ", "かりん", "ざくろ"],
    targetRow: 1,
  });
  // 検証: 帯
  const bar = innerHtml(html, 'class="mdmark-table-bar"');
  expect(bar).toContain("3 / 3 件");
  expect(bar).toContain("列の表示");
  expect(bar).toContain("表をコピー");
  // 検証: 隠した説明の列の見出し・セル・集計のセル
  const head = innerHtml(html, "<thead");
  expect(findTags(head, "<th")[1]).toMatch(/\shidden\b/);
  const body = innerHtml(html, "<tbody");
  const bodyRows = (body.match(/<tr\b[\s\S]*?<\/tr>/g) ?? []).filter(
    (row) => !row.includes("mdmark-table-empty"),
  );
  expect(bodyRows).toHaveLength(3);
  for (const row of bodyRows) {
    expect(findTags(row, "<td")[1]).toMatch(/\shidden\b/);
  }
  const foot = innerHtml(html, "<tfoot");
  expect(findTags(foot, "<td")[1]).toMatch(/\shidden\b/);
  expect(foot).toContain("合計");
  expect(foot).toContain("25");
  // 検証: 各行の id と行へのリンク、2 行目だけ強調
  const ids = bodyRows.map(
    (row) => /\sid="([^"]*)"/.exec(findTag(row, "<tr"))?.[1],
  );
  expect(ids).toEqual(["なつめ", "かりん", "ざくろ"]);
  for (const [index, row] of bodyRows.entries()) {
    expect(findTag(row, "mdmark-row-anchor")).toContain(
      `href="#${ids[index]}"`,
    );
    const targeted = /\sdata-target\b/.test(findTag(row, "<tr"));
    expect(targeted).toBe(index === 1);
  }
});

// 件数と列の表示とコピーの帯を返す（正常系）
test("test_render_table_bar", async () => {
  // 準備
  const { renderTableBar } = await loadTable();
  // 実行
  const { bar, menu } = renderTableBar({
    id: "t1",
    features: ["count", "columns", "copy"],
    labels: ["名前", "説明", "更新日"],
    shown: 2,
    total: 3,
    hiddenColumns: [1],
  });
  // 検証: 帯
  expect(findTag(bar, 'aria-live="polite"')).toContain("mdmark-table-count");
  expect(bar).toContain("2 / 3 件");
  expect(bar).toContain("3 件中 2 件を表示");
  const toggle = findTag(bar, "mdmark-columns-toggle");
  expect(toggle).toContain('aria-expanded="false"');
  expect(bar).toContain("列の表示");
  expect(findTag(bar, "mdmark-copy")).toContain('data-state="idle"');
  expect(bar).toContain("表をコピー");
  // 検証: メニュー
  expect(findTag(menu, "mdmark-columns-menu")).toMatch(/\shidden\b/);
  const checkboxes = findTags(menu, 'type="checkbox"');
  expect(checkboxes).toHaveLength(3);
  expect(checkboxes[0]).toMatch(/\schecked\b/);
  expect(checkboxes[0]).toMatch(/\sdisabled\b/);
  expect(checkboxes[1]).not.toMatch(/\schecked\b/);
  expect(checkboxes[2]).toMatch(/\schecked\b/);
  expect(menu).toContain("先頭の列は隠せません");
  expect(menu).toContain("既定に戻す");
});

// コピーできなかったボタンを返す（正常系）
test("test_render_table_bar_when_copy_failed", async () => {
  // 準備
  const { renderTableBar } = await loadTable();
  // 実行
  const { bar, menu } = renderTableBar({
    id: "t1",
    features: ["copy"],
    labels: ["名前", "説明"],
    shown: 2,
    total: 2,
    hiddenColumns: [],
    copyState: "failed",
  });
  // 検証
  expect(findTag(bar, "mdmark-copy")).toContain('data-state="failed"');
  expect(bar).toContain("コピーできませんでした");
  expect(bar).not.toContain("mdmark-table-count");
  expect(bar).not.toContain("列の表示");
  expect(menu).toBe("");
});

// 集計する列に題と値を出し、隠した列のセルを隠す（正常系）
test("test_render_total_row", async () => {
  // 準備
  const { renderTotalRow } = await loadTable();
  // 実行
  const html = renderTotalRow({
    columns: 3,
    totals: [
      { column: 0, calc: "count", value: "4" },
      { column: 1, calc: "sum", value: "45" },
      { column: 2, calc: "avg", value: "250" },
    ],
    hiddenColumns: [2],
    labels: ["名前", "数量", "単価"],
  });
  // 検証
  const cells = findTags(html, "<td");
  expect(cells).toHaveLength(3);
  expect(cells[0]).toContain('data-total="count"');
  expect(cells[1]).toContain('data-total="sum"');
  expect(cells[2]).toContain('data-total="avg"');
  expect(cells[0]).not.toMatch(/\shidden\b/);
  expect(cells[1]).not.toMatch(/\shidden\b/);
  expect(cells[2]).toMatch(/\shidden\b/);
  const text = plainText(html);
  expect(text).toContain("個数");
  expect(text).toContain("合計");
  expect(text).toContain("平均");
  for (const value of ["4", "45", "250"]) {
    expect(text).toContain(value);
  }
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
