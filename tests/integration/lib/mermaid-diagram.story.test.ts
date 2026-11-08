import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** mermaid の図のストーリーを開き、全体が収まる倍率を当て終えるまで待つ */
async function openMermaid(id: string): Promise<Page> {
  const page = await holder.openStory(`parts-mermaiddiagram--${id}`);
  await page.waitForFunction(() =>
    (
      document.querySelector<HTMLElement>(".mdmark-diagram-stage")?.style
        .transform ?? ""
    ).startsWith("scale("),
  );
  return page;
}

/** 描く先の中で `value` の色を計算済みの色（`rgb(…)`）にする */
function resolvedColor(page: Page, value: string): Promise<string> {
  return page.evaluate((color) => {
    const root = document.querySelector(".mdmark") as HTMLElement;
    const probe = document.createElement("span");
    probe.style.color = color;
    root.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, value);
}

/** 画面に出ている mermaid の SVG の中の、セレクタに該当する最初の要素の計算済みのスタイルの値 */
function shapeStyle(
  page: Page,
  selector: string,
  property: "fill" | "stroke" | "filter" | "fillOpacity",
): Promise<string> {
  return page.evaluate(
    ({ selector, property }) => {
      const svg = [
        ...document.querySelectorAll<SVGSVGElement>(".mdmark-mermaid svg[id]"),
      ].find((element) => getComputedStyle(element).display !== "none");
      const shape = svg?.querySelector(selector);
      return shape ? getComputedStyle(shape)[property] : "";
    },
    { selector, property },
  );
}

// flowchart のタイトルを図に重ねず、ノードを CSS 変数の色でグラデーションと影なく描く（Flowchart）
test("test_flowchart", async () => {
  // 準備・実行
  const page = await openMermaid("flowchart");
  // 検証
  await expect(page.locator("figcaption").innerText()).resolves.toBe(
    "問い合わせの受付",
  );
  await expect(
    page.locator(".mdmark-mermaid svg .flowchartTitleText").count(),
  ).resolves.toBe(0);
  const node = "g.node rect.label-container, g.node rect";
  await expect(shapeStyle(page, node, "fill")).resolves.toBe(
    await resolvedColor(page, "var(--mdmark-color-surface)"),
  );
  const stroke = await shapeStyle(page, node, "stroke");
  expect(stroke).toBe(await resolvedColor(page, "var(--mdmark-color-border)"));
  expect(stroke.startsWith("url(")).toBe(false);
  await expect(shapeStyle(page, node, "filter")).resolves.toBe("none");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// actor を lucide の人のアイコンで本文の色の線にし、参加者のノードに影を付けない（Sequence）
test("test_sequence", async () => {
  // 準備・実行
  const page = await openMermaid("sequence");
  // 検証
  await expect(
    page
      .locator(".mdmark-mermaid svg g.actor-man svg.mdmark-mermaid-actor")
      .count(),
  ).resolves.toBeGreaterThan(0);
  await expect(
    page.locator(".mdmark-mermaid svg g.actor-man > circle").count(),
  ).resolves.toBe(0);
  await expect(
    shapeStyle(page, "svg.mdmark-mermaid-actor path", "stroke"),
  ).resolves.toBe(await resolvedColor(page, "var(--mdmark-color-text)"));
  await expect(shapeStyle(page, "rect.actor", "filter")).resolves.toBe("none");
});

// タイトルが無いクラス図（Class）
test("test_class", async () => {
  // 準備・実行
  const page = await openMermaid("class");
  // 検証
  await expect(page.locator("figcaption").innerText()).resolves.toBe(
    "クラス図",
  );
  await expect(page.locator(".mdmark-mermaid svg").count()).resolves.toBe(1);
});

// 状態遷移図の開始と終了のマーカーを本文の色にする（State）
test("test_state", async () => {
  // 準備・実行
  const page = await openMermaid("state");
  // 検証
  const text = await resolvedColor(page, "var(--mdmark-color-text)");
  await expect(
    shapeStyle(page, 'g.node.default[id*="_end-"] > g:last-child path', "fill"),
  ).resolves.toBe(text);
  await expect(
    shapeStyle(
      page,
      'g.node.default[id*="_start-"] circle, g.node.default[id*="_start-"] path',
      "fill",
    ),
  ).resolves.toBe(text);
});

// ER 図（Er）
test("test_er", async () => {
  // 準備・実行
  const page = await openMermaid("er");
  // 検証
  await expect(page.locator("figcaption").innerText()).resolves.toBe("ER 図");
  await expect(
    page.locator('.mdmark-mermaid svg[aria-roledescription="er"]').count(),
  ).resolves.toBe(1);
});

// 720px で描いたガントチャートを、狭い枠では倍率の下限 0.75 で止め、収まらない分を枠の中で動かす（Gantt）
test("test_gantt", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mermaiddiagram--gantt", {
    width: 390,
    height: 844,
  });
  await page.waitForFunction(() =>
    (
      document.querySelector<HTMLElement>(".mdmark-diagram-stage")?.style
        .transform ?? ""
    ).startsWith("scale("),
  );
  // 検証
  const result = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".mdmark-diagram-stage");
    const viewport = document.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    return {
      transform: stage?.style.transform ?? "",
      overflows: (viewport?.scrollWidth ?? 0) > (viewport?.clientWidth ?? 0),
    };
  });
  expect(result.transform).toBe("scale(0.75)");
  expect(result.overflows).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 円グラフの扇形をグラフの系列の色で分け、不透明で塗る（Pie）
test("test_pie", async () => {
  // 準備・実行
  const page = await openMermaid("pie");
  // 検証
  const fills = await page.evaluate(() =>
    [
      ...document.querySelectorAll<SVGElement>(
        ".mdmark-mermaid svg path.pieCircle",
      ),
    ].map((slice) => getComputedStyle(slice).fill),
  );
  expect(fills[0]).toBe(
    await resolvedColor(page, "var(--mdmark-color-series-1)"),
  );
  expect(new Set(fills).size).toBe(fills.length);
  await expect(shapeStyle(page, "path.pieCircle", "fillOpacity")).resolves.toBe(
    "1",
  );
});

// 暗い配色の図と印刷のための明るい配色の図を並べ、画面では暗い配色の図だけを出す（DarkWithPrint）
test("test_dark_with_print", async () => {
  // 準備・実行
  const page = await openMermaid("dark-with-print");
  // 検証
  const shown = await page.evaluate(() =>
    [
      ...document.querySelectorAll<SVGSVGElement>(".mdmark-mermaid svg[id]"),
    ].map((svg) => ({
      print: svg.closest(".mdmark-mermaid-print") !== null,
      visible: svg.checkVisibility(),
    })),
  );
  expect(shown).toEqual([
    { print: false, visible: true },
    { print: true, visible: false },
  ]);
  await expect(
    page.locator(".mdmark-mermaid-print").getAttribute("aria-hidden"),
  ).resolves.toBe("true");
  await page.emulateMedia({ media: "print" });
  const printed = await page.evaluate(() =>
    [
      ...document.querySelectorAll<SVGSVGElement>(".mdmark-mermaid svg[id]"),
    ].map((svg) => svg.checkVisibility()),
  );
  expect(printed).toEqual([false, true]);
});
