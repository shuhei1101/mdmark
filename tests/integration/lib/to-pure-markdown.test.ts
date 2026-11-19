import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test, vi } from "vitest";
import type {
  MdmarkExtension,
  MdmarkFigure,
  PureMarkdownOptions,
  PureMarkdownResult,
} from "../../../src/index.ts";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../../unit/helpers/charts.ts";
import {
  parsed,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";

type Built = {
  toPureMarkdown: (
    markdown: string,
    opts?: PureMarkdownOptions,
  ) => Promise<PureMarkdownResult>;
  registerExtension: (extension: MdmarkExtension) => void;
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** 目次・番号を付けた表・map の範囲・chart・param・埋め込んだ HTML・script と div の生の HTML を持つ文書 */
const DOCUMENT = [
  "# 手引き",
  "",
  "<!-- toc -->",
  "",
  "## 件数",
  "",
  "窓口ごとの件数は [](#fig-count) のとおり。",
  "",
  '<!-- fig: {"id": "count"} -->',
  "",
  "| 窓口 | 件数 |",
  "| --- | --- |",
  "| メール | 3 |",
  "",
  "## 流れ",
  "",
  "<!-- map -->",
  "",
  "```mermaid",
  "flowchart LR",
  "  a --> b",
  "```",
  "",
  '<!-- map-data: {"version": 1, "notes": {"a": {"annotations": ["n1"]}}} -->',
  "",
  "<!-- /map -->",
  "",
  "## 図",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
  wrapDirective("param", STRENGTH_TEXT),
  wrapHtml('<div class="box">枠</div>'),
  "<script>window.__ran = true</script>",
  "",
  '<div class="note">生の HTML</div>',
  "",
].join("\n");

// 記法を持つ文書を純粋な Markdown にし、図を取り除く（正常系）
test("test_normal", async () => {
  // 準備
  const { toPureMarkdown } = await loadBuilt();
  // 実行
  const { markdown, warnings } = await toPureMarkdown(DOCUMENT);
  // 検証
  expect(markdown).not.toContain("<!--");
  expect(markdown).not.toMatch(/<script|<div/);
  expect(markdown).toContain("- [件数](#件数)");
  expect(markdown).toContain("- [流れ](#流れ)");
  expect(markdown).toContain("[表 1](#fig-count)");
  expect(markdown).toContain("```mermaid\nflowchart LR\n  a --> b\n```");
  expect(markdown).not.toContain("annotations");
  expect(markdown).not.toContain("images/");
  expect(markdown).not.toContain('"series"');
  expect(markdown).not.toContain('"knob"');
  expect(markdown).not.toContain("枠");
  expect(warnings).toEqual([]);
});

// opts.figure が返す Markdown を図の場所に入れる（正常系（図を置き換える関数を指定する））
test("test_normal_when_figure_given", async () => {
  // 準備
  const { toPureMarkdown } = await loadBuilt();
  const figure = vi.fn(
    (f: MdmarkFigure) => `![${f.kind}](images/figure-${f.index}.svg)`,
  );
  const chart = parsed<{ title: string; series: { name: string }[] }>(
    INQUIRY_COUNT_TEXT,
  );
  const param = parsed<{ title: string; knob: { value: number } }>(
    STRENGTH_TEXT,
  );
  // 実行
  const { markdown } = await toPureMarkdown(DOCUMENT, { figure });
  // 検証
  expect(figure.mock.calls.map(([f]) => [f.kind, f.index])).toEqual([
    ["chart", 1],
    ["param", 2],
    ["html", 3],
  ]);
  const [chartFigure, paramFigure] = figure.mock.calls.map(([f]) => f);
  expect(chartFigure?.title).toBe(chart.title);
  expect(chartFigure?.legend).toEqual(chart.series.map((item) => item.name));
  expect(paramFigure?.title).toBe(param.title);
  expect(paramFigure?.legend).toEqual([
    `今の値（${param.knob.value}）`,
    `既定の値（${param.knob.value}）`,
  ]);
  for (const index of [1, 2, 3]) {
    expect(markdown).toContain(`(images/figure-${index}.svg)`);
  }
});

// 書き出しのフックを持つ拡張はその戻り値に、持たない拡張は取り除く（正常系（拡張のマーカー））
test("test_normal_when_extension_marks", async () => {
  // 準備
  const { toPureMarkdown, registerExtension } = await loadBuilt();
  const load = vi.fn(async () => ({ draw: () => {} }));
  registerExtension({
    name: "太字の拡張",
    directive: "pure-bold",
    load,
    toMarkdown: (value) => `**${String(value.options.target)}**`,
  });
  registerExtension({
    name: "フックの無い拡張",
    directive: "pure-silent",
    load,
  });
  const markdown = [
    "前の段落。",
    "",
    '<!-- pure-bold: {"target": "world"} -->',
    "",
    "<!-- pure-silent -->",
    "",
    "```json",
    '{"hidden": true}',
    "```",
    "",
    "<!-- /pure-silent -->",
    "",
    "後の段落。",
    "",
  ].join("\n");
  // 実行
  const result = await toPureMarkdown(markdown);
  // 検証
  expect(result.markdown).toContain("**world**");
  expect(result.markdown).not.toContain("hidden");
  expect(result.markdown).not.toContain("<!--");
  expect(result.markdown).toContain("前の段落。");
  expect(result.markdown).toContain("後の段落。");
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("フックの無い拡張");
  expect(result.warnings[0]).toContain("5 行目");
  expect(load).not.toHaveBeenCalled();
});

// 範囲のスクリプトを除いた HTML を opts.figure に渡し、警告に入れる（正常系（書き出せない中身を持つ埋め込んだ HTML））
test("test_normal_when_unexportable_contents", async () => {
  // 準備
  const { toPureMarkdown } = await loadBuilt();
  const htmls: string[] = [];
  const markdown = [
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
  // 実行
  const result = await toPureMarkdown(markdown, {
    config: { features: { "html-scripts": true } },
    figure: (f) => {
      htmls.push(f.html);
      return undefined;
    },
  });
  // 検証
  expect(htmls).toHaveLength(1);
  expect(htmls[0]).not.toContain("<script");
  expect(htmls[0]).not.toContain("書き換え");
  expect(htmls[0]).toContain("中身");
  expect(result.warnings).toHaveLength(1);
  expect(result.warnings[0]).toContain("1 行目");
});

// 文字列でない文書は変換せずに TypeError を送出する（異常系）
test("test_error_when_markdown_not_string", async () => {
  // 準備
  const { toPureMarkdown } = await loadBuilt();
  // 実行・検証
  await expect(
    toPureMarkdown(null as unknown as string),
  ).rejects.toBeInstanceOf(TypeError);
});
