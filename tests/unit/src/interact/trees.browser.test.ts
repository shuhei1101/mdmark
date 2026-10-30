import { afterEach, expect, test, vi } from "vitest";
import { restoreClipboard, stubClipboard } from "../../helpers/clipboard.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** ファイルツリーの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTrees = () => import("../../../../src/interact/trees.ts");

const detachers: Array<() => void> = [];

/** `app/` の下に `src/`、その下に `parts/`、その下に `tree.ts` を持つツリーのコードブロック */
const NESTED_TREE = [
  "```tree",
  "app/",
  "└── src/",
  "    └── parts/",
  "        └── tree.ts",
  "```",
];

/** `src/` の下に `index.ts` を持つツリーの罫線のテキスト */
const COPY_SOURCE = "src/\n└── index.ts";

/** ツリーを書いた Markdown を作る（行を改行でつなぐ） */
function markdownOf(...lines: string[]): string {
  return [...lines, ""].join("\n");
}

/** 描いた要素の中の `index` 番目のファイルツリーを返す */
function treeOf(root: HTMLElement, index = 0): HTMLElement {
  const tree = root.querySelectorAll<HTMLElement>("div.mdmark-tree")[index];
  if (!tree) {
    throw new Error(`ファイルツリーが無い: ${index}`);
  }
  return tree;
}

/** ツリーの中で、名前のフォルダの開閉のボタンを返す */
function toggleOf(tree: HTMLElement, name: string): HTMLButtonElement {
  const button = [
    ...tree.querySelectorAll<HTMLButtonElement>("button.mdmark-tree-toggle"),
  ].find((candidate) => candidate.textContent?.trim().startsWith(name));
  if (!button) {
    throw new Error(`開閉のボタンが無い: ${name}`);
  }
  return button;
}

/** ツリーの中の、開閉のボタンの `aria-expanded` を名前の順に返す */
function expandedOf(tree: HTMLElement, names: string[]): Array<string | null> {
  return names.map((name) =>
    toggleOf(tree, name).getAttribute("aria-expanded"),
  );
}

/** 開閉のボタンが開閉する入れ子の `ul` を返す */
function nestedListOf(button: HTMLButtonElement): HTMLElement {
  const list = button.closest("li")?.querySelector<HTMLElement>(":scope > ul");
  if (!list) {
    throw new Error("入れ子の ul が無い");
  }
  return list;
}

/** Shift を押しながらボタンを押す */
function shiftClick(button: HTMLElement): void {
  button.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    }),
  );
}

/** ツリーのコピーのボタンを返す */
function copyButtonOf(tree: HTMLElement): HTMLButtonElement {
  const button = tree.querySelector<HTMLButtonElement>(
    "button.mdmark-tree-copy",
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// 帯と開閉のボタンを置き、指定が無ければルートだけを開く（正常系）
test("test_attach_file_trees", async () => {
  // 準備
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(
    markdownOf(
      "```tree",
      "mdmark/",
      "├── src/ # ソース",
      "│   └── index.ts",
      "└── package.json",
      "```",
    ),
  );
  // 実行
  detachers.push(attachFileTrees(root));
  // 検証
  const tree = treeOf(root);
  expect(tree.querySelector(".mdmark-tree-bar")).not.toBeNull();
  expect(expandedOf(tree, ["mdmark/", "src/"])).toEqual(["true", "false"]);
  expect(nestedListOf(toggleOf(tree, "src/")).getAttribute("hidden")).toBe(
    "until-found",
  );
  const file = [...tree.querySelectorAll("li.mdmark-tree-file")].find(
    (candidate) => candidate.textContent?.includes("package.json"),
  );
  expect(file?.querySelector("button")).toBeNull();
  expect(tree.style.getPropertyValue("--mdmark-tree-note-start")).not.toBe("");
});

// data-open の階層まで開く（正常系）
test("test_attach_file_trees_when_open", async () => {
  // 準備
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(
    markdownOf(
      "<!-- tree: open=2 -->",
      "",
      ...NESTED_TREE,
      "",
      "<!-- tree: open=all -->",
      "",
      ...NESTED_TREE,
    ),
  );
  // 実行
  detachers.push(attachFileTrees(root));
  // 検証
  const names = ["app/", "src/", "parts/"];
  expect(expandedOf(treeOf(root, 0), names)).toEqual(["true", "true", "false"]);
  expect(expandedOf(treeOf(root, 1), names)).toEqual(["true", "true", "true"]);
  expect(treeOf(root, 1).querySelector("ul[hidden]")).toBeNull();
});

// 押すとそのフォルダだけを、Shift を押しながらなら入れ子も開閉する（正常系）
test("test_attach_file_trees_when_toggled", async () => {
  // 準備
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(
    markdownOf("<!-- tree: open=all -->", "", ...NESTED_TREE),
  );
  detachers.push(attachFileTrees(root));
  const tree = treeOf(root);
  const names = ["app/", "src/", "parts/"];
  // 実行
  toggleOf(tree, "src/").click();
  // 検証: src/ だけが閉じ、入れ子の parts/ は開いたまま
  expect(expandedOf(tree, names)).toEqual(["true", "false", "true"]);
  // 実行
  shiftClick(toggleOf(tree, "app/"));
  // 検証: app/ と入れ子が全て閉じる
  expect(expandedOf(tree, names)).toEqual(["false", "false", "false"]);
  // 実行
  shiftClick(toggleOf(tree, "app/"));
  // 検証: app/ と入れ子が全て開き、閉じた入れ子の ul が無い
  expect(expandedOf(tree, names)).toEqual(["true", "true", "true"]);
  expect(tree.querySelector("ul[hidden]")).toBeNull();
});

// ページ内検索で開いたフォルダを開いた状態にする（正常系）
test("test_attach_file_trees_when_found", async () => {
  // 準備
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(markdownOf(...NESTED_TREE));
  detachers.push(attachFileTrees(root));
  const tree = treeOf(root);
  const button = toggleOf(tree, "src/");
  const list = nestedListOf(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");
  // 実行
  list.dispatchEvent(new Event("beforematch", { bubbles: true }));
  // 検証
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(list.hasAttribute("hidden")).toBe(false);
});

// 押すと元の罫線のテキストを写して 2 秒でボタンを戻す（正常系）
test("test_attach_file_trees_when_copied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(
    markdownOf("```tree", ...COPY_SOURCE.split("\n"), "```"),
  );
  detachers.push(attachFileTrees(root));
  const tree = treeOf(root);
  const button = copyButtonOf(tree);
  // 実行
  button.click();
  await vi.advanceTimersByTimeAsync(0);
  // 検証: 元のテキストを写し、ボタンと読み上げで知らせる
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith(COPY_SOURCE);
  expect(button.dataset.state).toBe("copied");
  expect(button.textContent).toContain("コピーしました");
  expect(tree.querySelector(".mdmark-tree-status")?.textContent).toContain(
    "コピーしました",
  );
  // 実行・検証: 2 秒たつとボタンが戻る
  await vi.advanceTimersByTimeAsync(2000);
  expect(button.dataset.state).toBe("idle");
});

// 書けなければツリーの下にパネルを出し、閉じると取り除く（正常系）
test("test_attach_file_trees_when_copy_denied", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  stubClipboard(() =>
    Promise.reject(new DOMException("denied", "NotAllowedError")),
  );
  const rejections: PromiseRejectionEvent[] = [];
  const onRejection = (event: PromiseRejectionEvent): void => {
    rejections.push(event);
  };
  window.addEventListener("unhandledrejection", onRejection);
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(
    markdownOf("```tree", ...COPY_SOURCE.split("\n"), "```"),
  );
  detachers.push(attachFileTrees(root));
  const tree = treeOf(root);
  const button = copyButtonOf(tree);
  try {
    // 実行
    button.click();
    await vi.advanceTimersByTimeAsync(0);
    // 検証: ツリーの下にパネルが出て、元のテキストが全て選ばれている
    const panel = tree.querySelector<HTMLElement>(".mdmark-copy-panel");
    expect(panel).not.toBeNull();
    expect(tree.querySelector(".mdmark-tree-list")?.nextElementSibling).toBe(
      panel,
    );
    const textarea = panel?.querySelector("textarea");
    expect(textarea?.value).toBe(tree.dataset.source);
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(textarea?.value.length);
    // 実行
    panel?.querySelector<HTMLElement>('button[aria-label="閉じる"]')?.click();
    // 検証: パネルを取り除き、コピーのボタンへフォーカスを戻す
    expect(tree.querySelector(".mdmark-copy-panel")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(rejections).toHaveLength(0);
  } finally {
    window.removeEventListener("unhandledrejection", onRejection);
  }
});

// 外すと render の出した状態に戻す（正常系）
test("test_attach_file_trees_when_detached", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  stubClipboard(writeText);
  const { attachFileTrees } = await loadTrees();
  const { root } = createRoot(markdownOf(...NESTED_TREE));
  const detach = attachFileTrees(root);
  const tree = treeOf(root);
  expect(tree.querySelector("ul[hidden]")).not.toBeNull();
  // 実行: コピーのボタンを押してすぐ外し、2 秒進める
  copyButtonOf(tree).click();
  detach();
  await vi.advanceTimersByTimeAsync(2000);
  // 検証
  expect(tree.querySelector(".mdmark-tree-bar")).toBeNull();
  expect(tree.querySelector(".mdmark-tree-toggle")).toBeNull();
  expect(tree.querySelector("ul[hidden]")).toBeNull();
});
