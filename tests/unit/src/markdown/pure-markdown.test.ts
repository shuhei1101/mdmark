import { beforeEach, expect, test, vi } from "vitest";
import type { MdmarkMarkArgs } from "../../../../src/extensions.ts";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../../helpers/charts.ts";
import {
  parsed,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../helpers/diagrams.ts";

/** 純粋な Markdown への変換の入口を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPureMarkdown = () =>
  import("../../../../src/markdown/pure-markdown.ts");

/** ブロックに分ける処理を読み込む（`figureOf` に指定する図のブロックを作る） */
const loadBlocks = () =>
  import("../../../../src/markdown/pure-blocks.logic.ts");

/** 拡張の登録を読み込む */
const loadExtensions = () => import("../../../../src/extensions.ts");

/** 目次・表のマーカー・chart・div の生の HTML を持つ文書 */
const DOCUMENT = [
  "# 手引き",
  "",
  "<!-- toc -->",
  "",
  "## 導入",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 窓口 | 件数 |",
  "| --- | --- |",
  "| メール | 3 |",
  "",
  "<!-- /table -->",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
  '<div class="note">生の HTML</div>',
  "",
  "## 使用方法",
  "",
  "本文。",
  "",
].join("\n");

/** chart・param・埋め込んだ HTML を 1 つずつ持つ文書 */
const FIGURES = [
  "# 図",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
  wrapDirective("param", STRENGTH_TEXT),
  wrapHtml("<table><tr><td>セル</td></tr></table>"),
].join("\n");

/** 範囲の ts を持つ埋め込んだ HTML の文書 */
const HTML_WITH_SCRIPT = [
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">中身</div>',
  "```",
  "",
  "```ts",
  'export default (el: HTMLElement) => { el.textContent = "書き換え"; };',
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

/** 拡張のマーカーを 2 つ持つ文書 */
const EXTENSION_MARKS = [
  "前の段落。",
  "",
  '<!-- greet: {"target": "world"} -->',
  "",
  '<!-- silent: {"target": "hidden"} -->',
  "",
  "後の段落。",
  "",
].join("\n");

beforeEach(async () => {
  const { resetExtensions } = await loadExtensions();
  resetExtensions();
});

// マーカーと生の HTML を取り除き、図を取り除く（正常系）
test("test_to_pure_markdown", async () => {
  // 準備
  const { toPureMarkdown } = await loadPureMarkdown();
  // 実行
  const result = await toPureMarkdown(DOCUMENT);
  // 検証
  expect(result.markdown).not.toContain("<!--");
  expect(result.markdown).not.toContain("<div");
  expect(result.markdown).toContain("- [導入](#導入)");
  expect(result.markdown).toContain("- [使用方法](#使用方法)");
  expect(result.markdown).toContain("| メール | 3 |");
  expect(result.markdown).not.toContain('"series"');
  expect(result.warnings).toEqual([]);
});

// opts.figure の戻り値を図の場所に入れる（正常系）
test("test_to_pure_markdown_when_figure_given", async () => {
  // 準備
  const { toPureMarkdown } = await loadPureMarkdown();
  const figure = vi.fn(
    (f: { kind: string; index: number }) => `![${f.kind}](f-${f.index}.svg)`,
  );
  // 実行
  const result = await toPureMarkdown(FIGURES, { figure });
  // 検証
  expect(figure).toHaveBeenCalledTimes(3);
  expect(figure.mock.calls.map(([f]) => [f.kind, f.index])).toEqual([
    ["chart", 1],
    ["param", 2],
    ["html", 3],
  ]);
  expect(result.markdown).toContain("![chart](f-1.svg)");
  expect(result.markdown).toContain("![param](f-2.svg)");
  expect(result.markdown).toContain("![html](f-3.svg)");
});

// toMarkdown を持つ拡張は戻り値を入れ、持たない拡張は取り除いて警告にする（正常系）
test("test_to_pure_markdown_when_extension_marks", async () => {
  // 準備
  const { toPureMarkdown } = await loadPureMarkdown();
  const { registerExtension } = await loadExtensions();
  const load = vi.fn(async () => ({ draw: () => {} }));
  registerExtension({
    name: "挨拶",
    directive: "greet",
    load,
    toMarkdown: (value: MdmarkMarkArgs) =>
      `**${String(value.options.target)}**`,
  });
  registerExtension({ name: "無言", directive: "silent", load });
  // 実行
  const result = await toPureMarkdown(EXTENSION_MARKS);
  // 検証
  expect(result.markdown).toContain("**world**");
  expect(result.markdown).not.toContain("hidden");
  expect(result.markdown).not.toContain("<!--");
  expect(result.markdown).toContain("前の段落。");
  expect(result.markdown).toContain("後の段落。");
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("無言");
  expect(load).not.toHaveBeenCalled();
});

// フックの例外を外へ出さず、取り除いて警告にする（異常系）
test("test_to_pure_markdown_when_hook_throws", async () => {
  // 準備
  const { toPureMarkdown } = await loadPureMarkdown();
  const { registerExtension } = await loadExtensions();
  registerExtension({
    name: "壊れた拡張",
    directive: "greet",
    load: async () => ({ draw: () => {} }),
    toMarkdown: () => {
      throw new Error("失敗");
    },
  });
  // 実行
  const result = await toPureMarkdown('<!-- greet: {"target": "world"} -->\n');
  // 検証
  expect(result.markdown).not.toContain("<!--");
  expect(result.markdown).not.toContain("world");
  expect(result.warnings.some((w) => w.includes("壊れた拡張"))).toBe(true);
});

// 文字列でない文書は TypeError（異常系）
test("test_to_pure_markdown_when_markdown_not_string", async () => {
  // 準備
  const { toPureMarkdown } = await loadPureMarkdown();
  // 実行・検証
  await expect(
    toPureMarkdown(null as unknown as string),
  ).rejects.toBeInstanceOf(TypeError);
});

/** 文書の最初の図のブロックを返却する */
async function firstFigureBlock(markdown: string, features = {}) {
  const { splitPureBlocks } = await loadBlocks();
  const block = splitPureBlocks({ markdown, features }).find(
    (item) => item.kind === "figure",
  );
  if (block === undefined) {
    throw new Error("図のブロックが無い");
  }
  return block;
}

// chart のタイトルと系列の名前（正常系）
test("test_figure_of_chart", async () => {
  // 準備
  const { figureOf } = await loadPureMarkdown();
  const block = await firstFigureBlock(
    wrapDirective("chart", INQUIRY_COUNT_TEXT),
  );
  const definition = parsed<{ title: string; series: { name: string }[] }>(
    INQUIRY_COUNT_TEXT,
  );
  // 実行
  const { figure } = figureOf({ block, index: 1 });
  // 検証
  expect(figure.kind).toBe("chart");
  expect(figure.index).toBe(1);
  expect(figure.title).toBe(definition.title);
  expect(figure.legend).toEqual(definition.series.map((item) => item.name));
  expect(figure.html).toContain('data-diagram="chart"');
});

// param の凡例は今の値と既定の値（正常系）
test("test_figure_of_param", async () => {
  // 準備
  const { figureOf } = await loadPureMarkdown();
  const block = await firstFigureBlock(wrapDirective("param", STRENGTH_TEXT));
  // 実行
  const { figure } = figureOf({ block, index: 1 });
  // 検証
  expect(figure.kind).toBe("param");
  expect(figure.title).toBe(parsed<{ title: string }>(STRENGTH_TEXT).title);
  const { knob } = parsed<{ knob: { value: number } }>(STRENGTH_TEXT);
  expect(figure.legend).toEqual([
    `今の値（${knob.value}）`,
    `既定の値（${knob.value}）`,
  ]);
});

// 範囲のスクリプトを除いて警告を返却する（正常系）
test("test_figure_of_html_with_scripts", async () => {
  // 準備
  const { figureOf } = await loadPureMarkdown();
  const config = { features: { "html-scripts": true } };
  const block = await firstFigureBlock(HTML_WITH_SCRIPT, config.features);
  // 実行
  const { figure, warnings } = figureOf({ block, index: 1, config });
  // 検証
  expect(figure.kind).toBe("html");
  expect(figure.html).toContain("中身");
  expect(figure.html).not.toContain("<script");
  expect(figure.html).not.toContain("書き換え");
  expect(warnings).toHaveLength(1);
});
