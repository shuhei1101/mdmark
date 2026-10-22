import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** ヒントのツールチップ */
function tipOf(page: Page) {
  return page.locator('[role="tooltip"]');
}

// ブロックの要素は右上に印があり、閉じている（Block）
test("test_block", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-hint--block");
  // 検証
  await expect(tipOf(page).isVisible()).resolves.toBe(false);
  const rects = await page.evaluate(() => {
    const block = document.querySelector(".mdmark-hint-block");
    const mark = document.querySelector(".mdmark-hint-mark");
    if (!block || !mark) {
      throw new Error("ヒントの要素が無い");
    }
    const b = block.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    return {
      inside: m.top >= b.top && m.right <= b.right,
      topRight: m.left > b.left + b.width / 2 && m.top - b.top < 12,
      cursor: getComputedStyle(block).cursor,
    };
  });
  expect(rects.inside).toBe(true);
  expect(rects.topRight).toBe(true);
  expect(rects.cursor).not.toBe("help");
  await expect(
    page.locator(".mdmark-hint-mark").getAttribute("aria-label"),
  ).resolves.toBe("説明");
});

// ブロックの要素の印に乗せて開いた状態は、印の下に文を出し、横にはみ出さない（BlockOpen）
test("test_block_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-hint--block-open");
  // 検証
  await expect(tipOf(page).isVisible()).resolves.toBe(true);
  await expect(tipOf(page).innerText()).resolves.toContain(
    "返信の種類を 1 つ選ぶ",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 行内の要素は、破線の下線を持ち、フォーカスできる（Inline）
test("test_inline", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-hint--inline");
  // 検証
  const inline = page.locator(".mdmark-hint-inline");
  await expect(inline.getAttribute("tabindex")).resolves.toBe("0");
  const style = await inline.evaluate((element) => ({
    decoration: getComputedStyle(element).textDecorationStyle,
    cursor: getComputedStyle(element).cursor,
  }));
  expect(style.decoration).toBe("dashed");
  expect(style.cursor).not.toBe("help");
  await expect(tipOf(page).isVisible()).resolves.toBe(false);
});

// 行内の要素にフォーカスして開いた状態は、ダークでもツールチップの文字が読める（InlineOpen）
test("test_inline_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-hint--inline-open");
  // 検証
  await expect(tipOf(page).isVisible()).resolves.toBe(true);
  await expect(tipOf(page).innerText()).resolves.toContain(
    "返信の種類を 1 つ選ぶ",
  );
  const light = await tipOf(page).evaluate((tip) => ({
    color: getComputedStyle(tip).color,
    background: getComputedStyle(tip).backgroundColor,
  }));
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await tipOf(page).evaluate((tip) => ({
    color: getComputedStyle(tip).color,
    background: getComputedStyle(tip).backgroundColor,
  }));
  expect(light.color).not.toBe(light.background);
  expect(dark.color).not.toBe(dark.background);
  expect(dark.background).not.toBe(light.background);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 書いた人が地の色を付けたブロックの要素でも、印が地の色の上で読める（Colored）
test("test_colored", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-hint--colored");
  // 検証
  const colors = await page.evaluate(() => {
    const block = document.querySelector(".mdmark-hint-block");
    const mark = document.querySelector(".mdmark-hint-mark");
    if (!block || !mark) {
      throw new Error("ヒントの要素が無い");
    }
    return {
      block: getComputedStyle(block).color,
      mark: getComputedStyle(mark).color,
      background: getComputedStyle(block).backgroundColor,
    };
  });
  expect(colors.mark).toBe(colors.block);
  expect(colors.mark).not.toBe(colors.background);
  await expect(page.locator(".mdmark-hint-mark").isVisible()).resolves.toBe(
    true,
  );
});
