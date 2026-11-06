import { afterEach, expect, test, vi } from "vitest";

/** Webview の入口を読み込む（実装が無い間は各テストが個別に失敗する。読み込んだ時点で startPreview が走る） */
const loadMain = () => import("../../../../../vscode/src/webview/main.tsx");

afterEach(() => {
  vi.unstubAllGlobals();
});

// 描く先を包む要素が無いページでは描かない（正常系）
test("test_start_preview_when_no_root", async () => {
  // 準備
  const acquire = vi.fn(() => ({ postMessage: vi.fn() }));
  vi.stubGlobal("acquireVsCodeApi", acquire);
  // 実行
  const { startPreview } = await loadMain();
  startPreview();
  // 検証
  expect(document.getElementById("mdmark-preview")).toBeNull();
  expect(acquire).not.toHaveBeenCalled();
});
