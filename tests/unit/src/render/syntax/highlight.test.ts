import { expect, test } from "vitest";
import { innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 空白で接する `==` と打ち消しは蛍光ペンにしない（正常系）
test("test_use_highlight", () => {
  // 準備
  const markdown =
    "==決め手== と ==例外=={color=green} と == a == と \\=\\=x\\=\\=\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<mark class="mdmark-highlight">決め手</mark>');
  expect(html).toContain(
    '<mark class="mdmark-highlight" data-color="green">例外</mark>',
  );
  expect(html).toContain("== a ==");
  expect(html).toContain("==x==");
  expect(html).not.toContain("{color=");
});

// 知らない色は既定の色で警告する（異常系）
test("test_use_highlight_when_unknown_color", () => {
  // 準備
  const markdown = "==決め手=={color=pink}\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<mark class="mdmark-highlight">決め手</mark>');
  expect(innerHtml(html, "mdmark-syntax-warning")).toContain("pink");
});
