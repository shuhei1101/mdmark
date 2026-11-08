import { expect, test } from "vitest";
import { findTag } from "../../helpers/html.ts";

/** mermaid の図の部品を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadPart = (): Promise<
  typeof import("../../../../src/parts/mermaid.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/parts/mermaid.ts",
      import.meta.url,
    ).href
  );

/** 今の配色の図の SVG */
const SVG = '<svg id="a" viewBox="0 0 200 100"><g></g></svg>';

/** 印刷のための明るい配色の図の SVG */
const PRINT_SVG = '<svg id="a-print" viewBox="0 0 200 100"><g></g></svg>';

// 印刷用の SVG があるときだけ並べる（正常系）
test("test_render_mermaid_diagram", async () => {
  // 準備
  const { renderMermaidDiagram } = await loadPart();
  // 実行
  const withPrint = renderMermaidDiagram({
    svg: SVG,
    printSvg: PRINT_SVG,
    width: 200,
    height: 100,
  });
  const withoutPrint = renderMermaidDiagram({
    svg: SVG,
    width: 200,
    height: 100,
  });
  // 検証
  const wrapper = findTag(withPrint.html, "<div");
  expect(wrapper).toContain('class="mdmark-mermaid mdmark-mermaid-has-print"');
  const svgAt = withPrint.html.indexOf('<svg id="a"');
  const printAt = withPrint.html.indexOf(
    '<div class="mdmark-mermaid-print" aria-hidden="true">',
  );
  expect(svgAt).toBeGreaterThan(-1);
  expect(printAt).toBeGreaterThan(svgAt);
  expect(withPrint.html.indexOf('<svg id="a-print"')).toBeGreaterThan(printAt);
  expect(withoutPrint.html).not.toContain("mdmark-mermaid-print");
  for (const body of [withPrint, withoutPrint]) {
    expect(body.width).toBe(200);
    expect(body.height).toBe(100);
    expect(body.tips).toBe("");
  }
});
