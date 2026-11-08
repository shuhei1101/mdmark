import { expect, test } from "vitest";

/** 色の名前の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadColors = () => import("../../../../src/parts/colors.ts");

// 7 つの名前だけを色の名前にする（正常系）
test("test_is_color_name", async () => {
  // 準備
  const { isColorName } = await loadColors();
  const values = ["blue", "gray", "Blue", "pink", ""];
  // 実行
  const results = values.map((value) => isColorName(value));
  // 検証
  expect(results).toEqual([true, true, false, false, false]);
});
