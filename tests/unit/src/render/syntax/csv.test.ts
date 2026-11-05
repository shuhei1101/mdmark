import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** CSV の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCsv = () => import("../../../../../src/render/syntax/csv.ts");

// 引用符の中の区切り・改行・`""` を読む（正常系）
test("test_parse_csv", async () => {
  // 準備
  const { parseCsv } = await loadCsv();
  // 実行
  const rows = parseCsv('a,"b, c","d""e"\r\nx,"y\nz",1\n');
  // 検証
  expect(rows).toEqual([
    ["a", "b, c", 'd"e'],
    ["x", "y\nz", "1"],
  ]);
});

// 空の値を残す（正常系）
test("test_parse_csv_when_empty_values", async () => {
  // 準備
  const { parseCsv } = await loadCsv();
  // 実行
  const rows = parseCsv("a,,c\n,\n");
  // 検証
  expect(rows).toEqual([
    ["a", "", "c"],
    ["", ""],
  ]);
});

// csv だけを表にし、元の CSV を添える（正常系）
test("test_build_csv_tables", () => {
  // 準備
  const markdown = [
    "<!-- table: data -->",
    "",
    "```csv",
    "名前,値",
    "a,1",
    "```",
    "",
    "<!-- /table -->",
    "",
    "```csv",
    "名前,値",
    "b,2",
    "```",
    "",
    "```text",
    "名前,値",
    "```",
    "",
    "```csv",
    "```",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const tables = findTags(html, 'data-source="csv"');
  expect(tables).toHaveLength(2);
  expect(tables[0]).toContain('data-kind="data"');
  expect(tables[1]).toContain('data-kind="default"');
  const raws = findTags(html, 'class="mdmark-raw"');
  expect(raws).toHaveLength(2);
  expect(raws[0]).toContain("hidden");
  expect(innerHtml(html, 'class="mdmark-raw"')).toContain("名前,値");
  expect(html).toContain("language-text");
  expect(findTags(html, "<pre")).toHaveLength(4);
});

// 列の数を見出しにそろえて警告する（異常系）
test("test_build_csv_tables_when_columns_mismatch", () => {
  // 準備
  const markdown = ["```csv", "a,b,c", "1,2", "1,2,3,4", "```", ""].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = innerHtml(html, "mdmark-syntax-warning");
  expect(warning).toContain("2");
  expect(warning).toContain("3");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf(findTag(html, 'data-source="csv"')),
  );
  const rows = innerHtml(html, "<tbody").split("<tr").slice(1);
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.split("<td")).toHaveLength(4);
  }
  expect(rows[0]).toMatch(/<td[^>]*><\/td>/);
});
