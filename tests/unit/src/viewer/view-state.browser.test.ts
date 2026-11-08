import { afterEach, expect, test, vi } from "vitest";
import { mount } from "../../../../src/mount.ts";

/** 表示の状態の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadViewState = () => import("../../../../src/viewer/view-state.ts");

// 閉じた表（details）・開いたセクション・group= の無いタブ群・group=os のタブ群を持つ文書（h1 もセクションの開閉を持つため置かない）
const MARKDOWN = [
  "<!-- table: data closed -->",
  "",
  "| 名前 | 値 |",
  "| --- | --- |",
  "| りんご | 10 |",
  "",
  "<!-- /table -->",
  "",
  "## 導入",
  "",
  "<!-- tabs -->",
  "",
  "### 一つ目",
  "",
  "一つ目の中身",
  "",
  "### 二つ目",
  "",
  "二つ目の中身",
  "",
  "<!-- /tabs -->",
  "",
  "<!-- tabs: group=os -->",
  "",
  "### Windows",
  "",
  "Windows の中身",
  "",
  "### macOS",
  "",
  "macOS の中身",
  "",
  "<!-- /tabs -->",
  "",
  ...Array.from({ length: 200 }, (_, index) => `段落 ${index + 1}\n`),
].join("\n");

// 畳める行を持つコードブロックだけの文書
const CODE_MARKDOWN = [
  "```yaml",
  "features:",
  "  table: true",
  "  tabs: true",
  "```",
  "",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  sessionStorage.clear();
  localStorage.clear();
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  window.scrollTo(0, 0);
});

/** 文書を新しい要素に描き、その要素を返す */
function drawDocument(markdown: string): HTMLElement {
  const view = document.createElement("main");
  document.body.append(view);
  mount(view, { markdown });
  return view;
}

/** group= の無いタブ群の 2 つ目のタブのボタンを返す */
function secondPlainTab(view: HTMLElement): HTMLButtonElement {
  const tab = view.querySelector<HTMLButtonElement>(
    ".mdmark-tabs:not([data-group]) .mdmark-tab:nth-of-type(2)",
  );
  if (tab === null) {
    throw new Error("group= の無いタブ群の 2 つ目のタブが無い");
  }
  return tab;
}

// ID が無ければ振り、2 回目は同じ ID を返す（正常系）
test("test_ensure_entry_id", async () => {
  // 準備
  const { ensureEntryId } = await loadViewState();
  history.replaceState({ other: 1 }, "");
  // 実行
  const first = ensureEntryId(window);
  const second = ensureEntryId(window);
  // 検証
  expect(first).not.toBe("");
  expect(second).toBe(first);
  expect(history.state).toEqual({ other: 1, mdmarkEntry: first });
});

// 開閉とタブの選択を出現順に取り出す（正常系）
test("test_capture_view_state", async () => {
  // 準備
  const { captureViewState } = await loadViewState();
  const view = drawDocument(MARKDOWN);
  secondPlainTab(view).click();
  // 実行
  const state = captureViewState({ view, path: "a.md" });
  // 検証
  expect(state.folds).toEqual([false, true]);
  expect(state.tabs).toEqual([1]);
  expect(state.path).toBe("a.md");
});

// 開閉とタブを戻してから位置へスクロールする（正常系）
test("test_apply_view_state", async () => {
  // 準備
  const { captureViewState, applyViewState } = await loadViewState();
  const before = drawDocument(MARKDOWN);
  secondPlainTab(before).click();
  const captured = captureViewState({ view: before, path: "a.md" });
  before.remove();
  const view = drawDocument(MARKDOWN);
  // 実行
  const stop = applyViewState({
    view,
    state: { ...captured, x: 0, y: 1200 },
    keepFocus: false,
  });
  stop();
  // 検証
  expect(view.querySelector("details")?.hasAttribute("open")).toBe(false);
  expect(
    view.querySelector(".mdmark-section-toggle")?.getAttribute("aria-expanded"),
  ).toBe("true");
  expect(secondPlainTab(view).getAttribute("aria-selected")).toBe("true");
  expect(Math.abs(window.scrollY - 1200)).toBeLessThanOrEqual(1);
});

// 数が合わない開閉は飛ばし、例外を出さない（正常系）
test("test_apply_view_state_when_counts_differ", async () => {
  // 準備
  const { applyViewState } = await loadViewState();
  const view = drawDocument(MARKDOWN);
  // 実行
  const stop = applyViewState({
    view,
    state: { path: "a.md", x: 0, y: 0, folds: [true, true, true], tabs: [] },
    keepFocus: false,
  });
  stop();
  // 検証
  expect(view.querySelector("details")?.hasAttribute("open")).toBe(true);
  expect(
    view.querySelector(".mdmark-section-toggle")?.getAttribute("aria-expanded"),
  ).toBe("true");
});

// keepFocus のときは、ボタンを押して移ったフォーカスを元へ戻す（正常系）
test("test_apply_view_state_when_keep_focus", async () => {
  // 準備
  const { applyViewState } = await loadViewState();
  const view = drawDocument(CODE_MARKDOWN);
  const fold = view.querySelector<HTMLButtonElement>(".mdmark-code-fold");
  if (fold === null) {
    throw new Error("コードの行の畳みのボタンが無い");
  }
  const opened = fold.getAttribute("aria-expanded") !== "true";
  (document.activeElement as HTMLElement | null)?.blur();
  // 実行
  const stop = applyViewState({
    view,
    state: { path: "a.md", x: 0, y: 0, folds: [opened], tabs: [] },
    keepFocus: true,
  });
  stop();
  // 検証
  expect(fold.getAttribute("aria-expanded")).toBe(String(opened));
  expect(document.activeElement).toBe(document.body);
});

// 保存した値を読み込める（正常系）
test("test_write_view_state", async () => {
  // 準備
  const { readViewState, writeViewState } = await loadViewState();
  const state = { path: "a.md", x: 0, y: 3000, folds: [true], tabs: [1] };
  // 実行
  writeViewState({ win: window, id: "e1", state });
  // 検証
  expect(readViewState({ win: window, id: "e1" })).toEqual(state);
});

// 書き込めないと警告して続ける（異常系）
test("test_write_view_state_when_quota_exceeded", async () => {
  // 準備
  const { writeViewState } = await loadViewState();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("いっぱい", "QuotaExceededError");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  // 実行
  writeViewState({
    win: window,
    id: "e1",
    state: { path: "a.md", x: 0, y: 0, folds: [], tabs: [] },
  });
  // 検証
  expect(warn).toHaveBeenCalledTimes(1);
});

// 壊れた値は使わない（異常系）
test("test_read_view_state_when_broken", async () => {
  // 準備
  const { readViewState, VIEW_STATE_KEY_PREFIX } = await loadViewState();
  sessionStorage.setItem(`${VIEW_STATE_KEY_PREFIX}e1`, "{");
  // 実行
  const state = readViewState({ win: window, id: "e1" });
  // 検証
  expect(state).toBeUndefined();
});

// sessionStorage を取り出せないと警告して使わない（異常系）
test("test_read_view_state_when_storage_unavailable", async () => {
  // 準備
  const { readViewState } = await loadViewState();
  vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("使えない", "SecurityError");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  // 実行
  const state = readViewState({ win: window, id: "e1" });
  // 検証
  expect(state).toBeUndefined();
  expect(warn).toHaveBeenCalledTimes(1);
});
