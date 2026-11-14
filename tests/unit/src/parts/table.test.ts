import { expect, test } from "vitest";
import type { TableOptions } from "../../../../src/parts/table.ts";
import {
  findTag,
  findTags,
  innerHtml,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";

/** 表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTable = () => import("../../../../src/parts/table.ts");

/** 部品の HTML の `tr` を、現れた順に返却する */
function rowsOf(html: string): string[] {
  return html.match(/<tr\b[\s\S]*?<\/tr>/g) ?? [];
}

/** 中身の差し込みインターフェースの処理を読み込む */
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
  expect(innerHtml(html, 'class="mdmark-table-scroll"')).toContain(SLOT_MARKER);
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

// 適用した絞り込みに合わない行を隠し、一致する行が無ければ通知の行を出す（正常系）
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
      ["かりん", "印刷を修正する", "8"],
      ["ざくろ", "描画の崩れを修正する", "5"],
    ],
    hide: [1],
    totals: [{ column: 2, calc: "sum" }],
    rowIds: ["なつめ", "かりん", "ざくろ"],
    targetRow: 1,
  });
  // 検証: 帯
  const bar = innerHtml(html, 'class="mdmark-table-bar"');
  expect(bar).toContain("3 / 3 件");
  expect(bar).toContain("mdmark-table-settings-toggle");
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

// 件数とテーブル設定とコピーの帯を返却する（正常系）
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
  const toggle = findTag(bar, "mdmark-table-settings-toggle");
  expect(toggle).toContain('aria-expanded="false"');
  expect(toggle).toContain("is-icon-only");
  expect(toggle).toContain("is-active");
  expect(toggle).toContain('title="テーブル設定"');
  expect(toggle).toContain('aria-label="テーブル設定（1 列を非表示）"');
  expect(plainText(outerHtml(bar, "mdmark-table-tool-badge"))).toBe("1");
  const copy = findTag(bar, "mdmark-copy");
  expect(copy).toContain('data-state="idle"');
  expect(copy).toContain("is-icon-only");
  expect(copy).toContain('title="表をコピー"');
  expect(outerHtml(bar, "mdmark-copy")).not.toContain("chevron-down");
  expect(findTag(bar, "mdmark-table-status")).toContain('role="status"');
  // 検証: テーブル設定のパネル
  expect(findTag(menus, 'class="mdmark-table-settings"')).toMatch(/\shidden\b/);
  const eyes = findTags(menus, "mdmark-table-settings-eye");
  expect(eyes).toHaveLength(3);
  expect(eyes[0]).toMatch(/\sdisabled\b/);
  expect(eyes[1]).not.toMatch(/\sdisabled\b/);
  expect(menus).toContain("先頭の列は隠せません");
  expect(menus).not.toContain("リセット");
  // 検証: コピーの形式のメニュー
  expect(findTag(menus, 'aria-label="コピーの形式"')).toMatch(/\shidden\b/);
  const formats = findTags(menus, "data-format=");
  expect(formats.map((tag) => /data-format="([^"]*)"/.exec(tag)?.[1])).toEqual([
    "markdown",
    "tsv",
  ]);
});

// コピーできなかったボタンを返却する（正常系）
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
  expect(bar).not.toContain("mdmark-table-settings-toggle");
  expect(menus).not.toContain("mdmark-table-settings");
});

// 集計のボタンとメニューを返却し、隠している計算の数をスクリーンリーダー向けの名前に加える（正常系）
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
    "（2 件を非表示にしています）",
  );
  // 検証: 集計のメニュー
  const menu = findTag(menus, 'aria-label="表示する集計"');
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

// コピーの形式のメニューを開いた帯を返却する（正常系）
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
  // 検証: 先頭の列を集計する件数の行は、名前と値を同じセルに配置する
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

// タイトル・案内・エスケープした中身を持つパネルを返却する（正常系）
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

// 値を選ぶドロワーとボタンを返却する（正常系）
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
  expect(drawer).toContain("絞り込みを解除");
});

// ピン止めのボタンの名前をピン止めの動きで切り替える（正常系）
test("test_render_table_tools_when_pin_mode", async () => {
  // 準備
  const { renderTableTools } = await loadTable();
  const options = {
    id: "t1",
    column: 0,
    label: "名前",
    features: ["pin"],
    pinVisible: true,
    pinPressed: true,
  };
  // 実行
  const each = renderTableTools(options);
  const through = renderTableTools({ ...options, pinMode: "through" });
  // 検証
  const eachPin = findTag(each.header, "mdmark-pin");
  const throughPin = findTag(through.header, "mdmark-pin");
  expect(eachPin).toContain('aria-label="「名前」の列をピン止め"');
  expect(throughPin).toContain('aria-label="「名前」の列までピン止め"');
  expect(eachPin).toContain('aria-pressed="true"');
  expect(throughPin).toContain('aria-pressed="true"');
});

// 見えている幅に収まらず留まっていない列のボタンに、留まっていないことを付ける（正常系）
test("test_render_table_tools_when_unpinned", async () => {
  // 準備
  const { renderTableTools } = await loadTable();
  const options = {
    id: "t1",
    column: 0,
    label: "名前",
    features: ["pin"],
    pinVisible: true,
    pinPressed: true,
  };
  // 実行
  const unpinned = renderTableTools({ ...options, pinUnpinned: true });
  const pinned = renderTableTools(options);
  // 検証
  const unpinnedPin = findTag(unpinned.header, "mdmark-pin");
  const pinnedPin = findTag(pinned.header, "mdmark-pin");
  const label =
    "「名前」の列をピン止め（表の幅に収まらないため留まっていません）";
  expect(unpinnedPin).toMatch(/class="[^"]*\bis-unpinned\b/);
  expect(unpinnedPin).toContain(`aria-label="${label}"`);
  expect(unpinnedPin).toContain(`title="${label}"`);
  expect(unpinnedPin).toContain('aria-pressed="true"');
  expect(pinnedPin).not.toContain("is-unpinned");
  expect(pinnedPin).toContain('aria-label="「名前」の列をピン止め"');
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

// 数として読み込めないセルを持つ列の合計と平均を空にし、計算ごとの行を出す（正常系）
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

// クリップボードに書き込めなかったときのパネルを帯の直後に出す（正常系）
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
      ["みかん", "印刷を修正する", "2026-10-10"],
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

// 行の URL をコピーした結果をマーカーの横の通知に出す（正常系）
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
      ["みかん", "印刷を修正する", "2026-10-10"],
      ["りんご飴", "描画の崩れを修正する", "2026-10-20"],
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

// 長文の列と列の幅の範囲を囲みに写し、自動の列の幅を入れる（正常系）
test("test_render_table_when_long_columns", async () => {
  // 準備
  const { renderTable } = await loadTable();
  const { SLOT_MARKER } = await loadOwn();
  const widths = [47, 71, 100, 78, 92, 757];
  // 実行
  const wrapper = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    long: [1, 3],
    widthRanges: [
      { column: 1, min: 20, max: 30 },
      { column: 3, max: 12 },
    ],
    body: SLOT_MARKER,
  });
  const auto = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    columns: ["No", "状態", "更新日", "名前", "手順", "説明"],
    rows: [["1", "対応中", "2026-11-01", "表の幅", "測る", "描画を速くする"]],
    long: [5],
    autoWidths: widths.map((width, column) => ({ column, width })),
  });
  // 検証: 囲みに長文の列と幅の範囲を写す
  const open = findTag(wrapper, 'class="mdmark-table"');
  expect(open).toContain('data-long="1 3"');
  expect(open).toContain('data-width="1:20-30 3:-12"');
  // 検証: 自動の列の幅を表と見出しのセルに入れる
  const table = findTag(auto, "<table");
  expect(table).toContain("data-auto-width");
  expect(table).toContain("--mdmark-auto-table-width:1145px");
  const heads = findTags(innerHtml(auto, "<thead"), "<th");
  expect(heads).toHaveLength(6);
  heads.forEach((head, column) => {
    expect(head).toContain(`--mdmark-auto-width:${widths[column]}px`);
  });
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

// 強調する列と色を付ける行を属性にする（正常系）
test("test_render_table_when_colors", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行（部品設計の HighlightAndRowColors）
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    columns: ["案件", "状態", "金額（円）"],
    rows: [
      ["見積もりの作成", "完了", "120000"],
      ["契約書の確認", "保留", "80000"],
      ["請求書の発行", "進行中", "45000"],
      ["納品の確認", "完了", "30000"],
    ],
    highlight: [{ column: 2, color: "blue" }],
    rowColors: [null, "red", null, null],
  });
  // 検証: 強調する列の見出しと各セル
  const highlighted = findTags(html, "mdmark-col-highlight");
  expect(highlighted.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(highlighted.filter((tag) => tag.startsWith("<td"))).toHaveLength(4);
  for (const tag of highlighted) {
    expect(tag).toContain('data-color="blue"');
  }
  // 検証: 色を付けた行の tr だけが data-color を持つ
  const body = innerHtml(html, "<tbody");
  const rows = (body.match(/<tr\b[^>]*>/g) ?? []).filter(
    (row) => !row.includes("mdmark-table-empty"),
  );
  expect(rows.map((row) => /data-color="([a-z]+)"/.exec(row)?.[1])).toEqual([
    undefined,
    "red",
    undefined,
    undefined,
  ]);
});

/** 部品設計『表』の `Merged` の引数 */
const MERGED: TableOptions = {
  kind: "data",
  features: ["sort", "pin", "filter"],
  columns: ["地域", "支店", "売上（万円）", "件数", "売上（万円）", "件数"],
  rows: [
    ["東日本", "札幌", "120", "14", "135", "16"],
    ["東日本", "仙台", "98", "11", "102", "12"],
    ["東日本", "東京", "310", "40", "342", "45"],
    ["西日本", "大阪", "260", "31", "248", "29"],
    ["西日本", "福岡", "140", "17", "151", "19"],
  ],
  headRows: [
    [
      { html: "地域", column: 0, rowspan: 2 },
      { html: "支店", column: 1, rowspan: 2 },
      { html: "上期", column: 2, colspan: 2 },
      { html: "下期", column: 4, colspan: 2 },
    ],
    [
      { html: "売上（万円）", column: 2 },
      { html: "件数", column: 3 },
      { html: "売上（万円）", column: 4 },
      { html: "件数", column: 5 },
    ],
  ],
  rowHeader: 1,
  mergeColumns: [0],
};

/** 本文の各行の 1 列目の `<th scope="row">` の開始タグと文字 */
function rowHeadsOf(html: string): Array<{ tag: string; text: string }> {
  return rowsOf(innerHtml(html, "<tbody"))
    .filter((row) => row.includes('scope="row"'))
    .map((row) => {
      const tag = findTag(row, 'scope="row"');
      return { tag, text: plainText(innerHtml(row, 'scope="row"')).trim() };
    });
}

// 多段の見出しと行見出しと結合したセルを描き、ボタンを最下段に配置する（正常系）
test("test_render_table_when_merged", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({ ...MERGED });
  // 検証: 見出し
  const headRows = rowsOf(innerHtml(html, "<thead"));
  expect(headRows).toHaveLength(2);
  const upper = outerHtml(headRows[0] ?? "", 'colspan="2"');
  expect(findTag(upper, 'colspan="2"')).toContain('scope="colgroup"');
  expect(upper).toContain("上期");
  expect(upper).not.toContain("mdmark-sort");
  expect(findTags(headRows[1] ?? "", "mdmark-sort").length).toBeGreaterThan(0);
  // 検証: 行見出しと結合
  const heads = rowHeadsOf(html);
  expect(heads).toHaveLength(5);
  expect(heads[0]?.text).toBe("東日本");
  expect(heads[0]?.tag).toContain('rowspan="3"');
  expect(heads[0]?.tag).toContain("is-merged");
  for (const head of heads.slice(1, 3)) {
    expect(head.tag).toMatch(/\shidden\b/);
  }
});

// 並べ替えた順で隣り合う同じ値だけを結合する（正常系）
test("test_render_table_when_merged_sorted", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行
  const html = renderTable({
    ...MERGED,
    sort: { column: 4, direction: "descending" },
  });
  // 検証: 東京・大阪・福岡・札幌・仙台の順で、地域は 東・西・西・東・東
  const heads = rowHeadsOf(html);
  expect(heads.map((head) => head.text)).toEqual([
    "東日本",
    "西日本",
    "西日本",
    "東日本",
    "東日本",
  ]);
  expect(heads[0]?.tag).not.toContain("rowspan");
  expect(heads[1]?.tag).toContain('rowspan="2"');
  expect(heads[2]?.tag).toMatch(/\shidden\b/);
  expect(heads[3]?.tag).toContain('rowspan="2"');
  expect(heads[4]?.tag).toMatch(/\shidden\b/);
  expect(heads.filter((head) => /\shidden\b/.test(head.tag))).toHaveLength(2);
});

// 留める列と真偽値の列を属性に持たせ、広く取る列と真偽値のセルを描く（正常系）
test("test_render_table_when_columns_specified", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行（部品設計の PinAndWide と Check）
  const pinAndWide = renderTable({
    features: ["pin"],
    columns: ["ID", "担当", "概要", "状態", "期限"],
    rows: [
      [
        "#245",
        "表",
        "はみ出す表で先頭の列を既定でピン止めし、pin= と wide= と check= を使用できるようにする",
        "未着手",
        "2026-11-21",
      ],
      [
        "#249",
        "コード",
        "tree を除く全てのコードブロックでインデントによる畳む・開くと縦線を付ける",
        "未着手",
        "2026-11-28",
      ],
    ],
    overflow: true,
    pin: [1],
    pinned: [1],
    wide: [2],
  });
  const check = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter"],
    columns: ["キー", "型", "必須", "既定"],
    rows: [
      ["version", "string", "true", "-"],
      ["features", "object", "false", "全てオン"],
      ["libraries", "object", "false", "jsDelivr"],
      ["build", "array", "true", "-"],
    ],
    check: [2],
  });
  // 検証: 留める列と広く取る列
  expect(findTag(pinAndWide, 'class="mdmark-table')).toContain('data-pin="1"');
  const wide = findTags(pinAndWide, "mdmark-wide");
  expect(wide.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(wide.filter((tag) => tag.startsWith("<td"))).toHaveLength(2);
  for (const row of rowsOf(pinAndWide).filter((tr) => tr.includes("<td"))) {
    const cells = row.match(/<td\b[^>]*>/g) ?? [];
    if (cells.length < 5) {
      continue;
    }
    expect(cells[0]).not.toContain("is-pinned-col");
    expect(cells[1]).toContain("is-pinned-col");
    expect(cells[2]).not.toContain("is-pinned-col");
  }
  const pins = findTags(pinAndWide, "mdmark-pin");
  expect(pins.map((tag) => /aria-pressed="true"/.test(tag))).toEqual([
    false,
    true,
    false,
    false,
    false,
  ]);
  // 検証: 真偽値の列
  expect(findTag(check, 'class="mdmark-table')).toContain('data-check="2"');
  const body = innerHtml(check, "<tbody");
  const checkCells =
    body.match(/<td\b[^>]*mdmark-align-center[^>]*>[\s\S]*?<\/td>/g) ?? [];
  expect(checkCells).toHaveLength(4);
  const [yes = "", no = ""] = checkCells;
  expect(yes).toContain('data-value="true"');
  expect(yes).toContain('class="mdmark-check"');
  expect(no).toContain('data-value="false"');
  expect(plainText(no)).toBe("いいえ");
  // 検証: 既定の列は文字のまま
  const defaults = body.match(/<td\b[^>]*data-label="既定"[^>]*>[^<]*/g) ?? [];
  expect(defaults.map((cell) => cell.replace(/^<td\b[^>]*>/, ""))).toEqual([
    "-",
    "全てオン",
    "jsDelivr",
    "-",
  ]);
});

// true を ✓、false をスクリーンリーダー向けのいいえにする（正常系）
test("test_render_check_cell", async () => {
  // 準備
  const { renderCheckCell } = await loadTable();
  // 実行
  const yes = renderCheckCell("true");
  const no = renderCheckCell("false");
  // 検証
  const mark = findTag(yes, "mdmark-check");
  expect(mark).toContain('role="img"');
  expect(mark).toContain('aria-label="はい"');
  expect(yes).toContain("<svg");
  expect(findTag(no, "<span")).toContain('class="mdmark-visually-hidden"');
  expect(plainText(no)).toBe("いいえ");
});

// つまみと目のアイコンを持つ一覧を今の列の順で返却する（正常系）
test("test_render_table_settings", async () => {
  // 準備
  const { renderTableSettings } = await loadTable();
  // 実行
  const html = renderTableSettings({
    id: "t1",
    columns: ["名前", "型", "既定", "説明"],
    order: [3, 0, 2, 1],
    hidden: [3],
    features: ["columns", "reorder"],
    groups: [undefined, undefined, undefined, undefined],
    pinned: 0,
  });
  // 検証
  expect(plainText(outerHtml(html, "mdmark-table-settings-title"))).toBe(
    "表示と並び順",
  );
  const items = findTags(html, "mdmark-table-settings-item");
  expect(items.map((tag) => /data-column="(\d+)"/.exec(tag)?.[1])).toEqual([
    "3",
    "0",
    "2",
    "1",
  ]);
  expect(findTags(html, "mdmark-table-settings-grip")).toHaveLength(4);
  const eyes = findTags(html, "mdmark-table-settings-eye");
  expect(eyes).toHaveLength(4);
  expect(eyes[0]).toContain('aria-pressed="true"');
  expect(eyes[0]).toContain('aria-label="「説明」を表示"');
  expect(eyes[1]).toMatch(/\sdisabled\b/);
  expect(eyes[2]).toContain('aria-label="「既定」を隠す"');
  expect(html).not.toMatch(/<div class="mdmark-table-settings"[^>]*\shidden\b/);
});

// `reorder` だけのときはタイトルが `並び順` で目のアイコンを配置しない（正常系）
test("test_render_table_settings_when_reorder_only", async () => {
  // 準備
  const { renderTableSettings } = await loadTable();
  // 実行
  const html = renderTableSettings({
    id: "t1",
    columns: ["名前", "型", "既定", "説明"],
    order: [0, 1, 2, 3],
    hidden: [],
    features: ["reorder"],
    groups: [undefined, undefined, undefined, undefined],
    pinned: 0,
  });
  // 検証
  expect(plainText(outerHtml(html, "mdmark-table-settings-title"))).toBe(
    "並び順",
  );
  expect(html).not.toContain("mdmark-table-settings-eye");
  expect(findTags(html, "mdmark-table-settings-grip")).toHaveLength(4);
});

// ピン止めと結合した見出しの範囲で一覧を分け、動かせないつまみを `disabled` にする（正常系）
test("test_render_table_settings_when_groups", async () => {
  // 準備
  const { renderTableSettings } = await loadTable();
  // 実行
  const html = renderTableSettings({
    id: "t1",
    columns: ["名前", "型", "既定", "必須", "備考"],
    order: [0, 1, 2, 3, 4],
    hidden: [],
    features: ["reorder"],
    groups: [undefined, "0:1", "0:1", "0:1", undefined],
    pinned: 1,
  });
  // 検証
  expect(findTags(html, "mdmark-table-settings-group")).toHaveLength(3);
  const grips = findTags(html, "mdmark-table-settings-grip");
  expect(grips).toHaveLength(5);
  expect(grips.map((tag) => /\sdisabled\b/.test(tag))).toEqual([
    true,
    false,
    false,
    false,
    true,
  ]);
});

// 深さの数の縦線と、配列の `[]`・必須の * を配置する（正常系）
test("test_render_tree_key_cell", async () => {
  // 準備
  const { renderTreeKeyCell } = await loadTable();
  // 実行
  const html = renderTreeKeyCell({
    name: "aliases[]",
    depth: 1,
    required: true,
  });
  // 検証
  expect(findTag(html, "<span")).toContain("mdmark-tree-cell");
  expect(findTags(html, "mdmark-tree-guide")).toHaveLength(1);
  expect(plainText(outerHtml(html, "mdmark-tree-name"))).toBe("aliases");
  expect(plainText(outerHtml(html, "mdmark-tree-array"))).toBe("[]");
  expect(findTags(html, "mdmark-tree-required")).toHaveLength(1);
  expect(html).not.toContain("mdmark-tree-toggle");
  expect(html).not.toContain("mdmark-tree-copy");
});

// 列挙はチップ、それ以外はバッジにする（正常系）
test("test_render_type_cell", async () => {
  // 準備
  const { renderTypeCell } = await loadTable();
  // 実行
  const badge = renderTypeCell("bool");
  const chips = renderTypeCell("ref | custom");
  const empty = renderTypeCell("");
  // 検証
  expect(badge).toBe(
    '<span class="mdmark-type-badge" data-type="bool">bool</span>',
  );
  const chipTags = findTags(chips, "mdmark-type-chip");
  expect(chipTags).toHaveLength(2);
  expect(plainText(chips).replace(/\s+/g, "")).toBe("refcustom");
  expect(empty).toBe("");
});

// 開閉・コピー・見本のボタンを返却する（正常系）
test("test_render_tree_tools", async () => {
  // 準備
  const { renderTreeTools } = await loadTable();
  // 実行
  const toggle = renderTreeTools({
    kind: "toggle",
    path: "aliases[]",
    expanded: false,
  });
  const copy = renderTreeTools({ kind: "copy" });
  const example = renderTreeTools({
    kind: "example",
    expanded: true,
    controls: "t-example",
  });
  // 検証
  const toggleTag = findTag(toggle, "<button");
  expect(toggleTag).toContain('aria-expanded="false"');
  expect(toggleTag).toContain('aria-label="aliases[] を開く"');
  expect(findTag(copy, "<button")).toContain('aria-label="全体のパスをコピー"');
  expect(findTag(example, "<button")).toContain('aria-controls="t-example"');
  expect(plainText(example).trim()).toBe("見本を隠す");
});

// 押した状態を `aria-pressed` に入れる（正常系）
test("test_render_raw_toggle", async () => {
  // 準備
  const { renderRawToggle } = await loadTable();
  // 実行
  const off = renderRawToggle(false);
  const on = renderRawToggle(true);
  // 検証
  expect(off).toContain(
    '<button class="mdmark-raw-toggle" type="button" aria-label="元の CSV を表示" aria-pressed="false">',
  );
  expect(on).toContain('aria-pressed="true"');
  expect(off).toContain("<svg");
  expect(off).toContain("</button>");
});

// resize の機能を持つ列の見出しに、列の幅のつまみを出す（正常系）
test("test_render_table_tools_when_resize", async () => {
  // 準備
  const { renderTableTools } = await loadTable();
  const options = { id: "t1", column: 0, label: "名前" };
  // 実行
  const withResize = renderTableTools({
    ...options,
    features: ["sort", "resize"],
  });
  const withoutResize = renderTableTools({ ...options, features: ["sort"] });
  // 検証
  expect(withResize.header).toMatch(
    /<\/span><span class="mdmark-col-resize" role="separator" aria-orientation="vertical" tabindex="0" aria-label="「名前」の列の幅"[^>]*><\/span>$/,
  );
  expect(withoutResize.header).not.toContain("mdmark-col-resize");
});

// 指定した列の幅を見出しのセルに入れ、ドラッグ中の列のつまみに印を付ける（正常系）
test("test_render_table_when_resized", async () => {
  // 準備
  const { renderTable } = await loadTable();
  // 実行（部品設計の ColumnResized と ResizeDragging）
  const html = renderTable({
    kind: "data",
    features: ["sort", "pin", "filter", "resize"],
    columns: ["名前", "説明", "更新日"],
    rows: [["りんご", "描画を速くする", "2026-10-01"]],
    widths: [{ column: 0, width: 200 }],
    resizing: 0,
  });
  // 検証
  const [firstHead] = findTags(html, "<th ");
  if (firstHead === undefined) {
    throw new Error("見出しのセルが無い");
  }
  expect(firstHead).toContain("width:200px");
  expect(firstHead).toContain("min-width:200px");
  expect(firstHead).toContain("--mdmark-column-min-width:200px");
  expect(firstHead).toContain("is-resized");
  const handles = html.match(/<span class="mdmark-col-resize[^"]*"/g) ?? [];
  expect(handles).toHaveLength(3);
  expect(handles[0]).toContain("is-dragging");
  expect(handles[1]).not.toContain("is-dragging");
});
