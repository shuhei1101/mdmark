import { expect, test } from "vitest";

/** 機能のオン・オフの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFeatures = () => import("../../../src/features.ts");

// 印が無ければ設定のままにする（正常系）
test("test_resolve_features", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({ defaults: { print: true }, args: [] });
  // 検証
  expect(features).toEqual({ print: true });
});

// -名前 でオフにする（正常系）
test("test_resolve_features_when_disabled", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({
    defaults: { print: true },
    args: ["-print"],
  });
  // 検証
  expect(features).toEqual({ print: false });
});

// +名前 でオンにし、知らない名前と符号の無い引数を無視する（正常系）
test("test_resolve_features_when_enabled", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({
    defaults: { print: false },
    args: ["+print", "+unknown", "print"],
  });
  // 検証
  expect(features).toEqual({ print: true });
});

// 同じ名前は後のものが勝つ（正常系）
test("test_resolve_features_when_repeated", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({
    defaults: { print: true },
    args: ["-print", "+print"],
  });
  // 検証
  expect(features).toEqual({ print: true });
});
