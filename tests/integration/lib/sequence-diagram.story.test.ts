import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 相手 5 つを左から右へ、呼ぶと返すのメッセージを上から下へ並べ、繰り返しの戻りを描く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sequencediagram--default");
  await page.waitForFunction(
    () =>
      document.querySelector(".mdmark-diagram-zoom")?.textContent !== "100%",
  );
  // 検証
  const lefts = await page
    .locator(".mdmark-diagram-seq-heads .mdmark-diagram-node")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().left),
    );
  expect(lefts).toHaveLength(5);
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  const ys = await page
    .locator(
      '.mdmark-diagram-wires path.mdmark-diagram-wire:not([data-line="loop"])',
    )
    .evaluateAll((paths) =>
      paths.map((path) => path.getBoundingClientRect().top),
    );
  expect(ys).toHaveLength(6);
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
  await expect(
    page
      .locator(
        '.mdmark-diagram-wires path[data-line="reply"][stroke-dasharray]',
      )
      .count(),
  ).resolves.toBe(2);
  await expect(
    page.locator('.mdmark-diagram-wires path[data-line="loop"]').count(),
  ).resolves.toBe(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 定義を読めないときは、図の代わりに書き方の警告を出す（Invalid）
test("test_invalid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-sequencediagram--invalid");
  // 検証
  await expect(
    page.locator(".mdmark-syntax-warning").innerText(),
  ).resolves.toContain("シーケンス図の部品の定義を JSON として読めません");
  await expect(page.locator("figure.mdmark-diagram").count()).resolves.toBe(0);
});
