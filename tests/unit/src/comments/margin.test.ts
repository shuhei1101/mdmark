import { expect, test } from "vitest";

/** 余白のマーカーの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMargin = () => import("../../../../src/comments/margin.ts");

// 行の縦の中ほどを返す（正常系）
test("test_layout_markers", async () => {
  // 準備
  const { layoutMarkers } = await loadMargin();
  // 実行
  const layout = layoutMarkers({
    lines: [
      { top: 100, height: 20 },
      { top: 0, height: 20 },
    ],
    markerSize: 24,
  });
  // 検証
  expect(layout).toEqual([
    { center: 10, indexes: [1] },
    { center: 110, indexes: [0] },
  ]);
});

// 上端の差が 4 以下の行を 1 つにまとめる（正常系）
test("test_layout_markers_when_same_line", async () => {
  // 準備
  const { layoutMarkers } = await loadMargin();
  // 実行
  const layout = layoutMarkers({
    lines: [
      { top: 0, height: 20 },
      { top: 3, height: 20 },
    ],
    markerSize: 24,
  });
  // 検証
  expect(layout).toHaveLength(1);
  expect(layout[0]?.indexes).toEqual([0, 1]);
});

// 上のマーカーと重なると下げる（正常系）
test("test_layout_markers_when_overlapping", async () => {
  // 準備
  const { layoutMarkers } = await loadMargin();
  // 実行
  const layout = layoutMarkers({
    lines: [
      { top: 0, height: 20 },
      { top: 20, height: 20 },
    ],
    markerSize: 24,
  });
  // 検証
  expect(layout).toHaveLength(2);
  expect(layout[1]?.center).toBe(38);
});
