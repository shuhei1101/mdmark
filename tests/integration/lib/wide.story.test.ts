import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 帯のボタンと範囲の状態 */
async function readWide(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector(".mdmark-wide-toggle");
    const shown = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display !== "none" : false;
    };
    const rect = button?.getBoundingClientRect();
    return {
      label: button?.getAttribute("aria-label"),
      pressed: button?.getAttribute("aria-pressed"),
      text: button?.textContent,
      shrink: shown(".mdmark-wide-icon-shrink"),
      expand: shown(".mdmark-wide-icon-expand"),
      size: rect ? [Math.round(rect.width), Math.round(rect.height)] : [],
      state: document
        .querySelector(".mdmark-wide-range")
        ?.getAttribute("data-state"),
    };
  });
}

// 広げた状態は、ボタンに縮めるアイコンだけを出す（Wide）
test("test_wide", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-wide--wide", {
    width: 1000,
    height: 400,
  });
  // 検証
  const wide = await readWide(page);
  expect(wide).toMatchObject({
    label: "広げて表示",
    pressed: "true",
    text: "",
    shrink: true,
    expand: false,
    state: "wide",
  });
  expect(wide.size).toEqual([28, 28]);
});

// 本文の幅にした状態は、ボタンに広げるアイコンだけを出す（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-wide--narrow", {
    width: 1000,
    height: 400,
  });
  // 検証
  await expect(readWide(page)).resolves.toMatchObject({
    label: "広げて表示",
    pressed: "false",
    shrink: false,
    expand: true,
    state: "narrow",
  });
});

// render が出す範囲は、ボタンを持たない（NoToggle）
test("test_no_toggle", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-wide--no-toggle", {
    width: 1000,
    height: 400,
  });
  // 検証
  await expect(page.locator(".mdmark-wide-toggle").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-wide-range table").count()).resolves.toBe(
    1,
  );
});

// 描く先の要素が 390px のときは、入らない分を範囲の中で横にスクロールさせ、文書を広げない（SmallScreen）
test("test_small_screen", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-wide--small-screen", {
    width: 1000,
    height: 400,
  });
  // 検証
  const overflow = await page
    .locator(".mdmark-wide-range")
    .evaluate((range) => getComputedStyle(range).overflowX);
  expect(overflow).toBe("auto");
  await expect(pageOverflows(page)).resolves.toBe(false);
});
