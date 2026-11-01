import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 画像の図のストーリーを開き、図と中の要素の位置を返す */
async function open(id: string) {
  const page = await holder.openStory(`parts-imagefigure--${id}`);
  const layout = await page.evaluate(() => {
    const root = document.querySelector(".mdmark") as HTMLElement;
    const figure = root.querySelector("figure.mdmark-image") as HTMLElement;
    const image = figure.querySelector("img") as HTMLImageElement;
    const caption = figure.querySelector("figcaption");
    const paragraph = root.querySelector("p");
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect();
      return rect
        ? {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          }
        : null;
    };
    // 段落の最初の行の箱（回り込みは最初の行で見る）
    const firstLine = paragraph
      ? (() => {
          const range = document.createRange();
          range.selectNodeContents(paragraph);
          const rect = range.getClientRects()[0];
          return rect
            ? { left: rect.left, right: rect.right, top: rect.top }
            : null;
        })()
      : null;
    return {
      root: box(root),
      // 本文の幅（描く先の要素の内側の幅）
      contentWidth:
        root.clientWidth -
        Number.parseFloat(getComputedStyle(root).paddingLeft) -
        Number.parseFloat(getComputedStyle(root).paddingRight),
      contentLeft:
        (box(root)?.left ?? 0) +
        Number.parseFloat(getComputedStyle(root).paddingLeft),
      contentRight:
        (box(root)?.right ?? 0) -
        Number.parseFloat(getComputedStyle(root).paddingRight),
      figure: box(figure),
      image: box(image),
      caption: box(caption),
      firstLine,
      float: getComputedStyle(figure).float,
      display: getComputedStyle(figure).display,
      captionLineHeight: caption
        ? Number.parseFloat(getComputedStyle(caption).lineHeight)
        : 0,
    };
  });
  return { page, layout };
}

// title をキャプションにして画像の下に出し、画像を拡大のボタンで包んで右上に拡大のアイコンを置く（Caption）
test("test_caption", async () => {
  // 準備・実行
  const { page, layout } = await open("caption");
  // 検証
  await expect(
    page.locator("figure.mdmark-image figcaption").innerText(),
  ).resolves.toBe("プレビューを開いた画面");
  const button = page.locator("button.mdmark-image-open");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "画像を拡大: プレビューを開いた画面",
  );
  await expect(button.locator("img").getAttribute("alt")).resolves.toBe(
    "プレビューを開いた画面",
  );
  const icon = button.locator(".mdmark-image-open-icon");
  await expect(icon.getAttribute("aria-hidden")).resolves.toBe("true");
  expect(layout.caption?.top ?? 0).toBeGreaterThanOrEqual(
    (layout.image?.bottom ?? 0) - 1,
  );
  // ポインターを乗せると、右上にアイコンが出る
  await button.hover();
  const iconBox = await icon.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      right: rect.right,
      top: rect.top,
      opacity: getComputedStyle(element).opacity,
    };
  });
  expect(iconBox.opacity).toBe("1");
  expect(iconBox.right).toBeLessThanOrEqual(layout.image?.right ?? 0);
  expect(iconBox.right).toBeGreaterThan((layout.image?.right ?? 0) - 16);
  expect(iconBox.top).toBeLessThan((layout.image?.top ?? 0) + 16);
});

// title を持たない画像は、キャプションを出さない（NoCaption）
test("test_no_caption", async () => {
  // 準備・実行
  const { page } = await open("no-caption");
  // 検証
  await expect(
    page.locator("figure.mdmark-image figcaption").count(),
  ).resolves.toBe(0);
  await expect(
    page.locator("button.mdmark-image-open img").count(),
  ).resolves.toBe(1);
});

// width=240 の画像は、幅 240px で出す（WidthPx）
test("test_width_px", async () => {
  // 準備・実行
  const { layout } = await open("width-px");
  // 検証
  expect(layout.figure?.width).toBeCloseTo(240, 0);
  expect(layout.image?.width).toBeCloseTo(240, 0);
});

// width=50% の画像は、本文の幅の 50% で出す（WidthPercent）
test("test_width_percent", async () => {
  // 準備・実行
  const { layout } = await open("width-percent");
  // 検証
  expect(layout.figure?.width).toBeCloseTo(layout.contentWidth / 2, 0);
});

// align=left の画像は左に置き、右を本文が回り込む（AlignLeft）
test("test_align_left", async () => {
  // 準備・実行
  const { layout } = await open("align-left");
  // 検証
  expect(["left", "inline-start"]).toContain(layout.float);
  expect(layout.figure?.left).toBeCloseTo(layout.contentLeft, 0);
  expect(layout.firstLine?.left ?? 0).toBeGreaterThanOrEqual(
    layout.figure?.right ?? 0,
  );
  expect(layout.firstLine?.top ?? 0).toBeLessThan(layout.figure?.bottom ?? 0);
});

// align=right の画像は右に置き、左を本文が回り込む（AlignRight）
test("test_align_right", async () => {
  // 準備・実行
  const { layout } = await open("align-right");
  // 検証
  expect(["right", "inline-end"]).toContain(layout.float);
  expect(layout.figure?.right).toBeCloseTo(layout.contentRight, 0);
  expect(layout.firstLine?.right ?? 0).toBeLessThanOrEqual(
    layout.figure?.left ?? 0,
  );
  expect(layout.firstLine?.top ?? 0).toBeLessThan(layout.figure?.bottom ?? 0);
});

// align=center の画像は中央に置き、回り込まない（AlignCenter）
test("test_align_center", async () => {
  // 準備・実行
  const { layout } = await open("align-center");
  // 検証
  expect(layout.float).toBe("none");
  const leftGap = (layout.figure?.left ?? 0) - layout.contentLeft;
  const rightGap = layout.contentRight - (layout.figure?.right ?? 0);
  expect(leftGap).toBeGreaterThan(0);
  expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
});

// nolightbox の画像は拡大のボタンで包まず、アイコンを出さない（NoLightbox）
test("test_no_lightbox", async () => {
  // 準備・実行
  const { page } = await open("no-lightbox");
  // 検証
  await expect(page.locator("button.mdmark-image-open").count()).resolves.toBe(
    0,
  );
  await expect(page.locator(".mdmark-image-open-icon").count()).resolves.toBe(
    0,
  );
  await expect(
    page.locator("figure.mdmark-image > img").getAttribute("data-nolightbox"),
  ).resolves.toBe("");
});

// #only-light の画像は、明るい配色で出す（OnlyLight）
test("test_only_light", async () => {
  // 準備・実行
  const { page, layout } = await open("only-light");
  // 検証
  await expect(
    page.locator("figure.mdmark-image").getAttribute("class"),
  ).resolves.toContain("mdmark-only-light");
  expect(layout.display).not.toBe("none");
  expect(layout.image?.height ?? 0).toBeGreaterThan(0);
});

// #only-dark の画像は、暗い配色で出す（OnlyDark）
test("test_only_dark", async () => {
  // 準備・実行
  const { page, layout } = await open("only-dark");
  // 検証
  await expect(
    page.locator("figure.mdmark-image").getAttribute("class"),
  ).resolves.toContain("mdmark-only-dark");
  expect(layout.display).not.toBe("none");
  expect(layout.image?.height ?? 0).toBeGreaterThan(0);
});

// ギャラリーの中の画像は、キャプションの頭にサブ図の番号を出す（SubFigure）
test("test_sub_figure", async () => {
  // 準備・実行
  const { page } = await open("sub-figure");
  // 検証
  const figure = page.locator("figure.mdmark-image");
  await expect(figure.getAttribute("id")).resolves.toBe("fig-schemes-b");
  await expect(figure.locator("figcaption b").innerText()).resolves.toBe(
    "図 2b",
  );
  await expect(figure.locator("figcaption").innerText()).resolves.toBe(
    "図 2b暗い配色",
  );
});

// 長いキャプションは、画像の幅の中で折り返す（LongCaption）
test("test_long_caption", async () => {
  // 準備・実行
  const { page, layout } = await open("long-caption");
  // 検証
  expect(layout.caption?.width ?? 0).toBeLessThanOrEqual(
    (layout.figure?.width ?? 0) + 1,
  );
  expect(layout.caption?.height ?? 0).toBeGreaterThan(
    layout.captionLineHeight * 1.5,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});
