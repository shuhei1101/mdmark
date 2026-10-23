import { expect, test } from "vitest";

/** エディタのスクロールの見張りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGuard = () =>
  import("../../../../../vscode/src/preview/scroll-guard.ts");

// 先頭から 6 行を超えた先の行だけ動かす（正常系）
test("test_should_reveal", async () => {
  // 準備
  const { EditorScrollGuard } = await loadGuard();
  const visibleStart = 100;
  // 実行
  const results = [106, 107, 99].map((line) =>
    new EditorScrollGuard().shouldReveal(line, visibleStart),
  );
  // 検証
  expect(results).toEqual([false, true, true]);
});

// 動かした行を含む最初の知らせだけを捨てる（正常系）
test("test_take_visible_range", async () => {
  // 準備
  const { EditorScrollGuard } = await loadGuard();
  const guard = new EditorScrollGuard();
  guard.shouldReveal(150, 0);
  // 実行
  const first = guard.takeVisibleRange({ start: 145, end: 190 });
  const second = guard.takeVisibleRange({ start: 145, end: 190 });
  // 検証
  expect(first).toBe(false);
  expect(second).toBe(true);
});

// 動かした行を含まない知らせは送り、覚えを消す（正常系）
test("test_take_visible_range_when_not_containing", async () => {
  // 準備
  const { EditorScrollGuard } = await loadGuard();
  const guard = new EditorScrollGuard();
  guard.shouldReveal(150, 0);
  // 実行
  const outside = guard.takeVisibleRange({ start: 10, end: 50 });
  const containing = guard.takeVisibleRange({ start: 145, end: 190 });
  // 検証
  expect(outside).toBe(true);
  expect(containing).toBe(true);
});
