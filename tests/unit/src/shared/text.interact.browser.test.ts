import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 要素の見える文字を読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadText = () => import("../../../../src/shared/text.interact.ts");

afterEach(() => {
  removeRoots();
});

// ツールチップの文字を除く（正常系）
test("test_visible_text", async () => {
  // 準備
  const { visibleText } = await loadText();
  const root = createRootFromHtml(
    '<table><tbody><tr><td>本文の<span class="mdmark-term-wrap"><span class="mdmark-term">マーカー</span><span class="mdmark-term-tip">用語HTML コメントで記載する指定</span></span></td></tr></tbody></table>',
  );
  const cell = root.querySelector("td");
  const before = cell?.innerHTML;
  // 実行
  const text = cell ? visibleText(cell) : undefined;
  // 検証
  expect(text).toBe("本文のマーカー");
  expect(cell?.innerHTML).toBe(before);
});

// data-value を優先し、無ければ見える文字を読み込む（正常系）
test("test_cell_value", async () => {
  // 準備
  const { cellValue } = await loadText();
  const root = createRootFromHtml(
    '<table><tbody><tr><td data-value="false"><span class="mdmark-visually-hidden">いいえ</span></td><td>未定</td></tr></tbody></table>',
  );
  const [checked, plain] = [...root.querySelectorAll("td")];
  // 実行
  const values = [checked, plain].map((cell) =>
    cell ? cellValue(cell) : undefined,
  );
  // 検証
  expect(values).toEqual(["false", "未定"]);
});

// ツールチップとスクリーンリーダー用の文字を取り除き、見えている文字を残す（正常系）
test("test_remove_hidden_text", async () => {
  // 準備
  const { removeHiddenText } = await loadText();
  const root = createRootFromHtml(
    '<table><tbody><tr><td><span class="mdmark-term-wrap"><span class="mdmark-term">ターン</span><span class="mdmark-term-tip is-open">用語意味</span></span>と確認<sup class="mdmark-fn-ref"><a class="mdmark-fn-link"><span class="mdmark-visually-hidden">脚注 </span>1</a><span class="mdmark-fn-tip">脚注定義</span></sup></td></tr></tbody></table>',
  );
  const cell = root.querySelector("td");
  if (!cell) {
    throw new Error("セルが無い");
  }
  const before = cell.innerHTML;
  const copy = cell.cloneNode(true) as HTMLTableCellElement;
  // 実行
  removeHiddenText(copy);
  // 検証
  expect(copy.textContent).toBe("ターンと確認1");
  expect(cell.innerHTML).toBe(before);
});
