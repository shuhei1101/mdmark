import { expect, test } from "vitest";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

// 種類ごとに番号を付け、リンクの文字を番号にする（正常系）
test("test_number_figures", () => {
  // 準備
  const markdown = [
    "<!-- fig: arch -->",
    "",
    '![構成](a.png "全体の構成")',
    "",
    "<!-- fig: flow -->",
    "",
    "![流れ](b.png)",
    "",
    "<!-- fig: list -->",
    "",
    "| 列 |",
    "| --- |",
    "| x |",
    "",
    "[図](#fig-flow) と [表](#fig-list)",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("<b>図 1</b>全体の構成");
  expect(html).toContain("<b>図 2</b>");
  expect(html).toContain("<b>表 1</b>");
  for (const id of ["arch", "flow", "list"]) {
    expect(html).toContain(`id="fig-${id}"`);
  }
  expect(html).toContain('<a href="#fig-flow">図 2</a>');
  expect(html).toContain('<a href="#fig-list">表 1</a>');
});

// 切れた参照と重なった ID を警告にする（正常系）
test("test_number_figures_when_broken_or_duplicated", () => {
  // 準備
  const markdown = [
    "[図](#fig-missing)",
    "",
    "<!-- fig: arch -->",
    "",
    "![一つ目](a.png)",
    "",
    "<!-- fig: arch -->",
    "",
    "![二つ目](b.png)",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<a href="#fig-missing">図</a>');
  expect(
    matches(html, /class="mdmark-syntax-warning"/g).length,
  ).toBeGreaterThanOrEqual(2);
  expect(html).toContain("<b>図 2</b>");
  expect(matches(html, /id="fig-arch"/g)).toHaveLength(1);
});
