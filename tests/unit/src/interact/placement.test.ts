import { expect, test } from "vitest";

/** ツールチップを置く側を決める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPlacement = () => import("../../../../src/interact/placement.ts");

/** 持ち主が画面の中ほどにあり、上にも下にも収まる位置 */
const BASE = {
  anchorTop: 300,
  anchorBottom: 320,
  height: 100,
  gap: 6,
  viewportHeight: 800,
} as const;

// 既定の top で上に収まれば上に置く（正常系）
test("test_choose_tip_side", async () => {
  // 準備
  const { chooseTipSide } = await loadPlacement();
  // 実行
  const side = chooseTipSide({ ...BASE, placement: "top" });
  // 検証
  expect(side).toBe("top");
});

// top で上に収まらなければ下に置く（正常系）
test("test_choose_tip_side_when_no_room_above", async () => {
  // 準備
  const { chooseTipSide } = await loadPlacement();
  // 実行
  const noRoom = chooseTipSide({ ...BASE, anchorTop: 50, placement: "top" });
  const boundary = chooseTipSide({ ...BASE, anchorTop: 106, placement: "top" });
  // 検証
  expect(noRoom).toBe("bottom");
  expect(boundary).toBe("top");
});

// bottom は下を先にし、下に収まらず上に収まれば上に置く（正常系）
test("test_choose_tip_side_when_bottom", async () => {
  // 準備
  const { chooseTipSide } = await loadPlacement();
  // 実行
  const fitsBelow = chooseTipSide({ ...BASE, placement: "bottom" });
  const onlyAbove = chooseTipSide({
    ...BASE,
    anchorTop: 740,
    anchorBottom: 760,
    placement: "bottom",
  });
  const fitsNowhere = chooseTipSide({
    ...BASE,
    anchorTop: 50,
    anchorBottom: 70,
    viewportHeight: 120,
    placement: "bottom",
  });
  // 検証
  expect([fitsBelow, onlyAbove, fitsNowhere]).toEqual([
    "bottom",
    "top",
    "bottom",
  ]);
});
