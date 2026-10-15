import { expect, test } from "vitest";
import { matches } from "../../helpers/html.ts";

/** ステップの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSteps = () => import("../../../../src/parts/steps.ts");

// 項目を並べ、start が 1 なら属性を省く（正常系）
test("test_render_steps", async () => {
  // 準備
  const { renderSteps } = await loadSteps();
  // 実行
  const html = renderSteps({ items: ["一つ目", "二つ目", "三つ目"], start: 1 });
  // 検証
  expect(html.startsWith('<ol class="mdmark-steps">')).toBe(true);
  expect(matches(html, /<li>/g)).toHaveLength(3);
  expect(html).not.toContain("start=");
});
