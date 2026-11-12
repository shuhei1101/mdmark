import { expect, test } from "vitest";
import { findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 2 列の表 */
const TABLE = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";

// 範囲を囲み、`open` の `false` を `narrow` にする（正常系）
test("test_build_wide_ranges", () => {
  // 準備
  const markdown = [
    "<!-- wide -->",
    "",
    TABLE,
    "<!-- /wide -->",
    "",
    '<!-- wide: {"open": false} -->',
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

// 閉じのマーカーが無いと囲まずに警告する（異常系）
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

// 知らないキーは警告にせず無視する（正常系）
test("test_build_wide_ranges_when_unknown_keys", () => {
  // 準備
  const markdown = `<!-- wide: {"state": "narrow", "size": 2} -->\n\n${TABLE}\n<!-- /wide -->\n`;
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-syntax-warning");
  const ranges = findTags(html, "mdmark-wide-range");
  expect(ranges).toHaveLength(1);
  expect(ranges[0]).toContain('data-state="wide"');
  expect(warnings.map((warning) => warning.kind)).toEqual([
    "unknown_mark_arg",
    "unknown_mark_arg",
  ]);
  const messages = warnings.map((warning) => warning.message).join("\n");
  expect(messages).toContain("state");
  expect(messages).toContain("size");
});
