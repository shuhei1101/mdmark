import { expect, test } from "vitest";
import { findTag, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** details の範囲の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDetails = () => import("../../../../../src/render/syntax/details.ts");

// タイトルと開閉を適用する（正常系）
test("test_build_details_ranges", () => {
  // 準備
  const markdown = [
    '<!-- details: {"title": "補足"} -->',
    "",
    "中身 A",
    "",
    "<!-- /details -->",
    "",
    '<!-- details: {"title": "実行の例", "open": true} -->',
    "",
    "中身 B",
    "",
    "<!-- /details -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>補足</summary>',
  );
  expect(findTag(html, 'mdmark-collapsible" open')).toBeDefined();
  expect(html).toContain("<summary>実行の例</summary>");
  expect(innerHtml(html, "mdmark-collapsible")).toContain("中身 A");
});

// 閉じのマーカーが無いと囲まずに警告する（異常系）
test("test_build_details_ranges_when_unclosed", () => {
  // 準備
  const markdown = '<!-- details: {"title": "補足"} -->\n\n段落\n';
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("<details");
  expect(innerHtml(html, "mdmark-syntax-warning")).toContain(
    "&lt;!-- /details --&gt;",
  );
  expect(html).toContain("段落");
});

// タイトルと開閉を読み込む（正常系）
test("test_read_details_options", async () => {
  // 準備
  const { readDetailsOptions } = await loadDetails();
  // 実行
  const results = [
    { title: "補足" },
    { title: "実行の例", open: true },
    {},
  ].map((options) => readDetailsOptions(options));
  // 検証
  expect(results).toEqual([
    { title: "補足", open: false },
    { title: "実行の例", open: true },
    { title: "詳細", open: false },
  ]);
});
