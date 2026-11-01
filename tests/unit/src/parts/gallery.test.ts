import { expect, test } from "vitest";
import { innerHtml } from "../../helpers/html.ts";

/** ギャラリーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGallery = () => import("../../../../src/parts/gallery.ts");

/** 中身の差し込み口の処理を読み込む */
const loadOwn = () => import("../../../../src/parts/own.ts");

// 列の数を style に置き、中身を格子に入れる（正常系）
test("test_render_gallery", async () => {
  // 準備
  const { renderGallery } = await loadGallery();
  const { SLOT_MARKER } = await loadOwn();
  // 実行
  const html = renderGallery({ cols: 3, body: SLOT_MARKER });
  // 検証
  expect(
    html.startsWith(
      '<div class="mdmark-gallery" style="--mdmark-gallery-cols: 3"><div class="mdmark-gallery-grid">',
    ),
  ).toBe(true);
  expect(innerHtml(html, 'class="mdmark-gallery-grid"')).toBe(SLOT_MARKER);
});
