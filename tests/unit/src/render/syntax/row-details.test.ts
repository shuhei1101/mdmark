import { expect, test } from "vitest";
import { matches, outerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 3 行の表 */
const TABLE = [
  "| 名前 | 値 |",
  "| --- | --- |",
  "| a | 1 |",
  "| b | 2 |",
  "| c | 3 |",
  "",
].join("\n");

// 詳細を指定の行の直後に入れる（正常系）
test("test_attach_row_details", () => {
  // 準備
  const markdown = `${TABLE}\n<!-- row-detail: 2 -->\n\n詳細の段落\n\n<!-- /row-detail -->\n`;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toMatch(
    /b<\/td>\s*<td[^>]*>2<\/td>\s*<\/tr>\s*<tr class="mdmark-row-detail" data-row="2"[^>]*><td colspan="2">\s*<p>詳細の段落<\/p>/,
  );
  expect(html.slice(html.indexOf("</table>"))).not.toContain("詳細の段落");
  expect(matches(html, /mdmark-row-detail/g)).toHaveLength(1);
});

// 表に無い行は警告を差し込み、中身を表の後に残す（正常系）
test("test_attach_row_details_when_row_missing", () => {
  // 準備
  const markdown = `${TABLE}\n<!-- row-detail: 5 -->\n\n詳細の段落\n\n<!-- /row-detail -->\n`;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = outerHtml(html, "mdmark-syntax-warning");
  expect(warning).toContain("5");
  expect(warning).toContain("3");
  expect(html).not.toContain("mdmark-row-detail");
  expect(html.indexOf("詳細の段落")).toBeGreaterThan(html.indexOf("</table>"));
});
