import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { contrastRatio, createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 蛍光ペンの文字と面の色 */
async function readMark(page: Page) {
  return page.locator("mark.mdmark-highlight").evaluate((mark) => ({
    color: getComputedStyle(mark).color,
    background: getComputedStyle(mark).backgroundColor,
    paragraph: getComputedStyle(mark.parentElement as Element).color,
    rects: mark.getClientRects().length,
  }));
}

// 色を指定しない蛍光ペンは、本文の文字の色のまま黄色の面を敷く（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-highlight--default");
  // 検証
  const mark = await readMark(page);
  expect(mark.color).toBe(mark.paragraph);
  expect(contrastRatio(mark.color, mark.background)).toBeGreaterThanOrEqual(
    4.5,
  );
});

// 色の名前の面にする（Colored）
test("test_colored", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-highlight--colored");
  const defaultPage = await holder.openStory("parts-highlight--default");
  // 検証
  const colored = await readMark(page);
  const plain = await readMark(defaultPage);
  expect(colored.background).not.toBe(plain.background);
  expect(
    contrastRatio(colored.color, colored.background),
  ).toBeGreaterThanOrEqual(4.5);
});

// 行をまたぐ長い中身は、行ごとに面を敷く（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-highlight--long");
  // 検証
  const mark = await readMark(page);
  expect(mark.rects).toBeGreaterThan(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 暗い配色でも、文字と面のコントラストを保つ（Dark）
test("test_dark", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-highlight--dark");
  // 検証
  const mark = await readMark(page);
  expect(contrastRatio(mark.color, mark.background)).toBeGreaterThanOrEqual(
    4.5,
  );
});
