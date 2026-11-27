import { afterEach, expect, test, vi } from "vitest";
import type { PartStates } from "../../../../src/shared/part-states.interact.ts";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** コードブロックの操作を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadCodeBlocks = (): Promise<
  typeof import("../../../../src/code-block/code-block.interact.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/code-block/code-block.interact.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

/** 言語 `ts` のコードブロック 1 つの文書 */
function tsBlock(lines: string[]): string {
  return ["```ts", ...lines, "```", ""].join("\n");
}

/** コードブロックのコピーのボタンを返却する（無ければ例外） */
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

// 押すとコードをコピーして 2 秒でボタンを戻す（正常系）
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
  // 検証: 末尾の改行を除いたコードを 1 回写し、コピーしたことを通知する
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

// 削除した行を除いて写す（正常系）
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
    // 実行・検証: もう一度押して記載できるとコピーしたことを通知する
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(button.dataset.state).toBe("copied");
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// 削除するとボタンを取り除く（正常系）
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

/** コードの行の畳みの操作を読み込む（ファイルが無い間は URL を組んで読み込む） */
const loadCodeFolds = (): Promise<
  typeof import("../../../../src/code-block/code-fold.interact.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/code-block/code-fold.interact.ts",
      import.meta.url,
    ).href
  );

// 畳んだ行もコピーに含める（正常系）
test("test_attach_code_copy_when_folded", async () => {
  // 準備
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachCodeCopy } = await loadCodeBlocks();
  const { attachCodeFolds } = await loadCodeFolds();
  const lines = [
    "a:",
    "  b:",
    "    c: 1",
    "  d: 2",
    "e:",
    "  f:",
    "    g: 3",
    "  h: 4",
  ];
  const { root } = createRoot(
    [
      '<!-- code: {"fold": [2, 6]} -->',
      "",
      "```yaml",
      ...lines,
      "```",
      "",
    ].join("\n"),
  );
  detachers.push(attachCodeFolds(root));
  detachers.push(attachCodeCopy(root));
  // 実行
  copyButton(root).click();
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledTimes(1);
  });
  // 検証: 8 行全てを持ち、⋯ を含まない
  expect(writeText).toHaveBeenCalledWith(lines.join("\n"));
  expect(writeText.mock.calls[0]?.[0]).not.toContain("⋯");
});

// ファイルツリーの帯にはコピーのボタンを重ねない（正常系）
test("test_attach_code_copy_when_file_tree", async () => {
  // 準備
  const { attachCodeCopy } = await loadCodeBlocks();
  const treeBlock = [
    "```text",
    "src/",
    "├── index.ts",
    "└── parts/",
    "```",
    "",
  ].join("\n");
  const { root } = createRoot(`${treeBlock}\n${tsBlock(["const a = 1;"])}`);
  const { attachFileTrees } = await import(
    /* @vite-ignore */ new URL(
      "../../../../src/tree/tree.interact.ts",
      import.meta.url,
    ).href
  );
  detachers.push(attachFileTrees(root));
  // 実行
  detachers.push(attachCodeCopy(root));
  // 検証
  expect(
    root.querySelectorAll(".mdmark-tree > .mdmark-code-bar .mdmark-code-copy"),
  ).toHaveLength(1);
  expect(
    root.querySelectorAll(".mdmark-code > .mdmark-code-bar .mdmark-code-copy"),
  ).toHaveLength(1);
});

/** 折り返しのマーカーを持つコードブロック・マーカーの無いコードブロック・ファイルツリーの文書 */
const WRAP_DOC = [
  '<!-- code: {"wrap": true} -->',
  "",
  "```ts",
  "const wrapped = 1;",
  "```",
  "",
  "```ts",
  "const plain = 2;",
  "```",
  "",
  "```tree",
  "app/",
  "└── src/",
  "```",
  "",
].join("\n");

/** 帯の折り返しのボタンを文書の順に返却する */
function wrapToggles(root: HTMLElement): HTMLButtonElement[] {
  return [
    ...root.querySelectorAll<HTMLButtonElement>(
      ".mdmark-code-bar button.mdmark-code-wrap-toggle",
    ),
  ];
}

/** コードブロックの pre とファイルツリーが折り返しているかを文書の順に返却する */
function wrapStates(root: HTMLElement): boolean[] {
  return [
    ...root.querySelectorAll<HTMLElement>(".mdmark-code pre, div.mdmark-tree"),
  ].map((element) =>
    element.classList.contains(
      element.matches("pre") ? "mdmark-code-wrap" : "mdmark-tree-wrap",
    ),
  );
}

/** ファイルツリーに帯と操作を付ける（折り返しのボタンを配置する帯は attachFileTrees が付ける） */
async function attachTrees(root: HTMLElement): Promise<void> {
  const { attachFileTrees } = await import(
    /* @vite-ignore */ new URL(
      "../../../../src/tree/tree.interact.ts",
      import.meta.url,
    ).href
  );
  detachers.push(attachFileTrees(root));
}

// 押したブロックだけを切り替える（正常系）
test("test_attach_code_wraps", async () => {
  // 準備
  const { attachCodeWraps } = await loadCodeBlocks();
  const { root } = createRoot(WRAP_DOC);
  await attachTrees(root);
  detachers.push(attachCodeWraps(root, { defaultWrap: false }));
  const toggles = wrapToggles(root);
  const before = toggles.map((toggle) => toggle.getAttribute("aria-pressed"));
  // 実行
  toggles[1]?.click();
  // 検証
  expect(before).toEqual(["true", "false", "false"]);
  expect(toggles.map((toggle) => toggle.getAttribute("aria-pressed"))).toEqual([
    "true",
    "true",
    "false",
  ]);
  expect(wrapStates(root)).toEqual([true, true, false]);
});

// 既定を折り返すにしたときはマーカーの無いブロックも折り返す（正常系）
test("test_attach_code_wraps_when_default_wrap", async () => {
  // 準備
  const { attachCodeWraps } = await loadCodeBlocks();
  const { root } = createRoot(
    [
      "```ts",
      "const plain = 2;",
      "```",
      "",
      "```tree",
      "app/",
      "└── src/",
      "```",
      "",
    ].join("\n"),
  );
  await attachTrees(root);
  // 実行
  detachers.push(attachCodeWraps(root, { defaultWrap: true }));
  // 検証
  expect(wrapStates(root)).toEqual([true, true]);
  expect(
    wrapToggles(root).map((toggle) => toggle.getAttribute("aria-pressed")),
  ).toEqual(["true", "true"]);
});

// 再描画しても切り替えた状態を保つ（正常系）
test("test_attach_code_wraps_when_updated", async () => {
  // 準備
  const { attachCodeWraps } = await loadCodeBlocks();
  const partStates: PartStates = new Map();
  const first = createRoot(WRAP_DOC);
  await attachTrees(first.root);
  const detach = attachCodeWraps(first.root, {
    defaultWrap: false,
    partStates,
  });
  wrapToggles(first.root)[0]?.click();
  detach();
  first.root.remove();
  // 実行
  const second = createRoot(WRAP_DOC);
  await attachTrees(second.root);
  detachers.push(
    attachCodeWraps(second.root, { defaultWrap: false, partStates }),
  );
  // 検証: 1 つ目は押した後の状態、ほかは描いた直後の状態
  expect(wrapStates(second.root)).toEqual([false, false, false]);
  expect(
    wrapToggles(second.root).map((toggle) =>
      toggle.getAttribute("aria-pressed"),
    ),
  ).toEqual(["false", "false", "false"]);
});

// コピーのボタンの前に配置する（正常系）
test("test_attach_code_wraps_when_order", async () => {
  // 準備
  const { attachCodeCopy, attachCodeWraps } = await loadCodeBlocks();
  const { root } = createRoot(tsBlock(["const a = 1;"]));
  detachers.push(attachCodeCopy(root));
  // 実行
  detachers.push(attachCodeWraps(root, { defaultWrap: false }));
  // 検証
  const meta = root.querySelector(".mdmark-code-bar .mdmark-code-meta");
  const buttons = [...(meta?.querySelectorAll("button") ?? [])].map(
    (button) => button.className,
  );
  expect(buttons).toEqual(["mdmark-code-wrap-toggle", "mdmark-code-copy"]);
});
