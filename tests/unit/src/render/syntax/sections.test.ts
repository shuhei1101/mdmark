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

// h1 の節も囲み、h2 の節をその入れ子にする（正常系）
test("test_wrap_sections_when_h1", () => {
  // 準備
  const markdown = [
    "# 手引き",
    "",
    "手引きの段落",
    "",
    "## 導入",
    "",
    "導入の段落",
    "",
    "# 付録",
    "",
    "付録の段落",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTag(html, '<h1 class="mdmark-heading"')).toContain('id="手引き"');
  expect(innerHtml(html, 'id="section-手引き"')).toContain('id="section-導入"');
  expect(innerHtml(html, 'id="section-手引き"')).not.toContain(
    'id="section-付録"',
  );
  expect(html).toContain('id="section-付録"');
});

// 知らない開閉の指定は読み飛ばし、開いた節にする（正常系）
test("test_wrap_sections_when_unknown_value", () => {
  // 準備
  const markdown = "## A\n\n<!-- section: hidden -->\n\n本文A\n";
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(findTag(html, 'id="section-a"')).toContain('data-section="open"');
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(warnings.map((warning) => warning.kind)).toEqual(["unknown_mark_arg"]);
  expect(warnings[0]?.message).toContain("hidden");
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

// 取り込みの枠の中の見出しは、枠の外の同じ階層の節を閉じず、枠の終わりで閉じる（正常系）
test("test_wrap_sections_when_in_include", () => {
  // 準備
  const markdown = [
    "## 航海",
    "",
    "<!-- include: 共通/手順.md#実行 -->",
    "",
    "後の段落",
    "",
  ].join("\n");
  const includes = {
    "共通/手順.md": "## 準備\n\n準備の段落\n\n## 実行\n\n実行の段落\n",
  };
  // 実行
  const { html } = renderDoc(markdown, {}, { includes });
  // 検証
  const voyage = innerHtml(html, 'id="section-航海"');
  expect(voyage).toContain('class="mdmark-include"');
  const included = innerHtml(voyage, 'class="mdmark-include"');
  expect(included).toContain('id="section-実行"');
  expect(innerHtml(included, 'id="section-実行"')).toContain("実行の段落");
  expect(voyage).toContain("後の段落");
  expect(included).not.toContain("後の段落");
});

// タブの中身の中の見出しは、タブの外の同じ階層の節を閉じない（正常系）
test("test_wrap_sections_when_same_level_heading_in_tab", () => {
  // 準備
  const markdown = [
    "## 導入",
    "",
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "## 手順",
    "",
    "手順の段落",
    "",
    "### Windows",
    "",
    "Windows の段落",
    "",
    "<!-- /tabs -->",
    "",
    "後の段落",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const intro = innerHtml(html, 'id="section-導入"');
  expect(intro).toContain('class="mdmark-tabs"');
  const firstPanel = innerHtml(intro, 'class="mdmark-tab-panel"');
  expect(firstPanel).toContain('id="section-手順"');
  expect(innerHtml(firstPanel, 'id="section-手順"')).toContain("手順の段落");
  expect(intro).toContain("後の段落");
});
