import { expect, test } from "vitest";
import { findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 2 列の表 */
const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";

// 範囲を囲み、`closed` を `narrow` にする（正常系）
test("test_build_wide_ranges", () => {
  // 準備
  const markdown = [
    "<!-- wide -->",
    "",
    TABLE,
    "<!-- /wide -->",
    "",
    "<!-- wide: closed -->",
    "",
    TABLE,
    "<!-- /wide -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const ranges = findTags(html, "mdmark-wide-range");
  expect(ranges).toHaveLength(2);
  expect(ranges[0]).toContain('data-state="wide"');
  expect(ranges[1]).toContain('data-state="narrow"');
  expect(innerHtml(html, "mdmark-wide-range")).toContain("<table");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("<!--");
});

// 閉じの印が無いと囲まずに警告する（異常系）
test("test_build_wide_ranges_when_unclosed", () => {
  // 準備
  const markdown = `<!-- wide -->\n\n${TABLE}`;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-wide-range");
  expect(innerHtml(html, "mdmark-syntax-warning")).toContain(
    "&lt;!-- /wide --&gt;",
  );
});
