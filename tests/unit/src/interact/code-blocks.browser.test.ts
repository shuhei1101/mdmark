import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** コードブロックの操作を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む） */
const loadCodeBlocks = (): Promise<
  typeof import("../../../../src/interact/code-blocks.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/code-blocks.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

/** 言語 `ts` のコードブロック 1 つの文書 */
function tsBlock(lines: string[]): string {
  return ["```ts", ...lines, "```", ""].join("\n");
}

/** コードブロックのコピーのボタンを返す（無ければ例外） */
function copyButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(
    ".mdmark-code-bar button.mdmark-code-copy",
  );
  if (!button) {
    throw new Error("コピーのボタンが無い");
  }
  return button;
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  restoreClipboard();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// 押すとコードを写して 2 秒でボタンを戻す（正常系）
test("test_attach_code_copy", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachCodeCopy } = await loadCodeBlocks();
  const { root } = createRoot(tsBlock(["const a = 1;", "const b = 2;"]));
  detachers.push(attachCodeCopy(root));
  const button = copyButton(root);
  // 実行
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 末尾の改行を除いたコードを 1 回写し、写したことを知らせる
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("const a = 1;\nconst b = 2;");
  expect(button.dataset.state).toBe("copied");
  expect(root.querySelector(".mdmark-code-status")?.textContent).toBe(
    "コードをコピーしました",
  );
  // 実行・検証: 2 秒たつとボタンが戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
});

// 消した行を除いて写す（正常系）
test("test_attach_code_copy_when_line_marks", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachCodeCopy } = await loadCodeBlocks();
  const { root } = createRoot(
    tsBlock(["old() // [!code --]", "next() // [!code ++]", "keep()"]),
  );
  detachers.push(attachCodeCopy(root));
  // 実行
  copyButton(root).click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証
  expect(writeText).toHaveBeenCalledWith("next()\nkeep()");
});

// 拒まれたら失敗の表示を残す（正常系）
test("test_attach_code_copy_when_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi
    .fn<(text: string) => Promise<void>>()
    .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
    .mockResolvedValueOnce(undefined);
  stubClipboard(writeText);
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const { attachCodeCopy } = await loadCodeBlocks();
  const { root } = createRoot(tsBlock(["const a = 1;"]));
  detachers.push(attachCodeCopy(root));
  const button = copyButton(root);
  try {
    // 実行・検証: 1 回目は失敗が残り、2 秒たっても戻らない
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.dataset.state).toBe("failed");
    expect(root.querySelector(".mdmark-code-status")?.textContent).toBe(
      "コードをコピーできませんでした",
    );
    await vi.advanceTimersByTimeAsync(2000);
    expect(button.dataset.state).toBe("failed");
    // 実行・検証: もう一度押して書けると写したことを知らせる
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.dataset.state).toBe("copied");
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// 外すとボタンを取り除く（正常系）
test("test_attach_code_copy_when_detached", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() => Promise.resolve());
  const { attachCodeCopy } = await loadCodeBlocks();
  const { root } = createRoot(tsBlock(["const a = 1;"]));
  const detach = attachCodeCopy(root);
  copyButton(root).click();
  // 実行
  detach();
  // 検証: 帯にボタンが残らず、タイマーが走っても例外が出ない
  expect(root.querySelector(".mdmark-code-meta")).toBeNull();
  await vi.advanceTimersByTimeAsync(2000);
});
