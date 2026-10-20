import { expect, test } from "vitest";
import type { MdmarkDiagramWire } from "../../../../src/diagram/definition.ts";

/** 線の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGeometry = () => import("../../../../src/diagram/geometry.ts");

/** 点だけを変えた `flow` の線 */
function wire(id: string, points: Array<[number, number]>): MdmarkDiagramWire {
  return { id, from: "a", to: "b", line: "flow", points };
}

/** svg のパスの数字を全て取り出す */
function numbers(path: string): number[] {
  return (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

// 広い図は幅で収め、小さい図は 1 にする（正常系）
test("test_fit_scale", async () => {
  // 準備
  const { fitScale } = await loadGeometry();
  const box = { width: 600, height: 576 };
  // 実行
  const wide = fitScale({ width: 1100, height: 560 }, box);
  const small = fitScale({ width: 300, height: 200 }, box);
  // 検証
  expect(wide).toBeCloseTo(600 / 1100);
  expect(small).toBe(1);
});

// 横の線が縦の線を飛び越える（正常系）
test("test_jump_paths", async () => {
  // 準備
  const { jumpPaths } = await loadGeometry();
  const horizontal = wire("h", [
    [0, 50],
    [100, 50],
  ]);
  const vertical = wire("v", [
    [50, 0],
    [50, 100],
  ]);
  // 実行
  const paths = jumpPaths([horizontal, vertical]);
  // 検証
  const horizontalPath = paths.get("h") ?? "";
  const verticalPath = paths.get("v") ?? "";
  expect(horizontalPath).toContain("A");
  expect(numbers(horizontalPath)).toEqual(expect.arrayContaining([44, 56]));
  expect(verticalPath).not.toContain("A");
});

// 同じ向きで重なる線を 4px ずらす（正常系）
test("test_jump_paths_when_overlap", async () => {
  // 準備
  const { jumpPaths } = await loadGeometry();
  const first = wire("a", [
    [0, 50],
    [100, 50],
  ]);
  const second = wire("b", [
    [20, 50],
    [80, 50],
  ]);
  // 実行
  const paths = jumpPaths([first, second]);
  // 検証
  const firstNumbers = numbers(paths.get("a") ?? "");
  const secondNumbers = numbers(paths.get("b") ?? "");
  expect(firstNumbers).toContain(50);
  expect(secondNumbers).not.toContain(50);
  expect(secondNumbers.some((n) => Math.abs(n - 50) === 4)).toBe(true);
});

// 最大を含むきりのよい刻みにする（正常系）
test("test_nice_ticks", async () => {
  // 準備
  const { niceTicks } = await loadGeometry();
  // 実行
  const ticks = niceTicks([124, 86, 57, 12, 38, 41, 63, 95]);
  // 検証
  expect(ticks).toEqual({ min: 0, max: 150, step: 50 });
});

// 1 未満の値も切れる（正常系）
test("test_nice_ticks_when_small", async () => {
  // 準備
  const { niceTicks } = await loadGeometry();
  // 実行
  const ticks = niceTicks([0.12, 0.47]);
  // 検証
  expect(ticks.min).toBeCloseTo(0);
  expect(ticks.max).toBeCloseTo(0.5);
  expect(ticks.step).toBeCloseTo(0.1);
});

// 全て同じ値でも幅を持たせる（正常系）
test("test_nice_ticks_when_flat", async () => {
  // 準備
  const { niceTicks } = await loadGeometry();
  // 実行
  const ticks = niceTicks([0, 0]);
  // 検証
  expect(ticks.max).toBeGreaterThan(ticks.min);
  expect(ticks.step).toBeGreaterThan(0);
});
