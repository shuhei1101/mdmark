import { expect, test } from "vitest";
import { findTags, matches, outerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTables = () => import("../../../../../src/render/syntax/tables.ts");

// 種類・機能・絞り込み・折り畳みを読む（正常系）
test("test_read_table_spec", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const args = {
    args: ["data", "-sort", "closed"],
    keys: { filter: "名前,更新日:date" },
  };
  // 実行
  const spec = readTableSpec(args, ["名前", "値", "更新日"]);
  // 検証
  expect(spec).toEqual({
    kind: "data",
    features: ["pin", "filter"],
    filters: [
      { column: 0, kind: "select" },
      { column: 2, kind: "date" },
    ],
    collapse: "closed",
    warnings: [],
    hide: [],
    totals: [],
  });
});

// 読めない指定を警告にし、読めた指定を当てる（正常系）
test("test_read_table_spec_when_unknown", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const args = {
    args: ["unknown", "+sort", "+foo", "closed", "open"],
    keys: { size: "2", filter: "無い列,名前:range" },
  };
  // 実行
  const spec = readTableSpec(args, ["名前", "値"]);
  // 検証
  expect(spec.kind).toBe("default");
  expect(spec.features).toEqual(["pin", "sort"]);
  expect(spec.filters).toEqual([]);
  expect(spec.collapse).toBe("closed");
  const labels = spec.warnings.map((warning) => warning.label);
  expect(labels).toHaveLength(6);
  expect(labels).toEqual(
    expect.arrayContaining([
      "unknown",
      "+foo",
      "size=",
      "無い列",
      "range",
      "closed と open",
    ]),
  );
});

// 5 つの機能と hide=・total= を読む（正常系）
test("test_read_table_spec_when_features", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const args = {
    args: ["data", "+count", "+columns", "+total", "+copy", "+rowlink"],
    keys: { hide: "説明", total: "数量:sum,名前:count" },
  };
  // 実行
  const spec = readTableSpec(args, ["名前", "説明", "数量"]);
  // 検証
  expect(spec.features).toEqual([
    "sort",
    "pin",
    "filter",
    "count",
    "columns",
    "total",
    "copy",
    "rowlink",
  ]);
  expect(spec.hide).toEqual([1]);
  expect(spec.totals).toEqual([
    { column: 2, calc: "sum" },
    { column: 0, calc: "count" },
  ]);
  expect(spec.warnings).toEqual([]);
});

// 読めない集計・隠す列と機能の無い表のキーを警告にして当てない（正常系）
test("test_read_table_spec_when_feature_keys_invalid", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const headers = ["名前", "数量", "単価"];
  const invalid = {
    args: ["data", "+total", "+columns"],
    keys: { total: "数量:max,価格:sum,単価:avg", hide: "備考,名前" },
  };
  const withoutFeatures = {
    args: ["data"],
    keys: { total: "数量:sum", hide: "単価" },
  };
  // 実行
  const first = readTableSpec(invalid, headers);
  const second = readTableSpec(withoutFeatures, headers);
  // 検証: 読めない集計と隠す列
  expect(first.totals).toEqual([{ column: 2, calc: "avg" }]);
  expect(first.hide).toEqual([]);
  const firstLabels = first.warnings.map((warning) => warning.label);
  expect(firstLabels).toHaveLength(4);
  expect(firstLabels).toEqual(
    expect.arrayContaining(["max", "価格", "備考", "名前"]),
  );
  const headColumn = first.warnings.find((warning) => warning.label === "名前");
  expect(headColumn?.message).toContain("`名前`");
  expect(headColumn?.message).toContain("先頭の列");
  // 検証: 機能の無い表のキー
  expect(second.totals).toEqual([]);
  expect(second.hide).toEqual([]);
  const secondLabels = second.warnings.map((warning) => warning.label);
  expect(secondLabels).toHaveLength(2);
  expect(secondLabels).toEqual(expect.arrayContaining(["total=", "hide="]));
});

// 見出しと前の行に重ならない ID を作る（正常系）
test("test_row_id_of", async () => {
  // 準備
  const { rowIdOf } = await loadTables();
  const taken = new Set(["みかん", "みかん-1"]);
  // 実行
  const ids = ["りんご", "みかん", "みかん"].map((text) =>
    rowIdOf(text, taken),
  );
  // 検証
  expect(ids).toEqual(["りんご", "みかん-2", "みかん-3"]);
});

// 文字から ID が作れないときは row を元にする（正常系）
test("test_row_id_of_when_empty", async () => {
  // 準備
  const { rowIdOf } = await loadTables();
  const taken = new Set<string>();
  // 実行
  const ids = ["!!!", ""].map((text) => rowIdOf(text, taken));
  // 検証
  expect(ids).toEqual(["row", "row-1"]);
});

// 表の印の表を指定どおりに囲み、囲まない表を default にする（正常系）
test("test_decorate_tables", () => {
  // 準備
  const markdown = [
    "<!-- table: data filter=名前 closed -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
    "| 列 |",
    "| --- |",
    "| x |",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    'data-kind="data" data-features="sort pin filter" data-filter="0:select"',
  );
  expect(html).toContain('<details class="mdmark-table-details">');
  expect(html).toContain('data-kind="default" data-features="pin"');
});

// 閉じの印が無いときは文書の終わりまでの表に当て、警告を差し込む（正常系）
test("test_decorate_tables_when_range_not_closed", () => {
  // 準備
  const markdown = [
    "<!-- table: data -->",
    "",
    "| 列 |",
    "| --- |",
    "| x |",
    "",
    "| 別の列 |",
    "| --- |",
    "| y |",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /data-kind="data"/g)).toHaveLength(2);
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("&lt;!-- /table --&gt;");
});

// 5 つの機能と hide=・total= を属性に写し、行に ID とリンクを付ける（正常系）
test("test_decorate_tables_when_features", () => {
  // 準備
  const markdown = [
    "## みかん",
    "",
    "<!-- table: data +count +columns +total +copy +rowlink hide=説明 total=数量:sum -->",
    "",
    "| 名前 | 説明 | 数量 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 1 |",
    "| みかん | 印刷を直す | 2 |",
    "| みかん | 描画の崩れを直す | 3 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 囲みの属性
  expect(html).toContain(
    'data-features="sort pin filter count columns total copy rowlink"',
  );
  expect(html).toContain('data-hide="1"');
  expect(html).toContain('data-total="2:sum"');
  // 検証: 行の ID（見出しの ID `みかん` と重ならない）
  const rowIds = findTags(html, "<tr")
    .map((tag) => /\sid="([^"]*)"/.exec(tag)?.[1])
    .filter((id) => id !== undefined);
  expect(rowIds).toEqual(["りんご", "みかん-1", "みかん-2"]);
  // 検証: 先頭のセルの行へのリンク
  const hrefs = findTags(html, "mdmark-row-anchor").map(
    (tag) => /\shref="([^"]*)"/.exec(tag)?.[1],
  );
  expect(hrefs).toEqual(["#りんご", "#みかん-1", "#みかん-2"]);
});

// 集計する列の数として読めないセルを、列と計算ごとの警告にして表の上に差し込む（異常系）
test("test_decorate_tables_when_total_unreadable", () => {
  // 準備
  const markdown = [
    "<!-- table: data +total total=数量:sum,数量:avg,数量:count -->",
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 12 |",
    "| b | 約3 |",
    "| c |  |",
    "| d | - |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 警告は合計と平均の 2 つで、どちらも表の前にある
  expect(matches(html, /<div class="mdmark-syntax-warning"/g)).toHaveLength(2);
  const table = html.indexOf('<div class="mdmark-table"');
  expect(table).toBeGreaterThan(0);
  expect(html.lastIndexOf("mdmark-syntax-warning")).toBeLessThan(table);
  // 検証: 読めない値は行内のコードで並び、計算の名前を書く
  const message = (calc: string): string =>
    `「数量」の列に数として読めない値 <code>約3</code>・<code>-</code> があるため、${calc}を出していません。数を書くか、セルを空にしてください。`;
  expect(html).toContain(message("合計"));
  expect(html).toContain(message("平均"));
  // 検証: count の警告は無い
  expect(html).not.toContain("件数を出していません");
});

// 数として読めないセルが無ければ警告を差し込まない（正常系）
test("test_decorate_tables_when_total_readable", () => {
  // 準備
  const markdown = [
    "<!-- table: data +total total=数量:sum,数量:avg -->",
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 1,000 |",
    "| b |  |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-syntax-warning");
});

// table がオフなら今の表のままにする（正常系）
test("test_decorate_tables_when_feature_off", () => {
  // 準備
  const markdown = "## 変数\n\n| 列 |\n| --- |\n| x |\n";
  // 実行
  const { html } = renderDoc(markdown, { table: false });
  // 検証
  expect(html).toMatch(/<table tabindex="0" aria-label="[^"]*">/);
  expect(html).not.toContain("mdmark-table");
});

// 折り畳みの見出しを読み、closed も open も無い title= を警告にする（正常系）
test("test_read_table_spec_when_title", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  // 実行
  const titled = readTableSpec(
    { args: ["data", "closed"], keys: { title: "リリースの一覧" } },
    ["名前"],
  );
  const alone = readTableSpec({ args: ["data"], keys: { title: "一覧" } }, [
    "名前",
  ]);
  // 検証
  expect(titled.collapse).toBe("closed");
  expect(titled.title).toBe("リリースの一覧");
  expect(titled.warnings).toEqual([]);
  expect(alone.collapse).toBe("none");
  expect(alone.title).toBeUndefined();
  expect(alone.warnings.map((warning) => warning.label)).toEqual(["title="]);
});

// 折り畳みの見出しを title= か本文の行の数にする（正常系）
test("test_decorate_tables_when_collapse_title", () => {
  // 準備
  const markdown = [
    "<!-- table: data closed -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- table: data open title=リリースの一覧 -->",
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="mdmark-table-details"><summary>表（3 行）</summary>',
  );
  expect(html).toContain(
    '<details class="mdmark-table-details" open><summary>リリースの一覧</summary>',
  );
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 行の詳細の中に表を置いても、親の表の行を全て親の表の囲みに残し、列名・行の数・行へのリンク・集計を親の表の行だけで付ける（正常系）
test("test_decorate_tables_when_row_detail_has_table", () => {
  // 準備
  const markdown = [
    "<!-- table: data closed +rowlink +total total=数量:sum -->",
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| Todo | 1 |",
    "| Done | 2 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の囲みの外に行が出ない
  const parent = outerHtml(html, 'data-kind="data"');
  expect(html.slice(html.indexOf(parent) + parent.length)).not.toContain("<tr");
  // 検証: 親の行のセルの列名が親の表の見出しになり、行の数と行へのリンクが親の行だけになる
  const parentTable = outerHtml(parent, "<table ");
  expect(parentTable).toContain('<td data-label="数量">2</td>');
  expect(matches(parentTable, /data-label="名前"/g)).toHaveLength(2);
  expect(matches(parentTable, /data-label="数量"/g)).toHaveLength(2);
  expect(parent).toContain("<summary>表（2 行）</summary>");
  expect(findTags(parentTable, 'id="todo"')).toHaveLength(1);
  expect(findTags(parentTable, 'id="done"')).toHaveLength(1);
  // 検証: 詳細の行の中の表は既定の種類の囲みに入り、中の表の見出しで列名を付け、行のリンクを持たない
  const nested = outerHtml(parentTable, 'data-kind="default"');
  expect(matches(nested, /data-label="引数"/g)).toHaveLength(1);
  expect(matches(nested, /data-label="値"/g)).toHaveLength(1);
  expect(findTags(nested, "<tr").filter((tag) => tag.includes(" id="))).toEqual(
    [],
  );
  // 検証: 数として読めない値の警告が無い
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 表の印の外の表でも、行の詳細の中の表の後ろの親の行を親の表の囲みに残す（正常系）
test("test_decorate_tables_when_row_detail_has_table_without_mark", () => {
  // 準備
  const markdown = [
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| Todo | a |",
    "| Done | b |",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の表が既定の種類の囲みに入り、Done の行が親の表の中にある
  const parent = outerHtml(html, 'data-kind="default"');
  expect(html.slice(html.indexOf(parent) + parent.length)).not.toContain("<tr");
  const parentTable = outerHtml(parent, "<table ");
  expect(parentTable).toContain('<td data-label="説明">b</td>');
  expect(matches(parentTable, /data-label="名前"/g)).toHaveLength(2);
  expect(matches(parentTable, /data-label="説明"/g)).toHaveLength(2);
});

// 行の詳細の中の表には、その表を囲む表の印だけを当て、外の表の印の指定を当てない（正常系）
test("test_decorate_tables_when_row_detail_has_marked_table", () => {
  // 準備
  const markdown = [
    "<!-- table: data filter=名前 -->",
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| Todo | a |",
    "| Done | b |",
    "",
    "<!-- /table -->",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "<!-- table: plain -->",
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /table -->",
    "",
    "<!-- /row-detail -->",
    "",
    "<!-- row-detail: 2 -->",
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| mode | fast |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の表は外の表の印、1 つ目の中の表は中の印、2 つ目の中の表は既定の種類になる
  const wrappers = findTags(html, 'class="mdmark-table"');
  expect(wrappers).toHaveLength(3);
  expect(wrappers[0]).toContain('data-kind="data"');
  expect(wrappers[0]).toContain('data-filter="0:select"');
  expect(wrappers[1]).toContain('data-kind="plain"');
  expect(wrappers[2]).toContain('data-kind="default"');
  expect(wrappers[2]).not.toContain("data-filter");
  // 検証: 書き方の警告が無く、表の印のコメントが出力に残らない
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<!-- table");
  expect(html).not.toContain("<!-- /table");
});

// 列の強調と行の色を属性にする（正常系）
test("test_decorate_tables_when_colors", () => {
  // 準備
  const markdown = [
    "<!-- table: data highlight=金額 row-color=状態:完了=green row-at=2=red -->",
    "",
    "| 名前 | 状態 | 金額 |",
    "| --- | --- | --- |",
    "| a | 完了 | 100 |",
    "| b | 保留 | 200 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 金額の列の見出しと 2 つのセル
  const highlighted = findTags(html, "mdmark-col-highlight");
  expect(highlighted.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(highlighted.filter((tag) => tag.startsWith("<td"))).toHaveLength(2);
  for (const tag of highlighted) {
    expect(tag).toContain('data-color="blue"');
  }
  // 検証: 本文の行の色
  const rows = matches(html, /<tr\b[^>]*data-color="[a-z]+"[^>]*>/g);
  expect(rows.map((row) => /data-color="([a-z]+)"/.exec(row)?.[1])).toEqual([
    "green",
    "red",
  ]);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 列の強調と、値と位置の行の色を読む（正常系）
test("test_read_table_colors", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const args = {
    args: ["data"],
    keys: {
      highlight: "金額",
      "row-color": "状態:完了=green,保留=yellow",
      "row-at": "3=red",
    },
  };
  const cells = [
    ["a", "完了", "1"],
    ["b", "保留", "2"],
    ["c", "未着手", "3"],
  ];
  // 実行
  const colors = readTableColors(args, ["名前", "状態", "金額"], cells);
  // 検証
  expect(colors.highlight).toEqual([{ column: 2, color: "blue" }]);
  expect(colors.rows).toEqual(["green", "yellow", "red"]);
  expect(colors.warnings).toEqual([]);
});

// 両方が当たる行は row-at= の色にし、範囲を読む（正常系）
test("test_read_table_colors_when_overlap", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const args = {
    args: ["data"],
    keys: {
      highlight: "名前:red,金額",
      "row-color": "状態:完了=green",
      "row-at": "1-2=gray",
    },
  };
  const cells = [
    ["a", "完了", "1"],
    ["b", "完了", "2"],
    ["c", "完了", "3"],
  ];
  // 実行
  const colors = readTableColors(args, ["名前", "状態", "金額"], cells);
  // 検証
  expect(colors.highlight).toEqual([
    { column: 0, color: "red" },
    { column: 2, color: "blue" },
  ]);
  expect(colors.rows).toEqual(["gray", "gray", "green"]);
});

// 読めない指定を警告にして当てない（異常系）
test("test_read_table_colors_when_unreadable", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const args = {
    args: ["data"],
    keys: {
      highlight: "無い列",
      "row-color": "状態:完了=pink,保留",
      "row-at": "9=red",
    },
  };
  const cells = [
    ["a", "完了"],
    ["b", "保留"],
  ];
  // 実行
  const colors = readTableColors(args, ["名前", "状態"], cells);
  // 検証
  expect(colors.highlight).toEqual([]);
  expect(colors.rows).toEqual([null, null]);
  const labels = colors.warnings.map((warning) => warning.label);
  expect(labels).toHaveLength(4);
  expect(labels).toEqual(
    expect.arrayContaining(["無い列", "pink", "保留", "9"]),
  );
});
