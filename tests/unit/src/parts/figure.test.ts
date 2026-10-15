import { expect, test } from "vitest";

/** 図表の番号の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFigure = () => import("../../../../src/parts/figure.ts");

// 画像は題を下、表は題を上に置く（正常系）
test("test_render_figure", async () => {
  // 準備
  const { renderFigure } = await loadFigure();
  const image = '<img src="a.png" alt="構成">';
  const table = "<table></table>";
  // 実行
  const imageHtml = renderFigure({
    kind: "image",
    id: "arch",
    number: 1,
    caption: "全体の構成",
    body: image,
  });
  const tableHtml = renderFigure({
    kind: "table",
    id: "list",
    number: 1,
    body: table,
  });
  // 検証
  expect(imageHtml.startsWith('<figure class="mdmark-figure"')).toBe(true);
  expect(imageHtml).toContain('id="fig-arch"');
  const caption =
    '<figcaption class="mdmark-figure-caption"><b>図 1</b>全体の構成</figcaption>';
  expect(imageHtml).toContain(caption);
  expect(imageHtml.indexOf(image)).toBeLessThan(imageHtml.indexOf(caption));
  expect(tableHtml).toContain("<b>表 1</b>");
  expect(tableHtml.indexOf("<b>表 1</b>")).toBeLessThan(
    tableHtml.indexOf(table),
  );
});
