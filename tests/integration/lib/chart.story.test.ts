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
