import { expect, test } from "vitest";
import { parseWithRules } from "../../../helpers/core-rules.ts";
import { matches, outerHtml } from "../../../helpers/html.ts";
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

// fig を付けた表の行の詳細に表があっても、親の表の全ての行を図表の囲みに入れる（正常系）
test("test_number_figures_when_table_has_nested_table", () => {
  // 準備
  const markdown = [
    "<!-- fig: list -->",
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| Todo | a |",
    "| Done | b |",
    "",
    "<!-- row-detail: 1 -->",
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  for (const table of [true, false]) {
    // 実行
    const { html } = renderDoc(markdown, { table });
    // 検証: 図表の囲みの後ろに行が出ず、Done の行が囲みの中にある
    const figure = outerHtml(html, 'class="mdmark-figure"');
    expect(html.slice(html.indexOf(figure) + figure.length)).not.toContain(
      "<tr",
    );
    expect(figure).toContain('<td data-label="名前">Done</td>');
    // 検証: 番号は親の表の 1 つだけで、中の表に番号を付けない
    expect(matches(html, /<b>表 \d+<\/b>/g)).toEqual(["<b>表 1</b>"]);
  }
});

/** 図表の番号の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFigures = () => import("../../../../../src/render/syntax/figures.ts");

/** 画像の属性の処理を読み込む */
const loadImages = () => import("../../../../../src/render/syntax/images.ts");

// fig の画像を画像の図にし、ギャラリーに番号を渡す（正常系）
test("test_number_figures_when_image_figure", async () => {
  // 準備
  const { numberFigures } = await loadFigures();
  const { readImages } = await loadImages();
  const markdown = [
    "<!-- fig: arch -->",
    "",
    '![構成](arch.png "全体"){width=300}',
    "",
    "<!-- fig: shots -->",
    "",
    "<!-- gallery: cols=2 -->",
    "",
    '![開く](open.png "開く")',
    "",
    "<!-- /gallery -->",
    "",
    "[図](#fig-shots)",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  const tokens = parseWithRules(markdown, [readImages, numberFigures]);
  // 検証
  expect(html).toContain(
    '<figure class="mdmark-figure mdmark-image" id="fig-arch" style="--mdmark-image-width: 300px">',
  );
  expect(html).toContain("<b>図 1</b>全体");
  const gallery = tokens.find(
    (token) =>
      token.type === "mdmark_mark" &&
      token.meta?.name === "gallery" &&
      !token.meta?.closing,
  );
  expect(gallery?.meta?.figure).toEqual({ id: "shots", number: 2 });
  expect(html).toContain('<a href="#fig-shots">図 2</a>');
});
