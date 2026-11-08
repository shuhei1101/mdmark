import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 図表のストーリーを開き、`figure` の id と題の文字を返す */
async function open(id: string) {
  const page = await holder.openStory(`parts-figure--${id}`);
  const figure = page.locator("figure.mdmark-figure");
  return {
    page,
    figure,
    caption: figure.locator("figcaption.mdmark-figure-caption"),
  };
}

// 画像は題を下に置き、番号の後ろに画像の title を続ける（ImageWithCaption）
test("test_image_with_caption", async () => {
  // 準備・実行
  const { figure, caption } = await open("image-with-caption");
  // 検証
  await expect(figure.getAttribute("id")).resolves.toBe("fig-arch");
  await expect(caption.innerText()).resolves.toBe("図 1全体の構成");
  await expect(caption.locator("b").innerText()).resolves.toBe("図 1");
  const below = await figure.evaluate((element) => {
    const image = element.querySelector("img")?.getBoundingClientRect();
    const caption = element
      .querySelector("figcaption")
      ?.getBoundingClientRect();
    return (caption?.top ?? 0) >= (image?.bottom ?? 0);
  });
  expect(below).toBe(true);
});

// 画像の title が無いときは、題が番号だけになる（Image）
test("test_image", async () => {
  // 準備・実行
  const { figure, caption } = await open("image");
  // 検証
  await expect(figure.getAttribute("id")).resolves.toBe("fig-flow");
  await expect(caption.innerText()).resolves.toBe("図 2");
});

// 表は題を表の上に置く（Table）
test("test_table", async () => {
  // 準備・実行
  const { figure, caption } = await open("table");
  // 検証
  await expect(figure.getAttribute("id")).resolves.toBe("fig-list");
  await expect(caption.innerText()).resolves.toBe("表 1");
  const above = await figure.evaluate((element) => {
    const table = element.querySelector("table")?.getBoundingClientRect();
    const caption = element
      .querySelector("figcaption")
      ?.getBoundingClientRect();
    return (caption?.bottom ?? 0) <= (table?.top ?? 0);
  });
  expect(above).toBe(true);
});

// fig のマーカーを付けたギャラリーは、外側の図の下に `図 2` を出し、中の画像にサブ図の番号を出す（Gallery）
test("test_gallery", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-figure--gallery");
  // 検証
  const figure = page.locator("figure#fig-schemes");
  await expect(figure.locator(":scope > figcaption").innerText()).resolves.toBe(
    "図 2配色ごとのプレビュー",
  );
  await expect(
    figure.locator(":scope > figcaption b").innerText(),
  ).resolves.toBe("図 2");
  await expect(
    figure
      .locator(".mdmark-gallery figure.mdmark-image figcaption b")
      .allInnerTexts(),
  ).resolves.toEqual(["図 2a", "図 2b"]);
  const below = await figure.evaluate((element) => {
    const gallery = element.querySelector(".mdmark-gallery");
    const caption = element.querySelector(":scope > figcaption");
    return (
      (caption?.getBoundingClientRect().top ?? 0) >=
      (gallery?.getBoundingClientRect().bottom ?? 0) - 1
    );
  });
  expect(below).toBe(true);
});
