import { expect, test } from "vitest";
import { findTag, innerHtml } from "../../../helpers/html.ts";
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
