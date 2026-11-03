import { expect, test } from "vitest";
import { findTag } from "../../helpers/html.ts";

/** 先頭へ戻るボタンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBackToTop = () => import("../../../../src/parts/back-to-top.ts");

/** 開始タグが値なしの hidden 属性を持つか */
const HIDDEN_ATTRIBUTE = /\shidden(?=[\s=>])/;

// 読み上げの名前とアイコンを持つボタンを返す（正常系）
test("test_render_back_to_top", async () => {
  // 準備
  const { renderBackToTop } = await loadBackToTop();
  // 実行
  const html = renderBackToTop();
  // 検証
  const button = findTag(html, "<button");
  expect(button).toContain('class="mdmark-back-to-top"');
  expect(button).toContain('type="button"');
  expect(button).toContain('aria-label="先頭へ戻る"');
  expect(button).toContain('title="先頭へ戻る"');
  expect(button).not.toMatch(HIDDEN_ATTRIBUTE);
  expect(findTag(html, "<svg")).toContain('aria-hidden="true"');
  expect(html).toContain('d="M5 3h14"');
});

// hidden を属性に写す（正常系）
test("test_render_back_to_top_when_hidden", async () => {
  // 準備
  const { renderBackToTop } = await loadBackToTop();
  // 実行
  const html = renderBackToTop({ hidden: true });
  // 検証
  expect(findTag(html, "<button")).toMatch(HIDDEN_ATTRIBUTE);
});
