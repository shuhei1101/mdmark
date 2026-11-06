import { afterEach, expect, test, vi } from "vitest";

/** VS Code の API のアダプターを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAdapter = () =>
  import(
    "../../../../../../../vscode/src/webview/shared/adapters/vscode-api.ts"
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// 2 回呼んでも acquireVsCodeApi は 1 回（正常系）
test("test_get_vs_code_api", async () => {
  // 準備
  const api = { postMessage: vi.fn() };
  const acquire = vi.fn(() => api);
  vi.stubGlobal("acquireVsCodeApi", acquire);
  const { getVsCodeApi } = await loadAdapter();
  // 実行
  const first = getVsCodeApi();
  const second = getVsCodeApi();
  // 検証
  expect(first).toBe(api);
  expect(second).toBe(api);
  expect(acquire).toHaveBeenCalledTimes(1);
});
