import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** ライトボックスの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLightbox = () => import("../../../../src/interact/lightbox.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 幅 `width`・高さ `height` の SVG の画像の data: URL */
function svgUrl(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#888"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** `render` が出す画像の図（拡大のボタンは付けない） */
function figureHtml(
  alt: string,
  options: { src?: string; caption?: string; className?: string } = {},
): string {
  const { src = svgUrl(400, 300), caption = alt, className = "" } = options;
  return `<figure class="mdmark-figure mdmark-image${className}"><img src="${src}" alt="${alt}"><figcaption class="mdmark-figure-caption">${caption}</figcaption></figure>`;
}

/** 拡大のボタンを全て返す */
function openers(root: ParentNode): HTMLButtonElement[] {
  return [
    ...root.querySelectorAll<HTMLButtonElement>("button.mdmark-image-open"),
  ];
}

/** 開いているライトボックスを返す */
function openDialog(root: ParentNode): HTMLDialogElement {
  const dialog = root.querySelector<HTMLDialogElement>(
    "dialog.mdmark-lightbox[open]",
  );
  if (!dialog) {
    throw new Error("開いたライトボックスが無い");
  }
  return dialog;
}

/** 読み上げの名前でボタンを探す */
function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) {
    throw new Error(`ボタンが無い: ${name}`);
  }
  return found;
}

/** ライトボックスの枚数の文字 */
function countText(dialog: ParentNode): string {
  return dialog.querySelector(".mdmark-lightbox-count")?.textContent ?? "";
}

/** ライトボックスの倍率の文字 */
function zoomText(dialog: ParentNode): string {
  return dialog.querySelector(".mdmark-lightbox-zoom")?.textContent ?? "";
}

// 隠れている配色の画像を除く（正常系）
test("test_collect_lightbox_images", async () => {
  // 準備
  const { attachLightbox, collectLightboxImages } = await loadLightbox();
  const root = createRootFromHtml(
    [
      figureHtml("1 つ目"),
      figureHtml("明るい配色だけ", { className: " mdmark-only-light" }),
      figureHtml("2 つ目"),
    ].join(""),
  );
  root.classList.add("mdmark-theme-dark");
  detachers.push(attachLightbox(root));
  // 実行
  const images = collectLightboxImages(root);
  // 検証
  expect(images.map((image) => image.querySelector("img")?.alt)).toEqual([
    "1 つ目",
    "2 つ目",
  ]);
});

// 画像を包み、押すと開いて送る（正常系）
test("test_attach_lightbox", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const root = createRootFromHtml(
    [figureHtml("1 枚目"), figureHtml("2 枚目"), figureHtml("3 枚目")].join(""),
  );
  // 実行
  detachers.push(attachLightbox(root));
  // 検証: 包む
  for (const img of root.querySelectorAll("img")) {
    expect(img.parentElement?.matches("button.mdmark-image-open")).toBe(true);
  }
  // 実行: 2 つ目を開く
  openers(root)[1]?.click();
  // 検証
  const dialog = openDialog(root);
  expect(countText(dialog)).toBe("2 / 3");
  // 実行: 次へ送る
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(countText(dialog)).toBe("3 / 3");
  expect(button(dialog, "次の画像").disabled).toBe(true);
});

// 拡大中の矢印キーは送らず動かし、送ると倍率を戻す（正常系）
test("test_attach_lightbox_when_zoomed", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const wide = svgUrl(3000, 1000);
  const root = createRootFromHtml(
    [
      figureHtml("広い 1 枚目", { src: wide }),
      figureHtml("広い 2 枚目", { src: wide }),
    ].join(""),
  );
  detachers.push(attachLightbox(root));
  openers(root)[0]?.click();
  const dialog = openDialog(root);
  await vi.waitFor(() => {
    expect(zoomText(dialog)).not.toBe("100%");
  });
  const fit = zoomText(dialog);
  button(dialog, "拡大").click();
  button(dialog, "拡大").click();
  const stage = dialog.querySelector<HTMLElement>(".mdmark-lightbox-stage");
  if (!stage) {
    throw new Error("画像の場所が無い");
  }
  const before = stage.scrollLeft;
  // 実行: 拡大中の矢印キー
  stage.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(countText(dialog)).toBe("1 / 2");
  expect(stage.scrollLeft - before).toBe(80);
  // 実行: 次の画像へ送る
  button(dialog, "次の画像").click();
  // 検証
  expect(countText(dialog)).toBe("2 / 2");
  await vi.waitFor(() => {
    expect(zoomText(dialog)).toBe(fit);
  });
});

// 閉じるとフォーカスを戻す（正常系）
test("test_attach_lightbox_when_closed", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const root = createRootFromHtml(
    [figureHtml("1 枚目"), figureHtml("2 枚目")].join(""),
  );
  detachers.push(attachLightbox(root));
  const opener = openers(root)[0];
  if (!opener) {
    throw new Error("拡大のボタンが無い");
  }
  const scrollY = window.scrollY;
  // 実行: Esc で閉じる
  opener.click();
  openDialog(root);
  await userEvent.keyboard("{Escape}");
  // 検証
  await vi.waitFor(() => {
    expect(root.querySelector("dialog")).toBeNull();
  });
  expect(document.activeElement).toBe(opener);
  expect(window.scrollY).toBe(scrollY);
  // 実行: 画像の外の背景を押して閉じる
  opener.click();
  const stage = openDialog(root).querySelector<HTMLElement>(
    ".mdmark-lightbox-stage",
  );
  if (!stage) {
    throw new Error("画像の場所が無い");
  }
  await userEvent.click(stage, { position: { x: 2, y: 2 } });
  // 検証
  await vi.waitFor(() => {
    expect(root.querySelector("dialog")).toBeNull();
  });
  expect(document.activeElement).toBe(opener);
  expect(window.scrollY).toBe(scrollY);
});

// 拡大しない画像は包まない（正常系）
test("test_attach_lightbox_when_not_wrapped", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const src = svgUrl(40, 40);
  const root = createRootFromHtml(
    [
      `<figure class="mdmark-figure mdmark-image"><img src="${src}" alt="拡大しない" data-nolightbox></figure>`,
      `<p><a href="https://example.com"><img src="${src}" alt="ロゴ"></a></p>`,
      `<p>押す前に <img src="${src}" alt="アイコン"> を確かめる。</p>`,
    ].join(""),
  );
  // 実行
  detachers.push(attachLightbox(root));
  // 検証
  expect(openers(root)).toHaveLength(0);
});

// 外すと元に戻る（正常系）
test("test_attach_lightbox_when_cleaned_up", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const root = createRootFromHtml(
    [figureHtml("1 枚目"), figureHtml("2 枚目")].join(""),
  );
  const detach = attachLightbox(root);
  openers(root)[0]?.click();
  openDialog(root);
  // 実行
  detach();
  // 検証
  expect(root.querySelector("dialog")).toBeNull();
  expect(openers(root)).toHaveLength(0);
  for (const img of root.querySelectorAll("img")) {
    expect(img.parentElement?.matches("figure.mdmark-image")).toBe(true);
  }
});

// GIF の画像の拡大のボタンにはアイコンを置かない（正常系）
test("test_attach_lightbox_when_gif", async () => {
  // 準備
  const { attachLightbox } = await loadLightbox();
  const root = createRootFromHtml(
    `<figure class="mdmark-figure mdmark-image"><img src="${svgUrl(40, 40)}" alt="ビルド" data-gif></figure>`,
  );
  // 実行
  detachers.push(attachLightbox(root));
  // 検証
  const opener = root.querySelector("img[data-gif]")?.parentElement;
  expect(opener?.matches("button.mdmark-image-open")).toBe(true);
  expect(opener?.querySelector(".mdmark-image-open-icon")).toBeNull();
});
