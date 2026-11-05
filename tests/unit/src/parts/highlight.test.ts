import { expect, test } from "vitest";

/** 蛍光ペンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHighlight = () => import("../../../../src/parts/highlight.ts");

// 色があれば `data-color` を付ける（正常系）
test("test_render_highlight", async () => {
  // 準備
  const { renderHighlight } = await loadHighlight();
  // 実行
  const plain = renderHighlight({ html: "決め手" });
  const colored = renderHighlight({ html: "例外", color: "green" });
  // 検証
  expect(plain).toBe('<mark class="mdmark-highlight">決め手</mark>');
  expect(colored).toBe(
    '<mark class="mdmark-highlight" data-color="green">例外</mark>',
  );
});
