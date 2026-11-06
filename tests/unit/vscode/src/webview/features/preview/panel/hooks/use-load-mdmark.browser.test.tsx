import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";
import { handlers } from "../../../../../../../../../vscode/src/webview/testing/msw/handlers.ts";
import { test } from "../../../../msw-test.ts";

/** 配布物を読む hook を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHook = () =>
  import(
    "../../../../../../../../../vscode/src/webview/features/preview/panel/hooks/use-load-mdmark.ts"
  );

/** 配布物の URL（MSW の HEAD のハンドラが当たる） */
const DIST_JS =
  "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v9.9.9/dist/index.js";
/** 読み込み中を出すまでの待ち（設計書の `LOADING_DELAY_MS`） */
const LOADING_DELAY_MS = 1000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** 結果の処理を記録する代役 */
const callbacks = () => ({
  onLoaded: vi.fn(),
  onFailed: vi.fn(),
  onSlow: vi.fn(),
});

// 読めたら onLoaded を呼ぶ（正常系）
test("test_use_load_mdmark_when_loaded", async () => {
  // 準備
  const { useLoadMdmark } = await loadHook();
  const mdmark = { mount: vi.fn() };
  const handlersOf = callbacks();
  // 実行
  renderHook(() =>
    useLoadMdmark({ distJs: DIST_JS, load: async () => mdmark, ...handlersOf }),
  );
  // 検証
  await vi.waitFor(() => {
    expect(handlersOf.onLoaded).toHaveBeenCalledWith(mdmark);
  });
  expect(handlersOf.onLoaded).toHaveBeenCalledTimes(1);
  expect(handlersOf.onFailed).not.toHaveBeenCalled();
});

// 読めなければ理由を見分けて onFailed を呼ぶ（異常系）
test("test_use_load_mdmark_when_failed", async ({ worker }) => {
  // 準備
  worker.use(...handlers("versionMissing"));
  const { useLoadMdmark } = await loadHook();
  const handlersOf = callbacks();
  // 実行
  renderHook(() =>
    useLoadMdmark({
      distJs: DIST_JS,
      load: () => Promise.reject(new TypeError("Failed to fetch")),
      ...handlersOf,
    }),
  );
  // 検証
  await vi.waitFor(() => {
    expect(handlersOf.onFailed).toHaveBeenCalledWith("versionMissing");
  });
  expect(handlersOf.onFailed).toHaveBeenCalledTimes(1);
});

// 外した後の結果とタイマーを捨てる（正常系）
test("test_use_load_mdmark_when_unmounted", async () => {
  // 準備
  const { useLoadMdmark } = await loadHook();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const handlersOf = callbacks();
  let resolveLoad: (value: { mount: () => void }) => void = () => undefined;
  const load = () =>
    new Promise<{ mount: () => void }>((resolve) => {
      resolveLoad = resolve;
    });
  const { unmount } = renderHook(() =>
    useLoadMdmark({ distJs: DIST_JS, load: load as never, ...handlersOf }),
  );
  // 実行
  unmount();
  await act(async () => {
    resolveLoad({ mount: () => undefined });
    vi.advanceTimersByTime(LOADING_DELAY_MS);
  });
  // 検証
  expect(handlersOf.onLoaded).not.toHaveBeenCalled();
  expect(handlersOf.onSlow).not.toHaveBeenCalled();
});
