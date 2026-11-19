import { expect, test, vi } from "vitest";
import { createFakeEngine } from "./fake-engine.ts";

/** マーカーの記載方法を注入するモジュール（実装が無い間は各テストが個別に失敗する） */
const loadGuide = () => import("../../../../src/mdmark-style/marker-guide.ts");

/** 設定ファイルの既定のパス */
const CONFIG = "/home/u/.config/mdmark-style/settings.yaml";

/** `next` の代わり。指定した `additionalContext` を返却する */
const nextWith = (additionalContext: string[]) =>
  vi.fn(async () => ({ additionalContext }));

// 説明の文を追加する（正常系）
test("test_inject_marker_guide", async () => {
  // 準備
  const { MARKER_GUIDE, injectMarkerGuide } = await loadGuide();
  const $ = createFakeEngine();
  const next = nextWith(["a"]);
  // 実行
  const result = await injectMarkerGuide($, { source: "clear" }, next);
  // 検証
  expect(result.additionalContext).toEqual(["a", MARKER_GUIDE]);
});

// 注入をオフにした（正常系）
test("test_inject_marker_guide_when_disabled", async () => {
  // 準備
  const { injectMarkerGuide } = await loadGuide();
  const $ = createFakeEngine({
    files: { [CONFIG]: "global:\n  inject_marker_guide: false\n" },
  });
  const next = nextWith(["a"]);
  // 実行
  const result = await injectMarkerGuide($, { source: "startup" }, next);
  // 検証
  expect(result).toEqual({ additionalContext: ["a"] });
});

// 設定ファイルを読めない（異常系）
test("test_inject_marker_guide_when_settings_broken", async () => {
  // 準備
  const { injectMarkerGuide } = await loadGuide();
  const $ = createFakeEngine({ files: { [CONFIG]: "global: [" } });
  const next = nextWith(["a"]);
  // 実行
  const result = await injectMarkerGuide($, { source: "startup" }, next);
  // 検証
  expect(result).toEqual({ additionalContext: ["a"] });
  expect($.ui.log).toHaveBeenCalledTimes(1);
  expect($.ui.log).toHaveBeenCalledWith(expect.any(String), { to: "debug" });
});

// 説明の文の長さと書き出し（正常系）
test("test_marker_guide_length", async () => {
  // 準備
  const { MARKER_GUIDE } = await loadGuide();
  // 検証
  expect(MARKER_GUIDE.startsWith("mdmark-style:")).toBe(true);
  expect(MARKER_GUIDE.length).toBeLessThanOrEqual(600);
});
