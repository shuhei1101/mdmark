import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 系列 2 つ・点 5 つずつを、色と線の模様と点の形の組で描く（TwoSeries）
test("test_two_series", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--two-series");
  // 検証
  await expect(
    page.locator("svg[role=img] path.mdmark-diagram-series").count(),
  ).resolves.toBe(2);
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-point").count(),
  ).resolves.toBe(10);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 系列 4 つは、線の模様と色が全て違う（FourSeries）
test("test_four_series", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--four-series");
  // 検証
  const styles = await page
    .locator("svg[role=img] path.mdmark-diagram-series")
    .evaluateAll((paths) =>
      paths.map((path) => {
        const style = getComputedStyle(path);
        return `${style.stroke}|${style.strokeDasharray}`;
      }),
    );
  expect(styles).toHaveLength(4);
  expect(new Set(styles).size).toBe(4);
});

// 定義を読めないときは、図の代わりに書き方の警告を出す（Invalid）
test("test_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--invalid");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain("グラフの部品の定義を JSON として読めません");
  await expect(page.locator("svg[role=img]").count()).resolves.toBe(0);
});

/** svg の文字（`innerText` を持たない）を、現れた順に返す */
function svgTexts(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((texts) => texts.map((text) => text.textContent ?? ""));
}

/** 系列ごとの塗りの模様の `pattern` の中身（要素の名前を並べた文字）を、系列の順に返す */
function patternKinds(page: Page): Promise<string[]> {
  return page
    .locator("svg[role=img] pattern")
    .evaluateAll((patterns) =>
      patterns.map((pattern) =>
        [...pattern.children].map((child) => child.tagName).join(","),
      ),
    );
}

// 棒は、系列ごとに違う塗りの模様で描き、縦の軸をデータから切る（Bar）
test("test_bar", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--bar");
  // 検証
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-bar").count(),
  ).resolves.toBe(8);
  const fills = await page
    .locator("svg[role=img] g[data-series] > .mdmark-diagram-bar")
    .evaluateAll((bars) => bars.map((bar) => bar.getAttribute("fill")));
  expect(new Set(fills).size).toBe(2);
  const kinds = await patternKinds(page);
  expect(kinds[0]).toBe("rect");
  expect(kinds[1]).toContain("path");
  const ticks = await svgTexts(page, 'svg[role=img] text[text-anchor="end"]');
  expect(ticks.filter((tick) => /^\d+$/.test(tick))).toEqual([
    "0",
    "50",
    "100",
    "150",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 棒の系列 4 つは、塗りの模様（塗りつぶし・斜線・点・格子）と色が全て違う（BarFour）
test("test_bar_four", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--bar-four");
  // 検証
  const kinds = await patternKinds(page);
  expect(kinds).toEqual(["rect", "rect,path", "rect,circle", "rect,path"]);
  const inks = await page
    .locator("svg[role=img] pattern")
    .evaluateAll((patterns) =>
      patterns.map((pattern) => {
        const mark = pattern.querySelector("path, circle, rect:last-child");
        const style = mark ? getComputedStyle(mark) : undefined;
        return `${style?.fill}|${style?.stroke}|${style?.strokeWidth}`;
      }),
    );
  expect(new Set(inks).size).toBe(4);
});

// 円は、扇形の外に整数の割合を出し、凡例に項目の名前と値を出し、扇形を地の色の隙間で分ける（Pie）
test("test_pie", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--pie");
  // 検証
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-slice").count(),
  ).resolves.toBe(3);
  await expect(
    svgTexts(page, "svg[role=img] .mdmark-diagram-value-text"),
  ).resolves.toEqual(["62%", "31%", "7%"]);
  const legend = await page
    .locator(".mdmark-diagram-legend-item span")
    .allInnerTexts();
  expect(legend).toEqual([
    "よくある質問で答えた（186 件）",
    "担当者へ回した（92 件）",
    "返信しなかった（22 件）",
  ]);
  const gap = await page
    .locator("svg[role=img] .mdmark-diagram-slice")
    .first()
    .evaluate((slice) => ({
      stroke: getComputedStyle(slice).stroke,
      width: getComputedStyle(slice).strokeWidth,
    }));
  const background = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector(".mdmark") as Element)
        .backgroundColor,
  );
  expect(gap.width).toBe("2px");
  expect(gap.stroke).toBe(background);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 散布図は、横と縦の両方を数値の軸にし、系列を色と点の形（丸・四角）で分ける（Scatter）
test("test_scatter", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--scatter");
  // 検証
  await expect(
    page.locator('svg[role=img] g[data-series="1"] circle').count(),
  ).resolves.toBe(6);
  await expect(
    page.locator('svg[role=img] g[data-series="2"] rect').count(),
  ).resolves.toBe(6);
  const horizontal = await svgTexts(
    page,
    'svg[role=img] text[text-anchor="middle"]',
  );
  expect(
    horizontal.filter((tick) => /^\d+$/.test(tick)).length,
  ).toBeGreaterThan(2);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
