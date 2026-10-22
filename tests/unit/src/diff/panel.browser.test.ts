import { afterEach, expect, test, vi } from "vitest";
import type { DiffRevision, DiffSource } from "../../../../src/diff/source.ts";

/** 差分を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPanel = () => import("../../../../src/diff/panel.ts");

/** 知らせの枠の処理を読み込む（差分の知らせの枠を期待値にする） */
const loadNotice = () => import("../../../../src/parts/notice.ts");

// 新しい順に並べた 3 つのリビジョン
const REVISIONS: DiffRevision[] = [
  { id: "r3", at: "2026-10-20T02:05:00Z", label: "足す" },
  { id: "r2", at: "2026-10-19T07:40:00Z", label: "件数を直す" },
  { id: "r1", at: "2026-10-18T00:12:00Z", label: "初版" },
];

// リビジョンごとの本文
const CONTENTS: Record<string, string> = {
  r1: "# ガイド\n差分を色分けして読む。\n",
  r2: "# ガイド\n変更を色分けして読む。\n",
  r3: "# ガイド\n変更を色分けして読む。\n足す行\n",
};

/** `content` が受けた引数 */
type ContentCall = { docId: string; revisionId: string };

/** 呼ばれた引数を控える取り出し元 */
type RecordingSource = DiffSource & {
  revisionsCalls: string[];
  contentCalls: ContentCall[];
};

/** 呼ばれた引数を控え、本文をすぐに返す取り出し元を作る */
function createSource(
  override: Partial<DiffSource> = {},
  revisions: DiffRevision[] = REVISIONS,
): RecordingSource {
  const revisionsCalls: string[] = [];
  const contentCalls: ContentCall[] = [];
  return {
    revisionsCalls,
    contentCalls,
    revisions: async (docId) => {
      revisionsCalls.push(docId);
      return revisions;
    },
    content: async (target) => {
      contentCalls.push(target);
      return CONTENTS[target.revisionId] ?? "";
    },
    ...override,
  };
}

const roots: HTMLElement[] = [];
const detaches: (() => void)[] = [];

/** 見出しと段落を描いた、描く先の要素をページに置く */
function createRoot(): HTMLElement {
  const root = document.createElement("div");
  root.className = "mdmark";
  root.innerHTML = "<h1>ガイド</h1><p>段落</p>";
  document.body.append(root);
  roots.push(root);
  return root;
}

/** 差分を付け、後始末のために外す関数を控える */
async function attachTracked(
  root: HTMLElement,
  source: DiffSource,
): Promise<() => void> {
  const { attachDiff } = await loadPanel();
  const detach = attachDiff({
    root,
    source,
    docId: "guide",
    renderHtml: (html: string) => html,
  });
  detaches.push(detach);
  return detach;
}

/** 「変更を見る」のボタンを押す */
function clickToggle(root: HTMLElement): void {
  const toggle = root.querySelector<HTMLButtonElement>(".mdmark-diff-toggle");
  if (toggle === null) {
    throw new Error("変更を見るのボタンが無い");
  }
  toggle.click();
}

/** `ラベルの文字` を持つ label が指す select を返す */
function findSelect(root: HTMLElement, labelText: string): HTMLSelectElement {
  const label = [...root.querySelectorAll("label")].find(
    (candidate) => candidate.textContent?.trim() === labelText,
  );
  const select = label && root.querySelector(`#${CSS.escape(label.htmlFor)}`);
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`select が無い: ${labelText}`);
  }
  return select;
}

/** 差分の行の文字を、上から順に返す */
function lineTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll(".mdmark-diff-line")].map(
    (line) => line.textContent ?? "",
  );
}

/** 保留した `content` の呼び出し */
type Pending = { revisionId: string; resolve: (text: string) => void };

/** `content` が結果を返すのを保留して、呼ばれた順に控える取り出し元を作る */
function createPendingSource(): { source: DiffSource; pending: Pending[] } {
  const pending: Pending[] = [];
  const source: DiffSource = {
    revisions: async () => REVISIONS,
    content: ({ revisionId }) =>
      new Promise<string>((resolve) => {
        pending.push({ revisionId, resolve });
      }),
  };
  return { source, pending };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const detach of detaches.splice(0)) {
    detach();
  }
  for (const root of roots.splice(0)) {
    root.remove();
  }
  for (const band of document.querySelectorAll(".mdmark-diff-minimap")) {
    band.remove();
  }
});

// 開くと一覧と 2 つの本文を取り出して差分を描く（正常系）
test("test_attach_diff", async () => {
  // 準備
  const root = createRoot();
  const source = createSource();
  // 実行
  await attachTracked(root, source);
  expect(source.revisionsCalls).toEqual([]);
  clickToggle(root);
  // 検証
  await vi.waitFor(() => {
    expect(root.querySelector(".mdmark-diff-line")).not.toBeNull();
  });
  expect(source.revisionsCalls).toEqual(["guide"]);
  expect(source.contentCalls.map((call) => call.revisionId).sort()).toEqual([
    "r2",
    "r3",
  ]);
  expect(source.contentCalls.every((call) => call.docId === "guide")).toBe(
    true,
  );
  expect(root.querySelector("p")?.hidden).toBe(true);
  expect(root.querySelector("h1")?.hidden).toBeFalsy();
});

// 前を選び直すと後の選択を直して描き直す（正常系）
test("test_attach_diff_when_reselected", async () => {
  // 準備
  const root = createRoot();
  const source = createSource();
  await attachTracked(root, source);
  clickToggle(root);
  await vi.waitFor(() => {
    expect(root.querySelector(".mdmark-diff-line")).not.toBeNull();
  });
  source.contentCalls.length = 0;
  // 実行
  const before = findSelect(root, "前のリビジョン");
  before.value = "r1";
  before.dispatchEvent(new Event("change", { bubbles: true }));
  // 検証
  await vi.waitFor(() => {
    expect(source.contentCalls.map((call) => call.revisionId).sort()).toEqual([
      "r1",
      "r3",
    ]);
  });
  const after = findSelect(root, "後のリビジョン");
  const r1 = [...after.options].find((option) => option.value === "r1");
  expect(r1?.disabled).toBe(true);
});

// 待つ間に選び直すと、前の待ちの結果を描かない（正常系）
test("test_attach_diff_when_stale", async () => {
  // 準備
  const root = createRoot();
  const { source, pending } = createPendingSource();
  await attachTracked(root, source);
  clickToggle(root);
  await vi.waitFor(() => {
    expect(pending).toHaveLength(2);
  });
  const first = [...pending];
  // 実行: 1 回目の本文を返さないまま選び直し、2 回目を先に返す
  const before = findSelect(root, "前のリビジョン");
  before.value = "r1";
  before.dispatchEvent(new Event("change", { bubbles: true }));
  await vi.waitFor(() => {
    expect(pending).toHaveLength(4);
  });
  for (const call of pending.slice(2)) {
    call.resolve(CONTENTS[call.revisionId] ?? "");
  }
  await vi.waitFor(() => {
    expect(lineTexts(root).some((text) => text.includes("差分"))).toBe(true);
  });
  const settled = lineTexts(root);
  for (const call of first) {
    call.resolve(CONTENTS[call.revisionId] ?? "");
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  // 検証
  expect(lineTexts(root)).toEqual(settled);
});

// 待ちが 1 秒・2 秒を過ぎると読み込み中と回る表示を出す（正常系）
test("test_attach_diff_when_loading", async () => {
  // 準備
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const root = createRoot();
  const source = createSource({
    revisions: () => new Promise<DiffRevision[]>(() => {}),
  });
  await attachTracked(root, source);
  // 実行
  clickToggle(root);
  await vi.advanceTimersByTimeAsync(500);
  const early = root.textContent ?? "";
  await vi.advanceTimersByTimeAsync(600);
  const afterOneSecond = root.textContent ?? "";
  const spinnerAtOneSecond = root.querySelector(".mdmark-diff-spinner");
  await vi.advanceTimersByTimeAsync(1000);
  const spinner = root.querySelector(".mdmark-diff-spinner");
  // 検証
  expect(early).not.toContain("変更を読み込んでいます");
  expect(afterOneSecond).toContain("変更を読み込んでいます");
  expect(spinnerAtOneSecond).toBeNull();
  expect(spinner).not.toBeNull();
  expect(spinner?.getAttribute("aria-hidden")).toBe("true");
});

// 一覧を取り出せないと知らせの枠を出す（異常系）
test("test_attach_diff_when_revisions_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { renderNotice } = await loadNotice();
  const error = new Error("一覧を返せない");
  const root = createRoot();
  const source = createSource({
    revisions: async () => {
      throw error;
    },
  });
  await attachTracked(root, source);
  // 実行
  clickToggle(root);
  // 検証
  await vi.waitFor(() => {
    expect(root.querySelector(".mdmark-notice")).not.toBeNull();
  });
  expect(root.innerHTML).toContain(
    renderNotice({ name: "guide", source: "diff-revisions" }),
  );
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  expect(args.some((arg) => String(arg).includes("revisions"))).toBe(true);
  expect(args.some((arg) => String(arg).includes("guide"))).toBe(true);
  expect(source.contentCalls).toEqual([]);
});

// 本文を取り出せないと選択を残して知らせの枠を出す（異常系）
test("test_attach_diff_when_content_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { renderNotice } = await loadNotice();
  const error = new Error("本文を返せない");
  const root = createRoot();
  const source = createSource({
    content: async ({ revisionId }) => {
      if (revisionId === "r2") {
        throw error;
      }
      return CONTENTS[revisionId] ?? "";
    },
  });
  await attachTracked(root, source);
  // 実行
  clickToggle(root);
  // 検証
  await vi.waitFor(() => {
    expect(root.querySelector(".mdmark-notice")).not.toBeNull();
  });
  expect(root.innerHTML).toContain(
    renderNotice({
      name: "2026/10/19 16:40 件数を直す",
      source: "diff-content",
    }),
  );
  expect(root.querySelector("select")).not.toBeNull();
  expect(root.querySelector(".mdmark-diff-line")).toBeNull();
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  expect(args.some((arg) => String(arg).includes("content"))).toBe(true);
  expect(args.some((arg) => String(arg).includes("r2"))).toBe(true);
});

// 外すと置いた要素を取り除き、本文を戻す（正常系）
test("test_attach_diff_when_detached", async () => {
  // 準備
  const root = createRoot();
  const source = createSource();
  const detach = await attachTracked(root, source);
  clickToggle(root);
  await vi.waitFor(() => {
    expect(root.querySelector(".mdmark-diff-line")).not.toBeNull();
  });
  // 実行
  detach();
  // 検証
  expect(root.querySelector(".mdmark-diff-toggle")).toBeNull();
  expect(root.querySelector(".mdmark-diff")).toBeNull();
  expect(root.querySelector(".mdmark-diff-line")).toBeNull();
  expect(root.querySelector("p")?.hidden).toBeFalsy();
  expect(document.querySelector(".mdmark-diff-minimap")).toBeNull();
});
