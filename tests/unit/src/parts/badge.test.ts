import { expect, test } from "vitest";

/** バッジの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBadge = () => import("../../../../src/parts/badge.ts");

// 文言をエスケープして札にする（正常系）
test("test_render_badge", async () => {
  // 準備
  const { renderBadge } = await loadBadge();
  // 実行
  const html = renderBadge({ label: "<b>v1</b>" });
  // 検証
  expect(html).toBe('<span class="mdmark-badge">&lt;b&gt;v1&lt;/b&gt;</span>');
});

// 色の名前を data-color にする（正常系）
test("test_render_badge_when_colored", async () => {
  // 準備
  const { renderBadge } = await loadBadge();
  // 実行
  const html = renderBadge({ label: "要確認", color: "red" });
  // 検証
  expect(html).toBe(
    '<span class="mdmark-badge" data-color="red">要確認</span>',
  );
});
