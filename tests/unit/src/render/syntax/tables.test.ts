import { expect, test } from "vitest";
import { findTags, matches } from "../../../helpers/html.ts";
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
