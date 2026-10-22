import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 帯と印と枠の位置 */
async function readBand(id: string) {
  const page = await holder.openStory(id);
  const info = await page.evaluate(() => {
    const band = document.querySelector(".mdmark-diff-minimap") as HTMLElement;
    const bandRect = band.getBoundingClientRect();
    const marks = [
      ...band.querySelectorAll<HTMLElement>(".mdmark-diff-minimap-mark"),
    ];
    const view = band.querySelector(".mdmark-diff-minimap-view") as HTMLElement;
    const viewRect = view.getBoundingClientRect();
    return {
      hidden: band.getAttribute("aria-hidden"),
      position: getComputedStyle(band).position,
      band: {
        top: bandRect.top,
        height: bandRect.height,
        left: bandRect.left,
        right: bandRect.right,
      },
      marks: marks.map((mark) => {
        const rect = mark.getBoundingClientRect();
        return {
          kind: mark.dataset.kind,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          color: getComputedStyle(mark).backgroundColor,
        };
      }),
      view: { top: viewRect.top, height: viewRect.height },
      innerHeight: window.innerHeight,
      innerWidth: document.documentElement.clientWidth,
    };
  });
  return { page, info };
}

// 長い文書を開いた直後は、枠が帯の上端にあり、前半と後半に印が並ぶ（Top）
test("test_top", async () => {
  // 準備・実行
  const { page, info } = await readBand("parts-diffminimap--top");
  // 検証
  expect(info.hidden).toBe("true");
  expect(info.position).toBe("fixed");
  expect(Math.abs(info.band.height - info.innerHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(info.band.right - info.innerWidth)).toBeLessThanOrEqual(1);
  expect(info.marks).toHaveLength(6);
  const del = info.marks.filter((mark) => mark.kind === "del");
  const add = info.marks.filter((mark) => mark.kind === "add");
  expect(del.every((mark) => mark.left <= info.band.left + 2)).toBe(true);
  expect(add.every((mark) => mark.right >= info.band.right - 2)).toBe(true);
  expect(del[0]?.color).not.toBe(add[0]?.color);
  expect((info.marks[0]?.top ?? 0) - info.band.top).toBeCloseTo(
    info.band.height * 0.02,
    0,
  );
  expect(Math.abs(info.view.top - info.band.top)).toBeLessThanOrEqual(2);
  expect(info.view.height / info.band.height).toBeCloseTo(0.18, 1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 帯を押して中ほどへ送った後は、枠が中ほどにある（Middle）
test("test_middle", async () => {
  // 準備・実行
  const { info } = await readBand("parts-diffminimap--middle");
  // 検証
  expect((info.view.top - info.band.top) / info.band.height).toBeCloseTo(
    0.41,
    1,
  );
  expect(info.view.height / info.band.height).toBeCloseTo(0.18, 1);
});
