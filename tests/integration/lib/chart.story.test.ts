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
  // 塗りの模様は系列の上限の 6 つ分を定義に置き、描いた 4 つの系列は先頭の 4 つを使う
  const kinds = (await patternKinds(page)).slice(0, 4);
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
  expect(new Set(inks.slice(0, 4)).size).toBe(4);
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
    page
      .locator(
        'svg[role=img] g[data-series="1"] circle:not(.mdmark-diagram-item-hit)',
      )
      .count(),
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

/** 凡例の項目の文字を、並んだ順に返す */
function legendTexts(page: Page): Promise<string[]> {
  return page.locator(".mdmark-diagram-legend-item > span").allTextContents();
}

/** 図の中の `selector` の要素の `fill` の属性を、現れた順に返す */
function fillsOf(page: Page, selector: string): Promise<Array<string | null>> {
  return page
    .locator(`svg[role=img] ${selector}`)
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("fill")),
    );
}

// 系列 6 つは、線の色と模様の組が全て違い、5 つ目と 6 つ目の点を逆三角と十字で描く（SixSeries）
test("test_six_series", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--six-series");
  // 検証
  const styles = await page
    .locator("svg[role=img] path.mdmark-diagram-series")
    .evaluateAll((paths) =>
      paths.map((path) => {
        const style = getComputedStyle(path);
        return `${style.stroke}|${style.strokeDasharray}`;
      }),
    );
  expect(styles).toHaveLength(6);
  expect(new Set(styles).size).toBe(6);
  const firstPoints = await page
    .locator("svg[role=img] g[data-series]")
    .evaluateAll((groups) =>
      groups.map(
        (group) => group.querySelector(".mdmark-diagram-point")?.tagName,
      ),
    );
  expect(firstPoints).toHaveLength(6);
  // 5 つ目（逆三角）と 6 つ目（十字）は、それぞれ頂点 3 つと 12 の多角形
  const vertices = await page
    .locator("svg[role=img] g[data-series] > path.mdmark-diagram-point")
    .evaluateAll((points) =>
      points.map(
        (point) => (point.getAttribute("d")?.match(/[ML]/g) ?? []).length,
      ),
    );
  expect(vertices).toContain(3);
  expect(vertices).toContain(12);
  await expect(legendTexts(page)).resolves.toEqual([
    "メール",
    "フォーム",
    "チャット",
    "電話",
    "SNS",
    "店頭",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 面は、折れ線の下を系列ごとの塗りで面にし、折れ線と点も描く（Area）
test("test_area", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--area");
  // 検証
  await expect(fillsOf(page, ".mdmark-diagram-area")).resolves.toEqual([
    expect.stringMatching(/-fill-1\)$/),
    expect.stringMatching(/-fill-2\)$/),
  ]);
  await expect(
    page.locator("svg[role=img] path.mdmark-diagram-series").count(),
  ).resolves.toBe(2);
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-point").count(),
  ).resolves.toBe(10);
});

// 積み上げの面は、系列の面を下の系列の上端に積み、系列ごとの塗りの模様で分ける（StackedArea）
test("test_stacked_area", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--stacked-area");
  // 検証
  const areas = page.locator("svg[role=img] .mdmark-diagram-stacked-area");
  await expect(areas.count()).resolves.toBe(3);
  await expect(fillsOf(page, ".mdmark-diagram-stacked-area")).resolves.toEqual([
    expect.stringMatching(/-fill-1\)$/),
    expect.stringMatching(/-fill-2\)$/),
    expect.stringMatching(/-fill-3\)$/),
  ]);
  // 上の系列の面の下端は、下の系列の面の上端と同じ点を通る
  const shapes = await areas.evaluateAll((paths) =>
    paths.map((path) => path.getAttribute("d") ?? ""),
  );
  const top = (d: string) => d.split(" L").slice(0, 5).join(" L").slice(1);
  const bottomReversed = (d: string) =>
    d.replace(/ Z$/, "").split(" L").slice(5).reverse().join(" L");
  expect(bottomReversed(shapes[1] ?? "")).toBe(top(shapes[0] ?? ""));
  expect(bottomReversed(shapes[2] ?? "")).toBe(top(shapes[1] ?? ""));
});

// 積み上げの棒は、項目ごとに系列を 1 本に積み、棒の上に合計を出す（StackedBar）
test("test_stacked_bar", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--stacked-bar");
  // 検証
  const bars = await page
    .locator("svg[role=img] g[data-series] > .mdmark-diagram-bar")
    .evaluateAll((rects) =>
      rects.map((rect) => ({
        x: rect.getAttribute("x"),
        y: Number(rect.getAttribute("y")),
        height: Number(rect.getAttribute("height")),
      })),
    );
  expect(bars).toHaveLength(12);
  // 同じ項目の棒は同じ x に並び、上の系列の下端が下の系列の上端に接する
  const byX = new Map<string | null, typeof bars>();
  for (const bar of bars) {
    byX.set(bar.x, [...(byX.get(bar.x) ?? []), bar]);
  }
  expect(byX.size).toBe(4);
  for (const stack of byX.values()) {
    expect(stack).toHaveLength(3);
    for (let index = 1; index < stack.length; index += 1) {
      const lower = stack[index - 1];
      const upper = stack[index];
      expect((upper?.y ?? 0) + (upper?.height ?? 0)).toBeCloseTo(
        lower?.y ?? 0,
        1,
      );
    }
  }
  await expect(
    svgTexts(page, "svg[role=img] .mdmark-diagram-value-text"),
  ).resolves.toEqual(["136", "107", "108", "100"]);
});

// 横棒は、項目の名前を左に並べ、値を横の長さで出す（HorizontalBar）
test("test_horizontal_bar", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--horizontal-bar");
  // 検証
  const bars = await page
    .locator("svg[role=img] g[data-series] > .mdmark-diagram-bar")
    .evaluateAll((rects) =>
      rects.map((rect) => ({
        x: Number(rect.getAttribute("x")),
        width: Number(rect.getAttribute("width")),
        height: Number(rect.getAttribute("height")),
      })),
    );
  expect(bars).toHaveLength(10);
  expect(new Set(bars.map((bar) => bar.x)).size).toBe(1);
  for (const bar of bars) {
    expect(bar.width).toBeGreaterThan(bar.height);
  }
  const labels = await page
    .locator("svg[role=img] .mdmark-diagram-axis-text")
    .evaluateAll((texts) =>
      texts.map((text) => ({
        text: text.textContent,
        x: Number(text.getAttribute("x")),
      })),
    );
  const names = labels.filter((label) =>
    ["料金", "設定", "障害", "解約", "その他"].includes(label.text ?? ""),
  );
  expect(names).toHaveLength(5);
  for (const name of names) {
    expect(name.x).toBeLessThan(bars[0]?.x ?? 0);
  }
});

// ドーナツは、中を空けた扇形の外に割合を出し、中央に合計と単位を出す（Donut）
test("test_donut", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--donut");
  // 検証
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-slice").count(),
  ).resolves.toBe(4);
  await expect(
    svgTexts(page, "svg[role=img] .mdmark-diagram-value-text"),
  ).resolves.toEqual(["55%", "27%", "12%", "6%"]);
  const total = await page
    .locator("svg[role=img] .mdmark-diagram-total-text")
    .textContent();
  expect(total).toBe("341");
  await expect(
    svgTexts(page, "svg[role=img] .mdmark-diagram-axis-text"),
  ).resolves.toEqual(["合計 件"]);
  // 扇形は中を空けた形（外の弧と内の弧の 2 つの弧）で描く
  const arcs = await page
    .locator("svg[role=img] .mdmark-diagram-slice")
    .first()
    .evaluate((slice) => (slice.getAttribute("d")?.match(/A/g) ?? []).length);
  expect(arcs).toBe(2);
});

// レーダーは、軸 5 つを放射状に引き、系列を色と塗りの多角形で描く（Radar）
test("test_radar", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--radar");
  // 検証
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-axis").count(),
  ).resolves.toBe(5);
  await expect(fillsOf(page, ".mdmark-diagram-area")).resolves.toEqual([
    expect.stringMatching(/-fill-1\)$/),
    expect.stringMatching(/-fill-2\)$/),
  ]);
  const vertices = await page
    .locator("svg[role=img] .mdmark-diagram-area")
    .evaluateAll((areas) =>
      areas.map(
        (area) => (area.getAttribute("d")?.match(/[ML]/g) ?? []).length,
      ),
    );
  expect(vertices).toEqual([5, 5]);
  const axisNames = await svgTexts(
    page,
    "svg[role=img] .mdmark-diagram-axis-text",
  );
  for (const name of ["速さ", "正確さ", "丁寧さ", "解決率", "満足度"]) {
    expect(axisNames).toContain(name);
  }
});

// バブルは、点の 3 つ目の値に面積が比例する円を描き、凡例に円の面積の見本を出す（Bubble）
test("test_bubble", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--bubble");
  // 検証
  const radii = await page
    .locator("svg[role=img] .mdmark-diagram-bubble")
    .evaluateAll((circles) =>
      circles.map((circle) => Number(circle.getAttribute("r"))),
    );
  expect(radii).toHaveLength(6);
  expect(new Set(radii).size).toBeGreaterThan(1);
  await expect(legendTexts(page)).resolves.toEqual([
    "自動返信",
    "担当者",
    "円の面積: 件数",
  ]);
  const samples = await page
    .locator(".mdmark-diagram-legend-item")
    .last()
    .locator("circle")
    .count();
  expect(samples).toBe(2);
});

// 組み合わせは、棒の系列を棒、折れ線の系列を折れ線で描き、右の軸の系列を凡例に添えて示す（Combo）
test("test_combo", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--combo");
  // 検証
  await expect(
    page.locator("svg[role=img] g[data-series] > .mdmark-diagram-bar").count(),
  ).resolves.toBe(5);
  await expect(
    page.locator("svg[role=img] path.mdmark-diagram-series").count(),
  ).resolves.toBe(1);
  await expect(
    page.locator("svg[role=img] .mdmark-diagram-axis").count(),
  ).resolves.toBe(3);
  const ticks = await svgTexts(page, "svg[role=img] .mdmark-diagram-axis-text");
  expect(ticks).toContain("%");
  expect(ticks).toContain("件");
  await expect(legendTexts(page)).resolves.toEqual([
    "件数（左の軸）",
    "解決率（右の軸）",
  ]);
});

// 系列が 7 つの定義は、図の代わりに系列の数と上限を書いた書き方の警告を出す（TooManySeries）
test("test_too_many_series", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--too-many-series");
  // 検証
  const warning = await page.locator(".mdmark-syntax-warning").innerText();
  expect(warning).toContain("系列が 7 つです");
  expect(warning).toContain("1〜6 つ");
  await expect(page.locator("svg[role=img]").count()).resolves.toBe(0);
});

// 折れ線の点にフォーカスした状態は、点を輪で示し、点の下にその項目のツールチップを出す（ItemFocused）
test("test_item_focused", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-chart--item-focused");
  await page.waitForFunction(() =>
    document.activeElement?.classList.contains("mdmark-diagram-item-hit"),
  );
  // 検証
  const focused = await page.evaluate(() => {
    const active = document.activeElement as SVGElement | null;
    if (!active?.classList.contains("mdmark-diagram-item-hit")) {
      return undefined;
    }
    const tip = document.getElementById(
      active.getAttribute("aria-describedby") ?? "",
    );
    const own = active.getBoundingClientRect();
    return {
      stroke: getComputedStyle(active).stroke,
      strokeWidth: Number.parseFloat(getComputedStyle(active).strokeWidth),
      tipShown: tip !== null && !tip.hidden,
      below: tip ? tip.getBoundingClientRect().top >= own.bottom - 1 : false,
      text: tip?.textContent ?? "",
    };
  });
  expect(focused).toBeDefined();
  expect(focused?.stroke).not.toBe("none");
  expect(focused?.strokeWidth).toBeGreaterThanOrEqual(2);
  expect(focused?.tipShown).toBe(true);
  expect(focused?.below).toBe(true);
  expect(focused?.text).toMatch(/: \d/);
});
