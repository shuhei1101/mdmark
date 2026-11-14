import { afterEach, expect, test, vi } from "vitest";
import type { PartStates } from "../../../../src/interact/part-states.ts";
import { createRoot, removeRoots } from "../../helpers/dom.ts";

/** コードの行の畳みの操作を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadCodeFolds = (): Promise<
  typeof import("../../../../src/interact/code-folds.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/interact/code-folds.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

/** 3 階層の入れ子のキーを持つ yaml のコードブロック */
const NESTED_YAML = [
  "```yaml",
  "a:",
  "  b:",
  "    c: 1",
  "  d: 2",
  "e: 3",
  "```",
  "",
].join("\n");

/** 2 行目と 6 行目を `fold=` で畳んだ 8 行のコードブロック */
const FOLDED_YAML = [
  '<!-- code: {"fold": [2, 6]} -->',
  "",
  "```yaml",
  "a:",
  "  b:",
  "    c: 1",
  "  d: 2",
  "e:",
  "  f:",
  "    g: 3",
  "  h: 4",
  "```",
  "",
].join("\n");

/** 描いたコードブロックの行の要素を、上から返却する */
function codeLines(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(".mdmark-code-line")];
}

/** 行の開閉のボタンを返却する（無ければ例外） */
function foldToggle(line: HTMLElement | undefined): HTMLButtonElement {
  const button = line?.querySelector<HTMLButtonElement>(
    "button.mdmark-code-fold",
  );
  if (!button) {
    throw new Error("開閉のボタンが無い");
  }
  return button;
}

/** 行のうち `hidden` を持つ行の番号（1 から）を返却する */
function hiddenLineNumbers(lines: HTMLElement[]): number[] {
  return lines.flatMap((line, index) => (line.hidden ? [index + 1] : []));
}

/** Shift を押しながら要素を押す */
function shiftClick(element: HTMLElement): void {
  element.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    }),
  );
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

// 畳む・⋯ で開く・入れ子の状態を残す（正常系）
test("test_attach_code_folds", async () => {
  // 準備
  const { attachCodeFolds } = await loadCodeFolds();
  const { root } = createRoot(NESTED_YAML);
  detachers.push(attachCodeFolds(root));
  const lines = codeLines(root);
  // 検証: 1・2 行目にだけ開いた状態のボタンを配置する
  expect(foldToggle(lines[0]).getAttribute("aria-expanded")).toBe("true");
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("true");
  for (const line of lines.slice(2)) {
    expect(line.querySelector("button.mdmark-code-fold")).toBeNull();
  }
  // 実行・検証: 1 行目を畳むと 2〜4 行目を隠し、末尾に ⋯ を出す
  foldToggle(lines[0]).click();
  expect(hiddenLineNumbers(lines)).toEqual([2, 3, 4]);
  const more = lines[0]?.querySelector<HTMLButtonElement>(
    "button.mdmark-code-fold-more",
  );
  expect(more).toBeTruthy();
  // 実行・検証: ⋯ を押すと戻る
  more?.click();
  expect(hiddenLineNumbers(lines)).toEqual([]);
  expect(lines[0]?.querySelector("button.mdmark-code-fold-more")).toBeNull();
  expect(foldToggle(lines[0]).getAttribute("aria-expanded")).toBe("true");
  // 実行・検証: 2 行目を畳んでから 1 行目を畳んで開くと、3 行目は隠れたまま
  foldToggle(lines[1]).click();
  foldToggle(lines[0]).click();
  foldToggle(lines[0]).click();
  expect(hiddenLineNumbers(lines)).toEqual([3]);
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("false");
});

// Shift を押しながらで入れ子もまとめて開閉する（正常系）
test("test_attach_code_folds_when_shift", async () => {
  // 準備
  const { attachCodeFolds } = await loadCodeFolds();
  const { root } = createRoot(NESTED_YAML);
  detachers.push(attachCodeFolds(root));
  const lines = codeLines(root);
  // 実行・検証: 1 回目で 1・2 行目をまとめて畳む
  shiftClick(foldToggle(lines[0]));
  expect(foldToggle(lines[0]).getAttribute("aria-expanded")).toBe("false");
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("false");
  // 実行・検証: 2 回目で両方を開く
  shiftClick(foldToggle(lines[0]));
  expect(foldToggle(lines[0]).getAttribute("aria-expanded")).toBe("true");
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("true");
  expect(hiddenLineNumbers(lines)).toEqual([]);
});

// fold= の行を畳んだ状態にし、削除すると戻す（正常系）
test("test_attach_code_folds_when_initial", async () => {
  // 準備
  const { attachCodeFolds } = await loadCodeFolds();
  const { root } = createRoot(FOLDED_YAML);
  const lines = codeLines(root);
  // 実行
  const detach = attachCodeFolds(root);
  // 検証: 2・6 行目を畳み、後ろの行を隠す
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("false");
  expect(foldToggle(lines[5]).getAttribute("aria-expanded")).toBe("false");
  expect(hiddenLineNumbers(lines)).toEqual([3, 7]);
  // 実行・検証: 削除するとボタン・⋯・hidden が無い
  detach();
  expect(root.querySelector("button.mdmark-code-fold")).toBeNull();
  expect(root.querySelector("button.mdmark-code-fold-more")).toBeNull();
  expect(hiddenLineNumbers(lines)).toEqual([]);
});

// ポインターを乗せた行の範囲の縦線を濃くする（正常系）
test("test_attach_code_folds_when_hovered", async () => {
  // 準備
  const { attachCodeFolds } = await loadCodeFolds();
  const { root } = createRoot(NESTED_YAML);
  detachers.push(attachCodeFolds(root));
  const lines = codeLines(root);
  const activeLines = (): number[] =>
    lines.flatMap((line, index) =>
      line.hasAttribute("data-guide-active") ? [index + 1] : [],
    );
  // 実行・検証: 3 行目に乗せると 3 行目だけが範囲になる
  lines[2]?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  expect(activeLines()).toEqual([3]);
  // 実行・検証: 離すと範囲が無くなる
  lines[2]?.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  expect(activeLines()).toEqual([]);
});

/** 要素の上の指定した位置へ `pointermove` を送る */
const movePointer = (
  target: Element,
  clientX: number,
  clientY: number,
): void => {
  target.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, clientX, clientY }),
  );
};

// 開閉のボタンの列にポインターが乗っている間だけ、pre に data-fold-hover を付ける（正常系）
test("test_attach_code_folds_when_fold_column_hovered", async () => {
  // 準備
  const { attachCodeFolds } = await loadCodeFolds();
  const { root } = createRoot(NESTED_YAML);
  const detach = attachCodeFolds(root);
  const lines = codeLines(root);
  const pre = root.querySelector("pre");
  const firstToggle = foldToggle(lines[0]);
  const fourth = lines[3];
  if (!pre || !fourth) {
    throw new Error("コードブロックか 4 行目が無い");
  }
  const toggleBox = firstToggle.getBoundingClientRect();
  const lineBox = fourth.getBoundingClientRect();
  const columnX = toggleBox.left + toggleBox.width / 2;
  const lineY = lineBox.top + lineBox.height / 2;
  const textX = lineBox.right - 4;
  // 実行・検証: 4 行目の高さでボタンの列に乗せると付く
  movePointer(fourth, columnX, lineY);
  expect(pre.hasAttribute("data-fold-hover")).toBe(true);
  // 実行・検証: 4 行目の文字の上へ動かすと外れる
  movePointer(fourth, textX, lineY);
  expect(pre.hasAttribute("data-fold-hover")).toBe(false);
  // 実行・検証: もう一度列に乗せて付けた後、pointerleave で外れる
  movePointer(fourth, columnX, lineY);
  expect(pre.hasAttribute("data-fold-hover")).toBe(true);
  pre.dispatchEvent(new PointerEvent("pointerleave"));
  expect(pre.hasAttribute("data-fold-hover")).toBe(false);
  // 実行・検証: 削除した後は列に乗せても付かない
  detach();
  movePointer(fourth, columnX, lineY);
  expect(pre.hasAttribute("data-fold-hover")).toBe(false);
});

// 畳んだ行を開き、もう一度畳む（正常系）
test("test_set_code_fold_open", async () => {
  // 準備
  const { attachCodeFolds, setCodeFoldOpen } = await loadCodeFolds();
  const { root } = createRoot(
    ['<!-- code: {"fold": [2]} -->', "", NESTED_YAML].join("\n"),
  );
  detachers.push(attachCodeFolds(root));
  const lines = codeLines(root);
  const toggle = foldToggle(lines[1]);
  // 実行・検証: 開くと後ろの行を出し ⋯ を削除する
  setCodeFoldOpen(toggle, true);
  expect(lines[2]?.hidden).toBe(false);
  expect(lines[1]?.querySelector("button.mdmark-code-fold-more")).toBeNull();
  // 実行・検証: 畳むと hidden と ⋯ が戻る
  setCodeFoldOpen(toggle, false);
  expect(lines[2]?.hidden).toBe(true);
  expect(
    lines[1]?.querySelector("button.mdmark-code-fold-more"),
  ).not.toBeNull();
});

// 記録した開閉で始め、押した開閉を記録する（正常系）
test("test_attach_code_folds_when_states", async () => {
  // 準備
  const { attachCodeFolds, setCodeFoldOpen } = await loadCodeFolds();
  const states: PartStates = new Map();
  const first = createRoot(FOLDED_YAML).root;
  const detachFirst = attachCodeFolds(first, states);
  foldToggle(codeLines(first)[1]).click();
  detachFirst();
  first.remove();
  const { root } = createRoot(FOLDED_YAML);
  const lines = codeLines(root);
  // 実行
  detachers.push(attachCodeFolds(root, states));
  // 検証: 2 行目は開いたまま、6 行目はマーカーのとおり畳んだまま
  expect(foldToggle(lines[1]).getAttribute("aria-expanded")).toBe("true");
  expect(foldToggle(lines[5]).getAttribute("aria-expanded")).toBe("false");
  expect(hiddenLineNumbers(lines)).toEqual([7]);
  // 実行・検証: setCodeFoldOpen で開閉した行は記録しない
  const recorded = new Map(states);
  setCodeFoldOpen(foldToggle(lines[5]), true);
  expect(states).toEqual(recorded);
});
