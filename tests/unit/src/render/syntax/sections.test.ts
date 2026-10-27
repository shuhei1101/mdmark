import { expect, test } from "vitest";
import { findTag, findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// h2 と h3 の節を入れ子に囲み、closed の節も中身を隠さない（正常系）
test("test_wrap_sections", () => {
  // 準備
  const markdown = [
    "## A",
    "",
    "本文A",
    "",
    "### B",
    "",
    "本文B",
    "",
    "## C",
    "",
    "<!-- section: closed -->",
    "",
    "本文C",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(innerHtml(html, 'id="section-a"')).toContain('id="section-b"');
  expect(innerHtml(html, 'id="section-a"')).not.toContain('id="section-c"');
  const closed = findTag(html, 'id="section-c"');
  expect(closed).toContain('data-section="closed"');
  expect(closed).not.toMatch(/\shidden\b/);
});

// 知らない開閉の指定は警告を差し込み、開いた節にする（正常系）
test("test_wrap_sections_when_unknown_value", () => {
  // 準備
  const markdown = "## A\n\n<!-- section: hidden -->\n\n本文A\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTag(html, 'id="section-a"')).toContain('data-section="open"');
  expect(
    innerHtml(html, 'id="section-a"')
      .trimStart()
      .startsWith('<div class="mdmark-syntax-warning"'),
  ).toBe(true);
});

// sections がオフなら見出しに class を付けず、囲まない（正常系）
test("test_wrap_sections_when_feature_off", () => {
  // 準備
  const markdown = "## A\n\n本文A\n";
  // 実行
  const { html } = renderDoc(markdown, { sections: false });
  // 検証
  expect(html).not.toContain("mdmark-heading");
  expect(html).not.toContain("mdmark-section-body");
  expect(html).toContain('id="a"');
});

// タブの中身の中で開いた節を、その中身の終わりで閉じる（正常系）
test("test_wrap_sections_when_in_tab", () => {
  // 準備
  const markdown = [
    "## 導入",
    "",
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "#### macOS の注意",
    "",
    "macOS の段落",
    "",
    "### Windows",
    "",
    "#### Windows の注意",
    "",
    "Windows の段落",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const tabs = innerHtml(html, 'class="mdmark-tabs"');
  const panels = findTags(tabs, 'class="mdmark-tab-panel"');
  expect(panels).toHaveLength(2);
  expect(tabs.indexOf('id="section-windows-の注意"')).toBeGreaterThan(
    tabs.lastIndexOf('class="mdmark-tab-panel"'),
  );
  expect(innerHtml(tabs, 'class="mdmark-tab-panel"')).toContain(
    'id="section-macos-の注意"',
  );
  expect(innerHtml(tabs, 'class="mdmark-tab-panel"')).not.toContain(
    'id="section-windows-の注意"',
  );
  expect(innerHtml(html, 'id="section-導入"')).toContain('class="mdmark-tabs"');
});
