import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, plainText } from "../../helpers/html.ts";

/** ライトボックスの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLightbox = () => import("../../../../src/parts/lightbox.ts");

/** 読み上げの名前が `label` のボタンの開始タグを返す */
function toolTag(html: string, label: string): string {
  return findTag(html, `aria-label="${label}"`);
}

/** 開始タグが `disabled` を持つか */
function isDisabled(tag: string): boolean {
  return /\sdisabled\b/.test(tag);
}

// 途中の画像は前後に送れ、枚数を出す（正常系）
test("test_render_lightbox", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Middle）
  const html = renderLightbox({
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption: "幅 240px",
    index: 3,
    total: 15,
  });
  // 検証
  expect(
    html.startsWith('<dialog class="mdmark-lightbox" aria-label="画像の拡大">'),
  ).toBe(true);
  expect(isDisabled(toolTag(html, "前の画像"))).toBe(false);
  expect(isDisabled(toolTag(html, "次の画像"))).toBe(false);
  expect(plainText(innerHtml(html, 'class="mdmark-lightbox-count"'))).toBe(
    "3 / 15",
  );
  expect(findTag(html, 'data-group="pan"')).toMatch(/\shidden\b/);
});

// 端の送りのボタンを押せなくする（正常系）
test("test_render_lightbox_when_edge", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の First と Last）
  const first = renderLightbox({
    src: "step-1.svg",
    alt: "手順 1 の画面",
    index: 1,
    total: 15,
  });
  const last = renderLightbox({
    src: "step-4.svg",
    alt: "手順 4 の画面",
    index: 15,
    total: 15,
  });
  // 検証
  expect(isDisabled(toolTag(first, "前の画像"))).toBe(true);
  expect(isDisabled(toolTag(first, "次の画像"))).toBe(false);
  expect(isDisabled(toolTag(last, "前の画像"))).toBe(false);
  expect(isDisabled(toolTag(last, "次の画像"))).toBe(true);
});

// 1 枚なら送りのボタンと枚数を出さない（正常系）
test("test_render_lightbox_when_single", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Single）
  const html = renderLightbox({
    src: "step-3.svg",
    alt: "手順 3 の画面",
    caption: "中央に置いた画面",
    index: 1,
    total: 1,
  });
  // 検証
  expect(findTags(html, "mdmark-lightbox-nav")).toHaveLength(0);
});

// 上限の倍率で拡大を押せなくし、移動のボタンを出す（正常系）
test("test_render_lightbox_when_max", async () => {
  // 準備
  const { renderLightbox } = await loadLightbox();
  // 実行（部品設計の Max）
  const html = renderLightbox({
    src: "step-2.svg",
    alt: "手順 2 の画面",
    index: 3,
    total: 15,
    zoom: 3,
  });
  // 検証
  expect(isDisabled(toolTag(html, "拡大"))).toBe(true);
  expect(plainText(innerHtml(html, 'class="mdmark-lightbox-zoom"'))).toBe(
    "300%",
  );
  expect(findTag(html, 'data-group="pan"')).not.toMatch(/\shidden\b/);
});
