import { expect, test } from "vitest";

/** 文字の色の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTextColor = () => import("../../../../src/parts/text-color.ts");

// 色の名前を data-color にして中身を包む（正常系）
test("test_render_text_color", async () => {
  // 準備
  const { renderTextColor } = await loadTextColor();
  // 実行
  const html = renderTextColor({
    color: "blue",
    text: "<strong>重要</strong>",
  });
  // 検証
  expect(html).toBe(
    '<span class="mdmark-color" data-color="blue"><strong>重要</strong></span>',
  );
});
