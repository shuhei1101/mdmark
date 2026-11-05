import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { contrastRatio, createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** キーの枠の線と面と書体 */
async function readKey(page: Page) {
  return page
    .locator(".mdmark-kbd")
    .first()
    .evaluate((key) => {
      const style = getComputedStyle(key);
      return {
        top: Number.parseFloat(style.borderTopWidth),
        bottom: Number.parseFloat(style.borderBottomWidth),
        font: style.fontFamily,
        color: style.color,
        background: style.backgroundColor,
      };
    });
}

// キー 1 つを、下端を太くした枠で描く（Single）
test("test_single", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-kbd--single");
  // 検証
  await expect(page.locator(".mdmark-kbd").allInnerTexts()).resolves.toEqual([
    "Enter",
  ]);
  const key = await readKey(page);
  expect(key.bottom).toBeGreaterThan(key.top);
  expect(key.font).toMatch(/mono|Menlo|Consolas/i);
});

// キーの組み合わせを + でつなぐ（Combo）
test("test_combo", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-kbd--combo");
  // 検証
  await expect(page.locator(".mdmark-kbd").allInnerTexts()).resolves.toEqual([
    "Ctrl",
    "Shift",
    "P",
  ]);
  await expect(page.locator(".mdmark-kbd-join").count()).resolves.toBe(2);
});

// + のキーを、つなぐ + と分けて描く（PlusKey）
test("test_plus_key", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-kbd--plus-key");
  // 検証
  await expect(page.locator(".mdmark-kbd").allInnerTexts()).resolves.toEqual([
    "Ctrl",
    "+",
  ]);
  await expect(page.locator(".mdmark-kbd-join").count()).resolves.toBe(1);
});

// 暗い配色でも、キーの文字と面のコントラストを保つ（Dark）
test("test_dark", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-kbd--dark");
  // 検証
  const key = await readKey(page);
  expect(contrastRatio(key.color, key.background)).toBeGreaterThanOrEqual(4.5);
});
