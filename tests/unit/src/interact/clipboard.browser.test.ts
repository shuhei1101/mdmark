import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";

/** クリップボードへ書く処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadClipboard = (): Promise<
  typeof import("../../../../src/interact/clipboard.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/clipboard.ts",
      import.meta.url,
    ).href
  );

afterEach(() => {
  restoreClipboard();
  vi.restoreAllMocks();
});

// 書けたら true を返す（正常系）
test("test_copy_text", async () => {
  // 準備
  const { copyText } = await loadClipboard();
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  // 実行
  const result = await copyText("a\tb");
  // 検証
  expect(result).toBe(true);
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("a\tb");
});

// 拒まれたら false を返し、例外を外へ出さない（正常系）
test("test_copy_text_when_denied", async () => {
  // 準備
  const { copyText } = await loadClipboard();
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  // 実行
  const result = await copyText("a");
  await new Promise((resolve) => setTimeout(resolve, 0));
  // 検証
  window.removeEventListener("unhandledrejection", onRejection);
  expect(result).toBe(false);
  expect(rejections).toHaveLength(0);
});

// クリップボードが無ければ false を返す（正常系）
test("test_copy_text_when_unavailable", async () => {
  // 準備
  const { copyText } = await loadClipboard();
  stubClipboard(undefined);
  // 実行
  const result = await copyText("a");
  // 検証
  expect(result).toBe(false);
});
