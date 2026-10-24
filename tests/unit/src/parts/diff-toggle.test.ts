import { expect, test } from "vitest";
import { findTag, plainText } from "../../helpers/html.ts";

/** 差分を開くボタンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadToggle = () => import("../../../../src/parts/diff-toggle.ts");

// 開閉の状態を属性に出す（正常系）
test("test_render_diff_toggle", async () => {
  // 準備
  const { renderDiffToggle } = await loadToggle();
  // 実行
  const html = renderDiffToggle({ controls: "p1", expanded: true });
  // 検証
  const button = findTag(html, "mdmark-diff-toggle");
  expect(button).toContain('aria-expanded="true"');
  expect(button).toContain('aria-controls="p1"');
  expect(plainText(html)).toContain("変更を見る");
  expect(findTag(html, "<svg")).toContain('aria-hidden="true"');
});
