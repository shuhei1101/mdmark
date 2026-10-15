import { expect, test } from "vitest";

/** 印を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadOwn = () => import("../../../../src/parts/own.ts");

// 全ての開始タグに印を付け、閉じタグと文字はそのままにする（正常系）
test("test_mark_own", async () => {
  // 準備
  const { markOwn } = await loadOwn();
  const html = '<div class="a"><p>x &lt;y&gt;</p></div>';
  // 実行
  const marked = markOwn(html, "n1");
  // 検証
  expect(marked).toBe(
    '<div data-mdmark-own="n1" class="a"><p data-mdmark-own="n1">x &lt;y&gt;</p></div>',
  );
});
