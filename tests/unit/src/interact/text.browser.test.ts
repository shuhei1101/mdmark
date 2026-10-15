import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 要素の見える文字を読む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadText = () => import("../../../../src/interact/text.ts");

afterEach(() => {
  removeRoots();
});

// ツールチップの文字を除く（正常系）
test("test_visible_text", async () => {
  // 準備
  const { visibleText } = await loadText();
  const root = createRootFromHtml(
    '<table><tbody><tr><td>本文の<span class="mdmark-term-wrap"><span class="mdmark-term">印</span><span class="mdmark-term-tip">用語HTML コメントで書く指定</span></span></td></tr></tbody></table>',
  );
  const cell = root.querySelector("td");
  const before = cell?.innerHTML;
  // 実行
  const text = cell ? visibleText(cell) : undefined;
  // 検証
  expect(text).toBe("本文の印");
  expect(cell?.innerHTML).toBe(before);
});
