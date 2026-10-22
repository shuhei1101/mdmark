import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 色を付けた箱 2 つを横に並べ、押しても何も起きないボタンを持つ。拡大・縮小のボタンは無い（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-embeddedhtml--default");
  // 検証
  const tops = await page
    .locator(".mdmark-html > div > div")
    .evaluateAll((boxes) =>
      boxes.map((box) => Math.round(box.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(2);
  expect(new Set(tops).size).toBe(1);
  const button = page.locator(".mdmark-html button");
  await expect(button.count()).resolves.toBe(1);
  await expect(button.getAttribute("onclick")).resolves.toBeNull();
  await expect(page.locator(".mdmark-diagram-tool").count()).resolves.toBe(0);
  await expect(
    page.locator(".mdmark-html").getAttribute("tabindex"),
  ).resolves.toBeNull();
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 見出しと段落の間にグラフを置き、グラフだけに図の枠のボタンがある（WithChart）
test("test_with_chart", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-embeddedhtml--with-chart");
  // 検証
  await expect(
    page.locator(".mdmark-html figure.mdmark-diagram").count(),
  ).resolves.toBe(1);
  await expect(
    page.locator(".mdmark-html > :not(figure) button").count(),
  ).resolves.toBe(0);
  await expect(
    page.locator("figure.mdmark-diagram button.mdmark-diagram-tool").count(),
  ).resolves.toBeGreaterThan(0);
  const order = await page
    .locator(".mdmark-html > *")
    .evaluateAll((children) => children.map((child) => child.tagName));
  expect(order).toEqual(["H3", "FIGURE", "P"]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 列より広い HTML は、中で横にスクロールし、キーボードで動かせるようフォーカスできる（Wide）
test("test_wide", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-embeddedhtml--wide");
  // 検証
  const embedded = page.locator(".mdmark-html");
  await expect(embedded.getAttribute("tabindex")).resolves.toBe("0");
  const metrics = await embedded.evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    scrolls: element.scrollWidth > element.clientWidth,
  }));
  expect(metrics).toEqual({ overflowX: "auto", scrolls: true });
  await expect(pageOverflows(page)).resolves.toBe(false);
});
