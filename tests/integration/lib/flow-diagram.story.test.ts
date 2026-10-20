import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 全体が収まる倍率になるまで待って、フロー図のストーリーを開く */
async function openFlow(id: string): Promise<Page> {
  const page = await holder.openStory(`parts-flowdiagram--${id}`);
  await page.waitForFunction(
    () =>
      document.querySelector(".mdmark-diagram-zoom")?.textContent !== "100%",
  );
  return page;
}

// 枠と 3 つの層・箱・5 種の線・交差・ループの戻りを描く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await openFlow("default");
  // 検証
  await expect(page.locator(".mdmark-diagram-lane").count()).resolves.toBe(3);
  await expect(page.locator(".mdmark-diagram-node").count()).resolves.toBe(9);
  await expect(
    page.locator(".mdmark-diagram-wires path.mdmark-diagram-wire").count(),
  ).resolves.toBe(10);
  await expect(
    page.locator('.mdmark-diagram-wires path[data-line="loop"]').count(),
  ).resolves.toBe(1);
  const arcs = await page
    .locator('.mdmark-diagram-wires path[data-line="flow"]')
    .evaluateAll(
      (paths) =>
        paths.filter((path) =>
          (path.getAttribute("d") ?? "").includes(" A6,6 "),
        ).length,
    );
  expect(arcs).toBeGreaterThanOrEqual(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長い題と箱の名前は、題を折り返し、箱の中で折り返して箱から出ない（LongNames）
test("test_long_names", async () => {
  // 準備・実行
  const page = await openFlow("long-names");
  // 検証
  const inside = await page
    .locator(".mdmark-diagram-node")
    .evaluateAll((nodes) =>
      nodes.every((node) => {
        const box = node.getBoundingClientRect();
        const name = node
          .querySelector(".mdmark-diagram-node-name")
          ?.getBoundingClientRect();
        return name
          ? name.right <= box.right + 1 && name.left >= box.left - 1
          : false;
      }),
    );
  expect(inside).toBe(true);
  const title = await page
    .locator(".mdmark-diagram-title")
    .evaluate((element) => element.getBoundingClientRect().right);
  expect(title).toBeLessThanOrEqual(420);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 定義を読めないときは、図の代わりに書き方の警告を出す（Invalid）
test("test_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-flowdiagram--invalid");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain("フロー図の部品の定義を JSON として読めません");
  await expect(page.locator("figure.mdmark-diagram").count()).resolves.toBe(0);
});
