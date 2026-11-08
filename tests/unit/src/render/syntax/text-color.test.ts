import { expect, test } from "vitest";
import { innerHtml, plainText } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 角括弧の文字を文字の色の部品にする（正常系）
test("test_build_text_colors", () => {
  // 準備
  const markdown = "押す前に [決め手の 1 文]{color=blue} を読む。\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<span class="mdmark-color" data-color="blue">決め手の 1 文</span>',
  );
  expect(html).not.toContain("{color=");
  expect(html).not.toContain("[決め手");
});

// 角括弧の中の行内の Markdown を描く（正常系）
test("test_build_text_colors_when_nested", () => {
  // 準備
  const markdown = "[**重要** な文]{color=red}\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(innerHtml(html, 'class="mdmark-color"')).toBe(
    "<strong>重要</strong> な文",
  );
});

// リンクには当てない（正常系）
test("test_build_text_colors_when_link", () => {
  // 準備
  const markdown = "[資料](https://example.com){color=blue}\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<a href="https://example.com">資料</a>{color=blue}');
  expect(html).not.toContain("mdmark-color");
});

// 知らない色の名前は色を付けずに警告にする（異常系）
test("test_build_text_colors_when_unknown", () => {
  // 準備
  const markdown = "[決め手の 1 文]{color=pink}\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warningAt = html.indexOf('class="mdmark-syntax-warning"');
  const paragraphAt = html.indexOf("<p>決め手の 1 文</p>");
  expect(warningAt).toBeGreaterThanOrEqual(0);
  expect(paragraphAt).toBeGreaterThan(warningAt);
  const warning = plainText(innerHtml(html, 'class="mdmark-syntax-warning"'));
  expect(warning).toContain("pink");
  for (const name of [
    "blue",
    "red",
    "green",
    "yellow",
    "orange",
    "purple",
    "gray",
  ]) {
    expect(warning).toContain(name);
  }
  expect(html).not.toContain("mdmark-color");
});

// text-color がオフなら書いた文字のまま（正常系）
test("test_build_text_colors_when_feature_off", () => {
  // 準備
  const markdown = "[決め手]{color=blue}\n";
  // 実行
  const { html } = renderDoc(markdown, { "text-color": false });
  // 検証
  expect(html).toContain("<p>[決め手]{color=blue}</p>");
});
