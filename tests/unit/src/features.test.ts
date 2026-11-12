import { expect, test } from "vitest";

/** 機能のオン・オフの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFeatures = () => import("../../../src/features.ts");

// マーカーが無ければ設定のまま（正常系）
test("test_resolve_features", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({ defaults: { print: true }, marks: [] });
  // 検証
  expect(features).toEqual({ print: true });
});

// `false` でオフにする（正常系）
test("test_resolve_features_when_disabled", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({
    defaults: { print: true },
    marks: [{ print: false }],
  });
  // 検証
  expect(features).toEqual({ print: false });
});

// `true` でオンにし、知らない名前を無視する（正常系）
test("test_resolve_features_when_enabled", async () => {
  // 準備
  const { resolveFeatures } = await loadFeatures();
  // 実行
  const features = resolveFeatures({
    defaults: { print: false },
    marks: [{ print: true, unknown: true }],
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
    marks: [{ print: false }, { print: true }],
  });
  // 検証
  expect(features).toEqual({ print: true });
});
