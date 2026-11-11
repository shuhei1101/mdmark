import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import type { MdmarkChartDefinition } from "../../../../src/diagram/definition.ts";
import {
  INQUIRY_COUNT_TEXT,
  LENGTH_TIME_TEXT,
  REPLY_KIND_TEXT,
} from "../../helpers/charts.ts";
import { parsed, REPLY_TIME_TEXT } from "../../helpers/diagrams.ts";
import { findTag, matches, plainText } from "../../helpers/html.ts";

/** グラフの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadChart = () => import("../../../../src/parts/chart.ts");

/** 塗りの模様 `id` の中身を返却する */
function patternOf(html: string, id: string): string {
  const pattern = new RegExp(
    `<pattern[^>]*id="${id}"[^>]*>([\\s\\S]*?)</pattern>`,
  );
  return pattern.exec(html)?.[1] ?? "";
}

/** 軸の目盛りの文字のうち数だけを、現れた順に返却する */
function axisNumbers(html: string): number[] {
  return matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  ).map((text) => Number(plainText(text)));
}

/** タイトル・範囲・更新日に `rest` を加えたグラフの定義 */
function chartOf(rest: Partial<MdmarkChartDefinition>): MdmarkChartDefinition {
  return {
    title: "確認のグラフ",
    scope: "10 月",
    updated: "2026-11-03",
    ...rest,
  } as MdmarkChartDefinition;
}

/** 系列 `n` の `<g data-series>` の中身（無ければ空） */
function seriesGroup(html: string, n: number): string {
  return (
    new RegExp(`<g data-series="${n}">([\\s\\S]*?)</g>`).exec(html)?.[1] ?? ""
  );
}

/** `rect` の開始タグの `y` と `height` と `x` と `width` */
function rectsOf(
  html: string,
): Array<{ x: number; y: number; width: number; height: number }> {
  return matches(html, /<rect\b[^>]*class="mdmark-diagram-bar"[^>]*>/g).map(
    (tag) => {
      const attr = (name: string) =>
        Number(new RegExp(`\\s${name}="(-?[\\d.]+)"`).exec(tag)?.[1]);
      return {
        x: attr("x"),
        y: attr("y"),
        width: attr("width"),
        height: attr("height"),
      };
    },
  );
}

/** パスの `d` の座標の組を、現れた順に返却する */
function pathPoints(d: string): Array<[number, number]> {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const points: Array<[number, number]> = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push([numbers[index] ?? 0, numbers[index + 1] ?? 0]);
  }
  return points;
}

/** 開始タグの属性 `name` の値 */
function attrOf(tag: string, name: string): string {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
}

/** 値が近いか（小数の丸めの差を許す） */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.6;
}

// 系列を積み上げ、棒の上に合計を配置する（正常系）
test("test_render_chart_when_stacked_bar", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "stacked-bar",
    x: { label: "窓口", ticks: ["メール", "電話"] },
    y: { label: "件" },
    series: [
      { name: "自動", points: [3, 1] },
      { name: "担当", points: [4, 2] },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const [first] = rectsOf(seriesGroup(html, 1));
  const [second] = rectsOf(seriesGroup(html, 2));
  expect(first && second).toBeTruthy();
  if (!first || !second) return;
  expect(near(second.y + second.height, first.y)).toBe(true);
  expect(near(first.height * 4, second.height * 3)).toBe(true);
  const texts = matches(html, /<text[^>]*>[^<]*<\/text>/g).map((text) =>
    plainText(text),
  );
  expect(texts).toContain("7");
});

// 負の値を 0 から下へ追加する（正常系）
test("test_render_chart_when_stacked_negative", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "stacked-bar",
    x: { label: "窓口", ticks: ["メール", "電話"] },
    y: { label: "件" },
    series: [
      { name: "増", points: [3, 1] },
      { name: "減", points: [-2, 1] },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const [first] = rectsOf(seriesGroup(html, 1));
  const [second] = rectsOf(seriesGroup(html, 2));
  expect(first && second).toBeTruthy();
  if (!first || !second) return;
  const zero = first.y + first.height;
  expect(near(second.y, zero)).toBe(true);
});

// 面と積み上げの面を塗る（正常系）
test("test_render_chart_when_area", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const base = {
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件", min: 0, max: 10, step: 5 },
    series: [
      { name: "A", points: [2, 3, 4] },
      { name: "B", points: [1, 2, 3] },
    ],
  };
  // 実行
  const area = renderChart(chartOf({ type: "area", ...base }), "d1").html;
  const stacked = renderChart(
    chartOf({ type: "stacked-area", ...base }),
    "d2",
  ).html;
  // 検証
  for (const [html, id] of [
    [area, "d1"],
    [stacked, "d2"],
  ] as const) {
    for (const n of [1, 2]) {
      expect(html).toMatch(
        new RegExp(`<path[^>]*fill="url\\(#${id}-fill-${n}\\)"`),
      );
    }
  }
  const fills = (n: number) =>
    pathPoints(
      attrOf(
        new RegExp(`<path[^>]*fill="url\\(#d2-fill-${n}\\)"[^>]*>`).exec(
          stacked,
        )?.[0] ?? "",
        "d",
      ),
    );
  const lower = fills(1);
  const upper = fills(2);
  const topOfFirst = lower.slice(0, 3).map(([, y]) => y);
  const bottomOfSecond = upper
    .slice(3)
    .map(([, y]) => y)
    .reverse();
  expect(bottomOfSecond).toHaveLength(3);
  for (const [index, y] of topOfFirst.entries()) {
    expect(near(y, bottomOfSecond[index] ?? Number.NaN)).toBe(true);
  }
});

// 項目を縦に並べて値を横の長さにする（正常系）
test("test_render_chart_when_horizontal_bar", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "horizontal-bar",
    x: { label: "窓口", ticks: ["メール", "電話"] },
    y: { label: "件" },
    series: [{ name: "件数", points: [2, 5] }],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const [small, large] = rectsOf(html);
  expect(small && large).toBeTruthy();
  if (!small || !large) return;
  expect(small.y).not.toBe(large.y);
  expect(large.width).toBeGreaterThan(small.width);
});

// 中を空けた扇形と中央の合計を描く（正常系）
test("test_render_chart_when_donut", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "donut",
    unit: " 件",
    items: [
      { name: "よくある質問で回答した", value: 186 },
      { name: "担当者へ回した", value: 92 },
      { name: "返信しなかった", value: 22 },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const slices = matches(html, /<path[^>]*class="mdmark-diagram-slice"[^>]*>/g);
  expect(slices).toHaveLength(3);
  for (const slice of slices) {
    expect(matches(attrOf(slice, "d"), /A/g)).toHaveLength(2);
  }
  const texts = matches(html, /<text[^>]*>[^<]*<\/text>/g).map((text) =>
    plainText(text),
  );
  expect(texts).toContain("300");
  expect(texts).toContain("合計 件");
});

// 軸を放射状に並べて系列を多角形にする（正常系）
test("test_render_chart_when_radar", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "radar",
    x: { label: "観点", ticks: ["速さ", "正確さ", "丁寧さ", "量", "費用"] },
    y: { label: "点", min: 0, max: 5, step: 1 },
    series: [
      { name: "自動", points: [5, 3, 2, 4, 5] },
      { name: "担当", points: [2, 5, 5, 2, 1] },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<line[^>]*class="mdmark-diagram-axis"/g)).toHaveLength(
    5,
  );
  for (const n of [1, 2]) {
    const tag =
      new RegExp(
        `<path[^>]*class="mdmark-diagram-series"[^>]*data-series="${n}"[^>]*>`,
      ).exec(html)?.[0] ?? "";
    const d = attrOf(tag, "d");
    expect(pathPoints(d)).toHaveLength(5);
    expect(d.trim().toLowerCase().endsWith("z")).toBe(true);
  }
});

// size の値を円の面積にする（正常系）
test("test_render_chart_when_bubble", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "bubble",
    x: { label: "長さ" },
    y: { label: "分" },
    size: { label: "件数" },
    series: [
      {
        name: "問い合わせ",
        points: [
          [1, 2, 4],
          [3, 4, 16],
        ],
      },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const radii = matches(seriesGroup(html, 1), /<circle\b[^>]*>/g).map((tag) =>
    Number(attrOf(tag, "r")),
  );
  expect(radii).toHaveLength(2);
  expect(near(radii[1] ?? 0, (radii[0] ?? 0) * 2)).toBe(true);
});

// 系列を as の描き方で重ね、y2 の系列を右の軸で描く（正常系）
test("test_render_chart_when_combo", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "combo",
    x: { label: "月", ticks: ["1", "2", "3"] },
    y: { label: "件", min: 0, max: 100, step: 50 },
    y2: { label: "%", min: 0, max: 10, step: 5 },
    series: [
      { name: "件数", points: [40, 60, 80], as: "bar" },
      { name: "割合", points: [3, 6, 9], as: "line", axis: "y2" },
    ],
  });
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(rectsOf(seriesGroup(html, 1))).toHaveLength(3);
  expect(html).toMatch(
    /<path[^>]*class="mdmark-diagram-series"[^>]*data-series="2"/,
  );
  const numbers = matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  ).map((text) => Number(plainText(text)));
  for (const tick of [0, 50, 100, 5, 10]) {
    expect(numbers).toContain(tick);
  }
});

// 6 つの系列を色・線の模様・点の形状の組で分ける（正常系）
test("test_render_chart_when_six_series", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = chartOf({
    type: "line",
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件", min: 0, max: 10, step: 5 },
    series: [1, 2, 3, 4, 5, 6].map((n) => ({
      name: `系列${n}`,
      points: [n, n + 1, n + 2],
    })),
  });
  const css = await readFile(
    new URL("../../../../src/index.css", import.meta.url),
    "utf8",
  );
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  for (const n of [1, 2, 3, 4, 5, 6]) {
    expect(html).toMatch(
      new RegExp(
        `<path[^>]*class="mdmark-diagram-series"[^>]*data-series="${n}"`,
      ),
    );
  }
  expect(css).toMatch(/\[data-series="5"\][^}]*stroke-dasharray: 9 3 1 3 1 3;/);
  expect(css).toMatch(/\[data-series="6"\][^}]*stroke-dasharray: 3 2;/);
  const fifth =
    matches(
      seriesGroup(html, 5),
      /<path[^>]*class="mdmark-diagram-point"[^>]*>/g,
    )[0] ?? "";
  const triangle = pathPoints(attrOf(fifth, "d"));
  expect(triangle).toHaveLength(3);
  const [apex, ...rest] = triangle;
  for (const [, y] of rest) {
    expect(apex?.[1] ?? 0).toBeGreaterThan(y);
  }
  const sixth =
    matches(
      seriesGroup(html, 6),
      /<path[^>]*class="mdmark-diagram-point"[^>]*>/g,
    )[0] ?? "";
  const cross = attrOf(sixth, "d");
  expect(
    matches(cross, /M/g).length >= 2 || pathPoints(cross).length === 12,
  ).toBe(true);
});

// 項目ごとにツールチップの中身とクリックを受ける円を配置する（正常系）
test("test_render_chart_when_item_tips", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const line = parsed<MdmarkChartDefinition>(REPLY_TIME_TEXT);
  const pie = parsed<MdmarkChartDefinition>(REPLY_KIND_TEXT);
  // 実行
  const lineChart = renderChart(line, "d1");
  const pieChart = renderChart(pie, "d2");
  // 検証
  const hits = matches(
    lineChart.html,
    /<circle\b[^>]*class="mdmark-diagram-item-hit"[^>]*>/g,
  );
  expect(hits).toHaveLength(10);
  for (const hit of hits) {
    expect(hit).toContain('r="12"');
    expect(hit).toContain('tabindex="0"');
    expect(hit).toContain("aria-describedby=");
  }
  expect(matches(lineChart.tips, /role="tooltip"/g)).toHaveLength(10);
  const slice = findTag(pieChart.html, 'class="mdmark-diagram-slice"');
  expect(slice).toContain('tabindex="0"');
  expect(plainText(pieChart.tips)).toContain("186 件（62%）");
});

// 種類ごとの値の文を返却する（正常系）
test("test_chart_item_text", async () => {
  // 準備
  const { chartItemText } = await loadChart();
  const scatter = chartOf({
    type: "scatter",
    x: { label: "文字数" },
    y: { label: "分" },
  } as Partial<MdmarkChartDefinition>);
  const bubble = chartOf({
    type: "bubble",
    x: { label: "文字数" },
    y: { label: "分" },
    size: { label: "件数" },
  } as Partial<MdmarkChartDefinition>);
  const pie = chartOf({
    type: "pie",
    unit: " 件",
  } as Partial<MdmarkChartDefinition>);
  const line = chartOf({ type: "line" } as Partial<MdmarkChartDefinition>);
  // 実行
  const texts = [
    chartItemText({ type: "line", tick: "2月", value: 38, definition: line }),
    chartItemText({ type: "scatter", point: [3, 40], definition: scatter }),
    chartItemText({ type: "bubble", point: [3, 40, 16], definition: bubble }),
    chartItemText({ type: "pie", value: 50, percent: 50, definition: pie }),
  ];
  // 検証
  expect(texts).toEqual([
    "2月: 38",
    "文字数 3・分 40",
    "文字数 3・分 40・件数 16",
    "50 件（50%）",
  ]);
});

// 系列ごとに線と点を描き、スクリーンリーダーに値を記載する（正常系）
test("test_render_chart", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = parsed<MdmarkChartDefinition>(REPLY_TIME_TEXT);
  // 実行
  const { html, tips } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<path[^>]*data-series="1"/g)).toHaveLength(1);
  expect(matches(html, /<path[^>]*data-series="2"/g)).toHaveLength(1);
  expect(matches(html, /class="mdmark-diagram-point"/g)).toHaveLength(10);
  expect(html).toContain(
    'aria-label="返信までの時間。自動返信: 12・9・14・8・10。担当者: 42・38・51・35・44"',
  );
  expect(matches(tips, /role="tooltip"/g)).toHaveLength(10);
});

// 棒を系列ごとの塗りの模様で描き、縦の軸をデータから切る（正常系）
test("test_render_chart_when_bar", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = parsed<MdmarkChartDefinition>(INQUIRY_COUNT_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<rect[^>]*class="mdmark-diagram-bar"/g)).toHaveLength(
    8,
  );
  const second = /<g data-series="2">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  expect(matches(second, /fill="url\(#d1-fill-2\)"/g)).toHaveLength(4);
  expect(patternOf(html, "d1-fill-1")).not.toContain("<path");
  expect(patternOf(html, "d1-fill-2")).toContain("<path");
  expect(axisNumbers(html)).toEqual([0, 50, 100, 150]);
});

// 扇形の外に合計 100 の整数の割合を配置し、凡例に名前と値を出す（正常系）
test("test_render_chart_when_pie", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = parsed<MdmarkChartDefinition>(REPLY_KIND_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<path[^>]*class="mdmark-diagram-slice"/g)).toHaveLength(
    3,
  );
  const percents = matches(
    html,
    /<text[^>]*class="mdmark-diagram-value-text"[^>]*>[^<]*<\/text>/g,
  ).map((text) => plainText(text));
  expect(percents).toEqual(["62%", "31%", "7%"]);
  expect(html).toContain("よくある質問で回答した: 186 件");
});

// 横と縦を数値の軸にして系列ごとの構造の点を配置する（正常系）
test("test_render_chart_when_scatter", async () => {
  // 準備
  const { renderChart } = await loadChart();
  const definition = parsed<MdmarkChartDefinition>(LENGTH_TIME_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const first = /<g data-series="1">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  const second = /<g data-series="2">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  expect(
    matches(first, /<circle[^>]*class="mdmark-diagram-point"/g),
  ).toHaveLength(6);
  expect(
    matches(second, /<rect[^>]*class="mdmark-diagram-point"/g),
  ).toHaveLength(6);
  // 縦の軸の目盛りに加え、横の軸（中央揃えの文字）も数値の目盛りを持つ
  const horizontal = matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*text-anchor="middle"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  );
  expect(horizontal.length).toBeGreaterThanOrEqual(2);
  expect(axisNumbers(html).length).toBeGreaterThan(horizontal.length);
});
