import { expect, test } from "vitest";

/** キーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadKbd = () => import("../../../../src/parts/kbd.ts");

// キーを `+` でつなぐ（正常系）
test("test_render_kbd", async () => {
  // 準備
  const { renderKbd } = await loadKbd();
  // 実行
  const html = renderKbd({ keys: ["Ctrl", "+"] });
  // 検証
  expect(html).toBe(
    '<span class="mdmark-kbd-group"><kbd class="mdmark-kbd">Ctrl</kbd><span class="mdmark-kbd-join">+</span><kbd class="mdmark-kbd">+</kbd></span>',
  );
});
