import { expect, type Locator, type Page } from "@playwright/test";

// 境界の比べで許す、小数の丸めの差（px）
const EDGE_TOLERANCE_PX = 1;

/** ツールチップが持ち主の上にも下にも収まるよう、描く先の要素の上下に余白を取る CSS */
export const ROOM_CSS = "#doc { padding-block: 300px; }";

/** 持ち主の上端を画面の上端に揃えるまでスクロールできるよう、描く先の要素の上下に高い余白を取る CSS */
export const TALL_CSS = "#doc { padding-block: 600px 1500px; }";

/** 文書をページの上端に置くため、本文の余白を消す CSS */
export const TOP_EDGE_CSS = "body { margin: 0; }";

/** 画面に対する要素の範囲 */
type Box = { x: number; y: number; width: number; height: number };

/** 要素の画面に対する範囲を返す。描かれていなければ投げる */
async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("要素の範囲を取れない");
  }
  return box;
}

/** ツールチップの下端が持ち主の上端より上にあることを確かめる */
export async function expectAbove(options: {
  tip: Locator;
  owner: Locator;
}): Promise<void> {
  const tip = await boxOf(options.tip);
  const owner = await boxOf(options.owner);
  expect(tip.y + tip.height).toBeLessThanOrEqual(owner.y + EDGE_TOLERANCE_PX);
}

/** ツールチップの上端が持ち主の下端より下にあることを確かめる */
export async function expectBelow(options: {
  tip: Locator;
  owner: Locator;
}): Promise<void> {
  const tip = await boxOf(options.tip);
  const owner = await boxOf(options.owner);
  expect(tip.y).toBeGreaterThanOrEqual(
    owner.y + owner.height - EDGE_TOLERANCE_PX,
  );
}

/** ツールチップの全体が画面の中に収まっていることを確かめる */
export async function expectInViewport(options: {
  page: Page;
  tip: Locator;
}): Promise<void> {
  const viewport = options.page.viewportSize();
  if (!viewport) {
    throw new Error("画面の大きさを取れない");
  }
  const tip = await boxOf(options.tip);
  expect(tip.x).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(tip.y).toBeGreaterThanOrEqual(-EDGE_TOLERANCE_PX);
  expect(tip.x + tip.width).toBeLessThanOrEqual(
    viewport.width + EDGE_TOLERANCE_PX,
  );
  expect(tip.y + tip.height).toBeLessThanOrEqual(
    viewport.height + EDGE_TOLERANCE_PX,
  );
}

/** 要素の上端が画面の上端に揃うまでページをスクロールする */
export async function scrollToTop(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    window.scrollBy(0, element.getBoundingClientRect().top);
  });
}
