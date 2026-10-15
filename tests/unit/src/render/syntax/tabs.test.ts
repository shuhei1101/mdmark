import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 見出しごとの中身に区切る（正常系）
test("test_build_tabs", () => {
  // 準備
  const markdown = [
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "macOS の手順",
    "",
    "### Windows",
    "",
    "Windows の手順",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html).toContain('<p class="mdmark-tab-title">macOS</p>');
  expect(html).toContain('<p class="mdmark-tab-title">Windows</p>');
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
  expect(html).toContain("macOS の手順");
  expect(html).toContain("Windows の手順");
  expect(html).not.toContain("<h3");
});

// 見出しの無い範囲は警告と中身にする（正常系）
test("test_build_tabs_when_no_heading", () => {
  // 準備
  const markdown = "<!-- tabs -->\n\n段落だけ\n\n<!-- /tabs -->\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("<p>段落だけ</p>");
  expect(html).not.toContain("mdmark-tabs");
});
