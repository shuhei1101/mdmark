import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 見出しの開閉のボタンの `::after`（開閉の印）の変形を返す */
function markTransform(page: import("playwright").Page): Promise<string> {
  return page
    .locator(".mdmark-section-toggle")
    .evaluate((element) => getComputedStyle(element, "::after").transform);
}

// 開いた節は、開いた向きの印を持ち、見出しを指すとアンカーが出る（Open）
test("test_open", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--open");
  // 検証
  const toggle = page.locator(".mdmark-section-toggle");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("true");
  await expect(page.locator(".mdmark-section-body").isVisible()).resolves.toBe(
    true,
  );
  await expect(markTransform(page)).resolves.toBe("none");
  const anchor = page.locator(".mdmark-anchor");
  await expect(
    anchor.evaluate((el) => getComputedStyle(el).opacity),
  ).resolves.toBe("0");
  await page.locator(".mdmark-heading").hover();
  await expect(
    anchor.evaluate((el) => getComputedStyle(el).opacity),
  ).resolves.toBe("1");
});

// 閉じた節は、中身が隠れ、開閉の印が閉じた向きになる（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--closed");
  // 検証
  const toggle = page.locator(".mdmark-section-toggle");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(
    page.locator(".mdmark-section-body").getAttribute("hidden"),
  ).resolves.toBe("until-found");
  await expect(
    page.locator(".mdmark-section-body").getAttribute("data-section"),
  ).resolves.toBe("closed");
  await expect(markTransform(page)).resolves.not.toBe("none");
});

// h4 の節は、h4 の見出しを持つ（Level4）
test("test_level_4", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--level-4");
  // 検証
  await expect(page.locator("h4.mdmark-heading").count()).resolves.toBe(1);
});

// h1 の節は、h2 の節と同じ開閉のボタンとアンカーを持つ（Level1）
test("test_level_1", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--level-1");
  // 検証
  await expect(page.locator("h1.mdmark-heading").count()).resolves.toBe(1);
  await expect(
    page.locator("h1 .mdmark-section-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(page.locator("h1 .mdmark-anchor").count()).resolves.toBe(1);
  await expect(markTransform(page)).resolves.toBe("none");
});

// 見出しが長く折り返しても、開閉の印とアンカーが見出しの文字に重ならない（LongTitle）
test("test_long_title", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--long-title");
  // 検証
  const overlap = await page.locator(".mdmark-heading").evaluate((heading) => {
    const text = heading.querySelector(".mdmark-section-toggle");
    const anchor = heading.querySelector(".mdmark-anchor");
    if (!text || !anchor) {
      return true;
    }
    const range = document.createRange();
    range.selectNodeContents(text);
    const anchorBox = anchor.getBoundingClientRect();
    return [...range.getClientRects()].some(
      (box) =>
        box.left < anchorBox.right &&
        box.right > anchorBox.left &&
        box.top < anchorBox.bottom &&
        box.bottom > anchorBox.top,
    );
  });
  expect(overlap).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// render が出した状態は、開閉のボタンが無く、閉じた節の中身も読める（Unmounted）
test("test_unmounted", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-section--unmounted");
  // 検証
  await expect(page.locator("#storybook-root button").count()).resolves.toBe(0);
  const body = page.locator(".mdmark-section-body");
  await expect(body.getAttribute("data-section")).resolves.toBe("closed");
  await expect(body.getAttribute("hidden")).resolves.toBeNull();
  await expect(body.isVisible()).resolves.toBe(true);
});
