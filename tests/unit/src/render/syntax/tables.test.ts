import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
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
