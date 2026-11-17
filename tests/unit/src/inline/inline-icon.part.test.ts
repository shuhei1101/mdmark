import { expect, test } from "vitest";

/** 行内のアイコンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInlineIcon = () => import("../../../../src/inline/inline-icon.part.ts");

// 構造があれば svg を入れる（正常系）
test("test_render_inline_icon", async () => {
  // 準備
  const { renderInlineIcon } = await loadInlineIcon();
  // 実行
  const withNode = renderInlineIcon({
    name: "check",
    node: [["path", { d: "M20 6 9 17l-5-5" }]],
  });
  const withoutNode = renderInlineIcon({ name: "sailboat" });
  // 検証
  expect(withNode).toMatch(
    /^<span class="mdmark-inline-icon" data-icon="check" aria-hidden="true"><svg class="mdmark-icon" viewBox="0 0 24 24"[^>]*><path d="M20 6 9 17l-5-5"><\/path><\/svg><\/span>$/,
  );
  expect(withoutNode).toBe(
    '<span class="mdmark-inline-icon" data-icon="sailboat" aria-hidden="true"></span>',
  );
});

