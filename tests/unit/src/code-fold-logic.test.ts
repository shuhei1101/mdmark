import { expect, test } from "vitest";

/** コードの行の畳みの計算を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadLogic = (): Promise<typeof import("../../../src/code-fold-logic.ts")> =>
  import(
    /* @vite-ignore */ new URL("../../../src/code-fold-logic.ts", import.meta.url)
      .href
  );

// 最も小さい幅を 1 レベルにする（正常系）
test("test_measure_indents", async () => {
  // 準備
  const { measureIndents } = await loadLogic();
  // 実行
  const indents = measureIndents(["a:", "  b:", "    c: 1", "", "\td"]);
  // 検証
  expect(indents).toEqual([0, 1, 2, undefined, 1]);
});

// 4 つの空白を 1 レベルにする（正常系）
test("test_measure_indents_when_four_spaces", async () => {
  // 準備
  const { measureIndents } = await loadLogic();
  // 実行
  const indents = measureIndents(["{", "    a", "        b", "}"]);
  // 検証
  expect(indents).toEqual([0, 1, 2, 0]);
});

// 入れ子の畳む行の数を決め、閉じ括弧の行を含めない（正常系）
test("test_fold_lines_of", async () => {
  // 準備
  const { foldLinesOf } = await loadLogic();
  // 実行
  const foldLines = foldLinesOf([0, 1, 2, 1, 0]);
  // 検証
  expect(foldLines).toEqual([3, 1, undefined, undefined, undefined]);
});

// 範囲の末尾の空行を含めない（正常系）
test("test_fold_lines_of_when_trailing_blank", async () => {
  // 準備
  const { foldLinesOf } = await loadLogic();
  // 実行
  const foldLines = foldLinesOf([0, 1, undefined, 0]);
  // 検証
  expect(foldLines).toEqual([1, undefined, undefined, undefined]);
});

// 外側を開いても内側の畳んだ行を隠す（正常系）
test("test_hidden_lines_of", async () => {
  // 準備
  const { hiddenLinesOf } = await loadLogic();
  // 実行
  const hidden = hiddenLinesOf({
    foldLines: [3, 1, undefined, undefined],
    folded: [false, true, false, false],
  });
  // 検証
  expect(hidden).toEqual(new Set([2]));
});

// 外側を畳むと範囲の行を全て隠す（正常系）
test("test_hidden_lines_of_when_outer_folded", async () => {
  // 準備
  const { hiddenLinesOf } = await loadLogic();
  // 実行
  const hidden = hiddenLinesOf({
    foldLines: [3, 1, undefined, undefined],
    folded: [true, true, false, false],
  });
  // 検証
  expect(hidden).toEqual(new Set([1, 2, 3]));
});

// 最も内側の範囲を返す（正常系）
test("test_guide_range_of", async () => {
  // 準備
  const { guideRangeOf } = await loadLogic();
  // 実行
  const range = guideRangeOf({
    indents: [0, 1, 2, 1],
    foldLines: [3, 1, undefined, undefined],
    index: 2,
  });
  // 検証
  expect(range).toEqual({ from: 2, to: 2, depth: 2 });
});

// レベルを飛ばしたインデントでも深さをレベルから決める（正常系）
test("test_guide_range_of_when_level_skipped", async () => {
  // 準備
  const { guideRangeOf } = await loadLogic();
  // 実行
  const range = guideRangeOf({
    indents: [0, 2, 2],
    foldLines: [2, undefined, undefined],
    index: 1,
  });
  // 検証
  expect(range).toEqual({ from: 1, to: 2, depth: 1 });
});

// 範囲の外の行は undefined（正常系）
test("test_guide_range_of_when_outside", async () => {
  // 準備
  const { guideRangeOf } = await loadLogic();
  // 実行
  const range = guideRangeOf({
    indents: [0, 2, 2],
    foldLines: [2, undefined, undefined],
    index: 0,
  });
  // 検証
  expect(range).toBeUndefined();
});
