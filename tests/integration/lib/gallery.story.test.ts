import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 置き場所の幅が 32rem 以上になる画面（列を減らさない）
const WIDE_VIEWPORT = { width: 900, height: 700 };

/** ギャラリーのストーリーを開き、列の数と画像の図の位置を返す */
async function open(id: string, viewport = WIDE_VIEWPORT) {
  const page = await holder.openStory(`parts-gallery--${id}`, viewport);
  const layout = await page.evaluate(() => {
    const grid = document.querySelector(".mdmark-gallery-grid") as HTMLElement;
    const figures = [...grid.querySelectorAll(":scope > figure.mdmark-image")];
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      boxes: figures.map((figure) => {
        const rect = figure.getBoundingClientRect();
        const image = figure.querySelector("img") as HTMLImageElement;
        const imageRect = image.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          // 縦横比を保っているか（描いた高さと幅の比が元の比と同じ）
          ratio: imageRect.height / imageRect.width,
          naturalRatio: image.naturalHeight / image.naturalWidth,
        };
      }),
    };
  });
  return { page, layout };
}

/** 上から順に並ぶ行ごとの画像の数 */
function countPerRow(boxes: { top: number }[]): number[] {
  const rows = new Map<number, number>();
  for (const box of boxes) {
    const key = Math.round(box.top);
    rows.set(key, (rows.get(key) ?? 0) + 1);
  }
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, n]) => n);
}

// cols=3 の 4 枚は、3 列で並べて 4 枚目を 2 段目に置く（ThreeColumns）
test("test_three_columns", async () => {
  // 準備・実行
  const { page, layout } = await open("three-columns");
  // 検証
  await expect(
    page.locator(".mdmark-gallery").getAttribute("style"),
  ).resolves.toContain("--mdmark-gallery-cols: 3");
  expect(layout.columns).toBe(3);
  expect(countPerRow(layout.boxes)).toEqual([3, 1]);
  for (const box of layout.boxes) {
    expect(box.ratio).toBeCloseTo(box.naturalRatio, 2);
  }
});

// cols を省いた既定は 2 列（TwoColumns）
test("test_two_columns", async () => {
  // 準備・実行
  const { layout } = await open("two-columns");
  // 検証
  expect(layout.columns).toBe(2);
  expect(countPerRow(layout.boxes)).toEqual([2, 2]);
});

// 置き場所が 32rem より狭いと、cols=3 でも 2 列に減らす（NarrowTwo）
test("test_narrow_two", async () => {
  // 準備・実行
  const { page, layout } = await open("narrow-two");
  // 検証
  expect(layout.columns).toBe(2);
  expect(countPerRow(layout.boxes)).toEqual([2, 2]);
  for (const box of layout.boxes) {
    expect(box.ratio).toBeCloseTo(box.naturalRatio, 2);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 置き場所が 20rem より狭いと、1 列に減らす（NarrowOne）
test("test_narrow_one", async () => {
  // 準備・実行
  const { page, layout } = await open("narrow-one");
  // 検証
  expect(layout.columns).toBe(1);
  expect(countPerRow(layout.boxes)).toEqual([1, 1, 1, 1]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// fig のマーカーを付けたギャラリーは、外側の図の下に `図 2`、中の画像に `図 2a`・`図 2b` を出す（Numbered）
test("test_numbered", async () => {
  // 準備・実行
  const { page } = await open("numbered");
  // 検証
  const outer = page.locator("figure#fig-schemes");
  await expect(
    outer.locator(":scope > figcaption b").innerText(),
  ).resolves.toBe("図 2");
  await expect(
    outer.locator("figure.mdmark-image figcaption b").allInnerTexts(),
  ).resolves.toEqual(["図 2a", "図 2b"]);
  await expect(
    outer
      .locator("figure.mdmark-image")
      .evaluateAll((figures) => figures.map((figure) => figure.id)),
  ).resolves.toEqual(["fig-schemes-a", "fig-schemes-b"]);
  const below = await outer.evaluate((element) => {
    const grid = element.querySelector(".mdmark-gallery-grid");
    const caption = element.querySelector(":scope > figcaption");
    return (
      (caption?.getBoundingClientRect().top ?? 0) >=
      (grid?.getBoundingClientRect().bottom ?? 0) - 1
    );
  });
  expect(below).toBe(true);
});
