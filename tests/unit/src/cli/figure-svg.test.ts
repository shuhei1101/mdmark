import { join } from "node:path";
import { expect, test } from "vitest";
import { render } from "../../../../src/render/index.ts";
import { INQUIRY_COUNT_TEXT } from "../../helpers/charts.ts";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";
import { wrapDirective } from "../../helpers/diagrams.ts";

/** SVG にする処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFigureSvg = () => import("../../../../src/cli/figure-svg.ts");

const createTempDir = useTempDirs();

/** 短くした配布物の CSS */
const CSS = ".mdmark-chart { color: red; }\n.mdmark-table { color: blue; }\n";

/** 1x1 の透明な PNG */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);

/** SVG の href・src・url( の値を並べる */
function references(svg: string): string[] {
  const attributes = [...svg.matchAll(/\s(?:href|src)="([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
  const urls = [...svg.matchAll(/url\(\s*['"]?([^'")]*)/g)].map(
    (match) => match[1] ?? "",
  );
  return [...attributes, ...urls];
}

// chart の svg を取り出し、外を参照しない（正常系）
test("test_figure_to_svg_chart", async () => {
  // 準備
  const { figureToSvg } = await loadFigureSvg();
  const html = render(wrapDirective("chart", INQUIRY_COUNT_TEXT));
  const dir = await createTempDir();
  // 実行
  const { svg } = await figureToSvg({
    figure: { kind: "chart", index: 1, html, title: undefined, legend: [] },
    css: CSS,
    baseDir: dir,
  });
  // 検証
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg).toContain("viewBox=");
  for (const reference of references(svg)) {
    expect(reference.startsWith("data:") || reference.startsWith("#")).toBe(
      true,
    );
  }
});

// 埋め込んだ HTML を foreignObject に包み、画像を埋める（正常系）
test("test_figure_to_svg_html_foreign_object", async () => {
  // 準備
  const { figureToSvg } = await loadFigureSvg();
  const dir = await createTempDir();
  await writeFiles(dir, { "pic.png": PNG });
  const html =
    '<div class="mdmark-html"><table><tr><td>セル</td></tr></table><img src="pic.png" alt="a"><img src="https://example.com/b.png" alt="b"></div>';
  // 実行
  const { svg, warnings } = await figureToSvg({
    figure: { kind: "html", index: 1, html, title: undefined, legend: [] },
    css: CSS,
    baseDir: dir,
  });
  // 検証
  expect(svg).toContain("<foreignObject");
  expect(svg).toContain('src="data:image/png');
  expect(svg).not.toContain("https://example.com/b.png");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("https://example.com/b.png");
});

// 小文字にされた属性名を戻す（正常系）
test("test_figure_to_svg_restores_case", async () => {
  // 準備
  const { figureToSvg } = await loadFigureSvg();
  const html =
    '<div class="mdmark-chart"><svg viewbox="0 0 10 10"><defs><pattern id="p" patternunits="userSpaceOnUse" width="2" height="2"></pattern></defs></svg></div>';
  // 実行
  const { svg } = await figureToSvg({
    figure: { kind: "chart", index: 1, html, title: undefined, legend: [] },
    css: CSS,
    baseDir: join("/", "tmp"),
  });
  // 検証
  expect(svg).toContain('viewBox="0 0 10 10"');
  expect(svg).toContain('patternUnits="userSpaceOnUse"');
  expect(svg).not.toContain("viewbox=");
  expect(svg).not.toContain("patternunits=");
});

// 図に無いクラスとダークの規則を除く（正常系）
test("test_prune_css", async () => {
  // 準備
  const { pruneCss } = await loadFigureSvg();
  const css = [
    ".mdmark-chart { color: red; }",
    ".mdmark-table { color: blue; }",
    ".mdmark-theme-dark .mdmark-chart { color: white; }",
  ].join("\n");
  // 実行
  const pruned = pruneCss({
    css,
    classes: new Set(["mdmark-chart"]),
    tags: new Set(["svg"]),
  });
  // 検証
  expect(pruned).toContain(".mdmark-chart");
  expect(pruned).toContain("color: red");
  expect(pruned).not.toContain("mdmark-table");
  expect(pruned).not.toContain("mdmark-theme-dark");
});
