import { expect, test } from "vitest";

/** 探す場所の候補の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAssets = () => import("../../../../../vscode/src/preview/assets.ts");

// Markdown のフォルダ、次にアセットのルートを返す（正常系）
test("test_asset_candidates", async () => {
  // 準備
  const { assetCandidates } = await loadAssets();
  // 実行
  const candidates = assetCandidates("m/demo.mp4?v=1#t=3", {
    docDir: "/w/docs",
    assetsRoot: "/w/assets",
    workspaceDirs: ["/w"],
  });
  // 検証
  expect(candidates).toEqual({
    files: ["/w/docs/m/demo.mp4", "/w/assets/m/demo.mp4"],
    suffix: "?v=1#t=3",
  });
});

// ワークスペースの外へ出る候補を除く（正常系）
test("test_asset_candidates_when_outside", async () => {
  // 準備
  const { assetCandidates } = await loadAssets();
  // 実行
  const candidates = assetCandidates("../../etc/passwd", {
    docDir: "/w/docs",
    workspaceDirs: ["/w"],
  });
  // 検証
  expect(candidates.files).toEqual([]);
});
