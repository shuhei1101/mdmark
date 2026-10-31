import { expect, test } from "vitest";
import {
  findTag,
  findTags,
  innerHtml,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";

/** 表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTable = () => import("../../../../src/parts/table.ts");

/** 部品の HTML の `tr` を、現れた順に返す */
function rowsOf(html: string): string[] {
  return html.match(/<tr\b[\s\S]*?<\/tr>/g) ?? [];
}

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
    rowCount: 3,
    body: SLOT_MARKER,
  });
  // 検証
  expect(html).toContain(
    '<details class="mdmark-table-details"><summary>表（3 行）</summary>',
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
  const bodyRows = rowsOf(body).filter(
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
  const { bar, menus } = renderTableBar({
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
  const copy = findTag(bar, "mdmark-copy");
  expect(copy).toContain('data-state="idle"');
  expect(outerHtml(bar, "mdmark-copy")).toContain("表をコピー");
  expect(outerHtml(bar, "mdmark-copy")).toContain("chevron-down");
  expect(findTag(bar, "mdmark-table-status")).toContain('role="status"');
  // 検証: 列の表示のメニュー
  expect(findTag(menus, "mdmark-columns-menu")).toMatch(/\shidden\b/);
  const checkboxes = findTags(menus, 'type="checkbox"');
  expect(checkboxes).toHaveLength(3);
  expect(checkboxes[0]).toMatch(/\schecked\b/);
  expect(checkboxes[0]).toMatch(/\sdisabled\b/);
  expect(checkboxes[1]).not.toMatch(/\schecked\b/);
  expect(checkboxes[2]).toMatch(/\schecked\b/);
  expect(menus).toContain("先頭の列は隠せません");
  expect(menus).toContain("既定に戻す");
  // 検証: コピーの形式のメニュー
  expect(findTag(menus, 'aria-label="コピーの形式"')).toMatch(/\shidden\b/);
  const formats = findTags(menus, "data-format=");
  expect(formats.map((tag) => /data-format="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "markdown",
    "tsv",
  ]);
});

// コピーできなかったボタンを返す（正常系）
test("test_render_table_bar_when_copy_failed", async () => {
  // 準備
  const { renderTableBar } = await loadTable();
  // 実行
  const { bar, menus } = renderTableBar({
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
  expect(menus).not.toContain("mdmark-columns-menu");
});

// 集計のボタンとメニューを返し、隠している計算の数を読み上げの名前に加える（正常系）
test("test_render_table_bar_when_totals", async () => {
  // 準備
  const { renderTableBar } = await loadTable();
  // 実行
  const { bar, menus } = renderTableBar({
    id: "t1",
    features: ["total"],
    labels: ["名前", "数量", "単価"],
    shown: 3,
    total: 3,
    hiddenColumns: [],
    totals: ["sum", "avg", "count"],
    shownTotals: ["sum"],
    openTotals: true,
  });
  // 検証: 集計のボタン
  const toggle = findTag(bar, "mdmark-totals-toggle");
  expect(toggle).toContain("is-active");
  expect(toggle).toContain('aria-expanded="true"');
  expect(outerHtml(bar, "mdmark-totals-toggle")).toContain(
    "（2 件を隠しています）",
  );
  // 検証: 集計のメニュー
  const menu = findTag(menus, 'aria-label="出す集計"');
  expect(menu).not.toMatch(/\shidden\b/);
  const checkboxes = findTags(menus, 'type="checkbox"');
  expect(checkboxes.map((tag) => /value="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "sum",
    "avg",
    "count",
  ]);
  expect(checkboxes.map((tag) => /\schecked\b/.test(tag))).toEqual([
    true,
    false,
    false,
  ]);
  const text = plainText(menus);
  for (const name of ["合計", "平均", "件数"]) {
    expect(text).toContain(name);
  }
});

// コピーの形式のメニューを開いた帯を返す（正常系）
test("test_render_table_bar_when_copy_menu_open", async () => {
  // 準備
  const { renderTableBar } = await loadTable();
  // 実行
  const { bar, menus } = renderTableBar({
    id: "t1",
    features: ["copy"],
    labels: ["名前", "説明"],
    shown: 2,
    total: 2,
    hiddenColumns: [],
    openCopy: true,
  });
  // 検証
  expect(findTag(bar, "mdmark-copy")).toContain('aria-expanded="true"');
  expect(findTag(menus, 'aria-label="コピーの形式"')).not.toMatch(/\shidden\b/);
  const text = plainText(menus);
  expect(text.indexOf("Markdown の表")).toBeGreaterThanOrEqual(0);
  expect(text).toContain("文書に貼るとそのまま表になる");
  expect(text.indexOf("TSV")).toBeGreaterThan(text.indexOf("Markdown の表"));
  expect(text).toContain("表計算ソフトに貼るとセルに分かれる");
});

// 計算ごとに行を分け、名前と値を出して隠した列のセルを隠す（正常系）
test("test_render_total_rows", async () => {
  // 準備
  const { renderTotalRows } = await loadTable();
  // 実行
  const html = renderTotalRows({
    columns: 3,
    totals: [
      { column: 2, calc: "avg", value: "250" },
      { column: 1, calc: "sum", value: "45" },
      { column: 0, calc: "count", value: "4" },
    ],
    hiddenColumns: [2],
    labels: ["名前", "数量", "単価"],
  });
  // 検証: 行は合計・平均・件数の順
  const rows = rowsOf(html);
  expect(rows.map((row) => /data-total-kind="([^"]*)"/.exec(row)?.[1])).toEqual(
    ["sum", "avg", "count"],
  );
  // 検証: 合計の行は先頭のセルに名前、集計する列のセルに値
  const sumCells = findTags(rows[0], "<td");
  expect(sumCells).toHaveLength(3);
  expect(sumCells[0]).not.toContain("data-total=");
  expect(sumCells[1]).toContain('data-total="sum"');
  expect(plainText(rows[0])).toContain("合計");
  expect(plainText(rows[0])).toContain("45");
  // 検証: 平均の行の隠した列のセルは hidden
  const avgCells = findTags(rows[1], "<td");
  expect(avgCells[2]).toContain('data-total="avg"');
  expect(avgCells[2]).toMatch(/\shidden\b/);
  expect(plainText(rows[1])).toContain("250");
  // 検証: 先頭の列を集計する件数の行は、名前と値を同じセルに置く
  const countCells = findTags(rows[2], "<td");
  expect(countCells[0]).toContain('data-total="count"');
  expect(plainText(rows[2])).toContain("件数");
  expect(plainText(rows[2])).toContain("4");
});

// 出さない計算の行を隠す（正常系）
test("test_render_total_rows_when_shown", async () => {
  // 準備
  const { renderTotalRows } = await loadTable();
  // 実行
  const html = renderTotalRows({
    columns: 2,
    totals: [
      { column: 1, calc: "sum", value: "45" },
      { column: 1, calc: "avg", value: "15" },
    ],
    shown: ["avg"],
    hiddenColumns: [],
    labels: ["名前", "数量"],
  });
  // 検証
  const [sumRow, avgRow] = findTags(html, "<tr");
  expect(sumRow).toMatch(/\shidden\b/);
  expect(avgRow).not.toMatch(/\shidden\b/);
});

// 題・案内・エスケープした中身を持つパネルを返す（正常系）
test("test_render_copy_panel", async () => {
  // 準備
  const { renderCopyPanel } = await loadTable();
  // 実行
  const html = renderCopyPanel({
    id: "p1",
    format: "markdown",
    text: "| a<b |\n| --- |",
  });
  // 検証
  expect(html.startsWith('<div class="mdmark-copy-panel"')).toBe(true);
  const panel = findTag(html, "mdmark-copy-panel");
  expect(panel).toContain('role="group"');
  const labelledBy = /aria-labelledby="([^"]*)"/.exec(panel)?.[1];
  expect(labelledBy).toBeTruthy();
  expect(html).toContain(`id="${labelledBy}"`);
  expect(plainText(html)).toContain("クリップボードにコピーできませんでした");
  expect(plainText(html)).toContain(
    "「Markdown の表」の中身を選択しています。",
  );
  expect(findTag(html, "<textarea")).toMatch(/\sreadonly\b/);
  expect(innerHtml(html, "<textarea")).toContain("| a&lt;b |");
  expect(findTag(html, 'aria-label="閉じる"')).toContain("<button");
});

// 閉じた開閉の行とボタンを返す（正常系）
test("test_render_folded_column", async () => {
  // 準備
  const { renderFoldedColumn } = await loadTable();
  // 実行
  const { toggle, row } = renderFoldedColumn({
    id: "t1-fold-0",
    columns: 3,
    label: "りんご",
    name: "説明",
    html: "描画を速くする",
  });
  // 検証
  expect(toggle).toContain('aria-expanded="false"');
  expect(toggle).toContain('aria-controls="t1-fold-0"');
  expect(toggle).toContain('aria-label="「りんご」の説明"');
  expect(row).toContain(
    '<tr class="mdmark-row-detail mdmark-fold-detail" id="t1-fold-0" hidden><td colspan="3">',
  );
  expect(innerHtml(row, "mdmark-fold-name")).toBe("説明");
  expect(innerHtml(row, "mdmark-fold-value")).toBe("描画を速くする");
});

// 開いた行は隠さない（正常系）
test("test_render_folded_column_when_open", async () => {
  // 準備
  const { renderFoldedColumn } = await loadTable();
  // 実行
  const { toggle, row } = renderFoldedColumn({
    id: "t1-fold-0",
    columns: 3,
    label: "りんご",
    name: "説明",
    html: "描画を速くする",
    open: true,
  });
  // 検証
  expect(toggle).toContain('aria-expanded="true"');
  expect(findTag(row, "<tr")).not.toMatch(/\shidden\b/);
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

// 数として読めないセルを持つ列の合計と平均を空にし、計算ごとの行を出す（正常系）
test("test_render_table_when_totals_unreadable", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "total"],
    columns: ["名前", "数量", "単価"],
    filters: [{ column: 0, kind: "text" }],
    rows: [
      ["りんご", "10", "100"],
      ["みかん", "約 3", "200"],
      ["りんご飴", "33", "300"],
      ["ぶどう", "-", "400"],
    ],
    totals: [
      { column: 1, calc: "sum" },
      { column: 2, calc: "avg" },
    ],
  });
  // 検証: 部品設計の状態『TotalsUnreadable』は合計と平均の 2 行
  const foot = innerHtml(html, "<tfoot");
  const rows = rowsOf(foot);
  expect(rows.map((row) => /data-total-kind="([^"]*)"/.exec(row)?.[1])).toEqual(
    ["sum", "avg"],
  );
  // 検証: 合計の行の数量のセルは空、平均の行の単価のセルは 250
  expect(plainText(rows[0]).replace("合計", "").trim()).toBe("");
  expect(plainText(rows[1])).toContain("250");
});

// 出さない計算の集計の行を隠す（正常系）
test("test_render_table_when_totals_hidden", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "total"],
    columns: ["名前", "数量", "単価"],
    rows: [
      ["りんご", "10", "100"],
      ["みかん", "2", "200"],
      ["りんご飴", "33", "300"],
      ["ぶどう", "", "400"],
    ],
    totals: [
      { column: 0, calc: "count" },
      { column: 1, calc: "sum" },
      { column: 2, calc: "avg" },
    ],
    shownTotals: ["sum"],
  });
  // 検証
  const rows = findTags(innerHtml(html, "<tfoot"), "<tr");
  expect(rows).toHaveLength(3);
  const hidden = Object.fromEntries(
    rows.map((row) => [
      /data-total-kind="([^"]*)"/.exec(row)?.[1],
      /\shidden\b/.test(row),
    ]),
  );
  expect(hidden).toEqual({ sum: false, avg: true, count: true });
  expect(findTag(html, "mdmark-totals-toggle")).toContain("is-active");
});

// クリップボードに書けなかったときのパネルを帯の直後に出す（正常系）
test("test_render_table_when_copy_fallback", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "copy"],
    columns: ["名前", "説明", "更新日"],
    rows: [
      ["りんご", "描画を速くする", "2026-10-01"],
      ["みかん", "印刷を直す", "2026-10-10"],
    ],
    copyState: "failed",
    copyFallback: { format: "tsv", text: "名前\t数量" },
  });
  // 検証
  const bar = outerHtml(html, 'class="mdmark-table-bar"');
  const afterBar = html.slice(html.indexOf(bar) + bar.length);
  expect(afterBar.startsWith('<div class="mdmark-copy-panel"')).toBe(true);
  expect(findTag(afterBar, "mdmark-copy-panel")).toContain('role="group"');
  expect(plainText(afterBar)).toContain("「TSV」の中身を選択しています。");
  expect(findTag(afterBar, "<textarea")).toMatch(/\sreadonly\b/);
  expect(innerHtml(afterBar, "<textarea")).toBe("名前\t数量");
});

// 行の URL をコピーした結果を印の横の知らせに出す（正常系）
test("test_render_table_when_row_link_notice", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "rowlink"],
    columns: ["名前", "説明", "更新日"],
    rows: [
      ["りんご", "描画を速くする", "2026-10-01"],
      ["みかん", "印刷を直す", "2026-10-10"],
      ["りんご飴", "描画の崩れを直す", "2026-10-20"],
    ],
    rowIds: ["りんご", "みかん", "りんご飴"],
    targetRow: 1,
    rowLinkNotice: "copied",
  });
  // 検証
  const rows = rowsOf(innerHtml(html, "<tbody")).filter(
    (row) => !row.includes("mdmark-table-empty"),
  );
  expect(rows).toHaveLength(3);
  for (const [index, row] of rows.entries()) {
    const notice = findTag(row, "mdmark-row-link-notice");
    expect(notice).toContain('role="status"');
    expect(notice.includes('data-state="copied"')).toBe(index === 1);
  }
  expect(innerHtml(rows[1], "mdmark-row-link-notice")).toContain(
    "リンクをコピーしました",
  );
});

// 最終列を畳み、開いた行の直後に最終列を出す（正常系）
test("test_render_table_when_folded", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    columns: ["名前", "更新日", "説明"],
    rows: [
      [
        "りんご",
        "2026-10-01",
        "描画を速くするために、見出しの ID を作る処理を 1 回にまとめる",
      ],
      ["みかん", "2026-10-10", "印刷で折り畳みを開き、リンクの URL を併記する"],
    ],
    folded: true,
    unfoldedRows: [0],
  });
  // 検証: 囲みと最終列のセル
  expect(findTag(html, 'class="mdmark-table')).toContain("is-folded");
  const bodyRows = rowsOf(innerHtml(html, "<tbody")).filter(
    (row) =>
      !row.includes("mdmark-fold-detail") &&
      !row.includes("mdmark-table-empty"),
  );
  expect(bodyRows).toHaveLength(2);
  for (const row of bodyRows) {
    expect(findTags(row, "<td").at(-1)).toContain("mdmark-fold-col");
  }
  // 検証: 開閉のボタンは各行に 1 つで、1 行目だけ開いている
  const toggles = findTags(html, "mdmark-fold-toggle");
  expect(toggles).toHaveLength(2);
  expect(toggles[0]).toContain('aria-expanded="true"');
  expect(toggles[1]).toContain('aria-expanded="false"');
  // 検証: 1 行目の直後の開閉の行は隠さず、最終列の見出しを持つ
  const details = findTags(html, "mdmark-fold-detail");
  expect(details[0]).not.toMatch(/\shidden\b/);
  expect(details[1]).toMatch(/\shidden\b/);
  expect(innerHtml(html, "mdmark-fold-name")).toBe("説明");
});

// 開いた折り畳みの見出しを title にし、エスケープする（正常系）
test("test_render_table_when_title", async () => {
  // 準備
  const { renderTable } = await loadTable();
  const { SLOT_MARKER } = await loadOwn();
  // 実行
  const opened = renderTable({
    features: [],
    collapse: "open",
    title: "リリースの一覧",
    body: SLOT_MARKER,
  });
  const escaped = renderTable({
    features: [],
    collapse: "closed",
    title: "a<b",
    body: SLOT_MARKER,
  });
  // 検証
  expect(opened).toContain(
    '<details class="mdmark-table-details" open><summary>リリースの一覧</summary>',
  );
  expect(escaped).toContain("<summary>a&lt;b</summary>");
});

// ツリーのパネルはツリーの案内を出す（正常系）
test("test_render_copy_panel_when_tree", async () => {
  // 準備
  const { renderCopyPanel } = await loadTable();
  // 実行
  const html = renderCopyPanel({
    id: "p1",
    format: "tree",
    text: "src/\n└── index.ts",
  });
  // 検証
  expect(plainText(html)).toContain("ツリーのテキストを選択しています。");
  expect(innerHtml(html, "<textarea")).toBe("src/\n└── index.ts");
});
