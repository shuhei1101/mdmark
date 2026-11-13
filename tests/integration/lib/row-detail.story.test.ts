import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 閉じた行の詳細は、開閉のボタンだけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-rowdetail--closed");
  // 検証
  const button = page.locator("button.mdmark-row-toggle");
  await expect(button.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "「table」の詳細",
  );
  const detail = page.locator("tr.mdmark-row-detail");
  await expect(detail.getAttribute("hidden")).resolves.not.toBeNull();
  await expect(detail.isVisible()).resolves.toBe(false);
});

// 開いた行の詳細は、行の下に詳細が表の幅いっぱいに出る（Open）
test("test_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-rowdetail--open");
  // 検証
  await expect(
    page.locator("button.mdmark-row-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  const detail = page.locator("tr.mdmark-row-detail");
  await expect(detail.isVisible()).resolves.toBe(true);
  await expect(detail.locator("td").getAttribute("colspan")).resolves.toBe("3");
  const layout = await page.evaluate(() => {
    const row = document
      .querySelector("#storybook-root tbody tr:not(.mdmark-row-detail)")
      ?.getBoundingClientRect();
    const detail = document
      .querySelector("#storybook-root tr.mdmark-row-detail")
      ?.getBoundingClientRect();
    return {
      below: (detail?.top ?? 0) >= (row?.bottom ?? 0) - 1,
      sameWidth: Math.abs((detail?.width ?? 0) - (row?.width ?? 1)) < 2,
    };
  });
  expect(layout.below).toBe(true);
  expect(layout.sameWidth).toBe(true);
});
