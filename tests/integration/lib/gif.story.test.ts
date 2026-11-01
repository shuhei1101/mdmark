import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** GIF のストーリーを開き、ボタン・画像・canvas の状態を返す */
async function open(id: string) {
  const page = await holder.openStory(`parts-gif--${id}`);
  await page
    .locator(".mdmark-gif img")
    .evaluate((image) => (image as HTMLImageElement).decode());
  return { page, state: await readState(page) };
}

/** ボタン・画像・canvas の状態 */
function readState(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector(".mdmark-gif") as HTMLElement;
    const image = wrap.querySelector("img") as HTMLImageElement;
    const canvas = wrap.querySelector("canvas") as HTMLCanvasElement;
    const toggle = wrap.querySelector(".mdmark-gif-toggle") as HTMLElement;
    const imageBox = image.getBoundingClientRect();
    const toggleBox = toggle.getBoundingClientRect();
    const shown = (selector: string) => {
      const icon = toggle.querySelector(selector);
      return icon ? getComputedStyle(icon).display !== "none" : false;
    };
    return {
      inFigure: wrap.parentElement?.matches("figure.mdmark-image") ?? false,
      pressed: toggle.getAttribute("aria-pressed"),
      label: toggle.getAttribute("aria-label"),
      openButton: wrap.querySelector("button.mdmark-image-open") !== null,
      imageVisibility: getComputedStyle(image).visibility,
      canvasHidden: canvas.hidden,
      canvasDisplay: getComputedStyle(canvas).display,
      canvasAriaHidden: canvas.getAttribute("aria-hidden"),
      toggleRightGap: imageBox.right - toggleBox.right,
      toggleTopGap: toggleBox.top - imageBox.top,
      pauseIcon: shown(".mdmark-gif-icon-pause"),
      playIcon: shown(".mdmark-gif-icon-play"),
    };
  });
}

// 再生している GIF は、画像の右上に停止のボタンを出す（Playing）
test("test_playing", async () => {
  // 準備・実行
  const { page, state } = await open("playing");
  // 検証
  expect(state.inFigure).toBe(true);
  expect(state.pressed).toBe("false");
  expect(state.label).toBe("GIF を停止");
  expect(state.pauseIcon).toBe(true);
  expect(state.playIcon).toBe(false);
  expect(state.imageVisibility).toBe("visible");
  expect(state.canvasHidden).toBe(true);
  expect(state.canvasDisplay).toBe("none");
  expect(state.canvasAriaHidden).toBe("true");
  expect(state.openButton).toBe(true);
  // 画像の右上の内側に置く
  expect(state.toggleRightGap).toBeGreaterThanOrEqual(0);
  expect(state.toggleRightGap).toBeLessThan(16);
  expect(state.toggleTopGap).toBeGreaterThanOrEqual(0);
  expect(state.toggleTopGap).toBeLessThan(16);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 止めた GIF は、最初のフレームを重ね、再生のボタンを押された状態で出す（Paused）
test("test_paused", async () => {
  // 準備・実行
  const { page, state } = await open("paused");
  // 検証
  expect(state.pressed).toBe("true");
  expect(state.label).toBe("GIF を再生");
  expect(state.playIcon).toBe(true);
  expect(state.pauseIcon).toBe(false);
  expect(state.imageVisibility).toBe("hidden");
  expect(state.canvasHidden).toBe(false);
  expect(state.canvasDisplay).not.toBe("none");
  // canvas に最初のフレームが描かれている（透明でない画素がある）
  await expect
    .poll(() =>
      page.locator(".mdmark-gif canvas").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas
          .getContext("2d")
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels?.some((value, index) => index % 4 === 3 && value > 0);
      }),
    )
    .toBe(true);
});

// nolightbox の GIF は、拡大のボタンで包まず、止める・再生するボタンだけを出す（NoLightbox）
test("test_no_lightbox", async () => {
  // 準備・実行
  const { state } = await open("no-lightbox");
  // 検証
  expect(state.openButton).toBe(false);
  expect(state.label).toBe("GIF を停止");
  expect(state.toggleRightGap).toBeGreaterThanOrEqual(0);
  expect(state.toggleRightGap).toBeLessThan(16);
});
