import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** ボタンとスクロールする場所の右端・下端の間の既定（px） */
const GAP_PX = 16;

/** 押せる大きさの下限（px） */
const MIN_SIZE_PX = 44;

// 画面の右下から 16px の位置に、44px 以上のアイコンだけのボタンを出し、キーボードのフォーカスで輪郭を出す（Shown）
test("test_shown", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-backtotop--shown");
  // 検証
  const button = page.locator("button.mdmark-back-to-top");
  const info = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    return {
      type: element.getAttribute("type"),
      label: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      text: element.textContent?.trim(),
      iconHidden: element.querySelector("svg")?.getAttribute("aria-hidden"),
      position: getComputedStyle(element).position,
      right: clientWidth - rect.right,
      bottom: clientHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
  expect(info).toMatchObject({
    type: "button",
    label: "先頭へ戻る",
    title: "先頭へ戻る",
    text: "",
    iconHidden: "true",
    position: "fixed",
  });
  expect(Math.abs(info.right - GAP_PX)).toBeLessThanOrEqual(1);
  expect(Math.abs(info.bottom - GAP_PX)).toBeLessThanOrEqual(1);
  expect(info.width).toBeGreaterThanOrEqual(MIN_SIZE_PX);
  expect(info.height).toBeGreaterThanOrEqual(MIN_SIZE_PX);
  await expect(pageOverflows(page)).resolves.toBe(false);
  // 実行: Tab でフォーカスを移す
  await page.keyboard.press("Tab");
  // 検証
  const outline = await button.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      focused: document.activeElement === element,
      style: computed.outlineStyle,
      width: computed.outlineWidth,
      offset: computed.outlineOffset,
    };
  });
  expect(outline).toEqual({
    focused: true,
    style: "solid",
    width: "2px",
    offset: "2px",
  });
});

// 先頭の近くにいる間は出さず、Tab でも届かない（Hidden）
test("test_hidden", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-backtotop--hidden");
  // 検証
  const button = page.locator("button.mdmark-back-to-top");
  await expect(button.getAttribute("hidden")).resolves.toBe("");
  await expect(
    button.evaluate((element) => getComputedStyle(element).display),
  ).resolves.toBe("none");
  // 実行: Tab でフォーカスを移す
  await page.keyboard.press("Tab");
  // 検証
  await expect(
    button.evaluate((element) => document.activeElement === element),
  ).resolves.toBe(false);
});
