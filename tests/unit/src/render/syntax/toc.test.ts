import { expect, test } from "vitest";
import { outerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// h2 と h3 を入れ子にし、h4 は記載しない（正常系）
test("test_build_toc", () => {
  // 準備
  const markdown = [
    "<!-- toc -->",
    "",
    "## 導入",
    "",
    "### 前提",
    "",
    "#### 細目",
    "",
    "## 使用方法",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const toc = outerHtml(html, "mdmark-toc");
  expect(toc).toContain(
    '<li><a href="#導入">導入</a><ul><li><a href="#前提">前提</a></li></ul></li>',
  );
  expect(toc).toContain('<a href="#使用方法">使用方法</a>');
  expect(toc).not.toContain("細目");
  expect(html.indexOf("mdmark-toc")).toBeLessThan(html.indexOf('id="導入"'));
});
