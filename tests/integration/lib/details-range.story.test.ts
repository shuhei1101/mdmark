import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 閉じた状態は、タイトルだけを出して中身を隠す（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-detailsrange--closed");
  // 検証
  const details = page.locator("details.mdmark-collapsible");
  await expect(
    details.evaluate((element) => (element as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(page.locator("summary").innerText()).resolves.toContain(
    "補足の手順",
  );
  await expect(page.locator("details p").isVisible()).resolves.toBe(false);
  // 実行
  await page.locator("summary").click();
  // 検証
  await expect(page.locator("details p").isVisible()).resolves.toBe(true);
});

// open を指定した状態は、中身を出す（Open）
test("test_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-detailsrange--open");
  // 検証
  await expect(page.locator("summary").innerText()).resolves.toContain(
    "実行の例",
  );
  await expect(page.locator("details p").isVisible()).resolves.toBe(true);
});
