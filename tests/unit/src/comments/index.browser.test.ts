import { afterEach, expect, test, vi } from "vitest";
import { loadSource } from "../../helpers/lazy.ts";

/** コメントの部品のモジュールを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadComments = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/comments/index.ts")>(
      "../../../../src/comments/index.ts",
    ),
  );

const DOC_ID = "panel-setup";
const BODY = "手順の数を <b>3</b> にする";

const detachers: Array<() => void> = [];
const roots: HTMLElement[] = [];

/** コメントの形のコメント */
type StoredComment = {
  id: string;
  quote: string;
  prefix: string;
  suffix: string;
  body: string;
};

/** `導入の手順` に付いたコメント */
const LOADED: StoredComment = {
  id: "c1",
  quote: "導入の手順",
  prefix: "",
  suffix: "を整える。",
  body: "既にあるコメント",
};

/** 箇所の見つからないコメント */
const ORPHAN: StoredComment = {
  id: "c2",
  quote: "無い文字",
  prefix: "",
  suffix: "",
  body: "迷子のコメント",
};

/** HTML を入れた範囲の要素をページに置く */
function createRoot(html = "<p>導入の手順を整える。</p>"): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return root;
}

/** 読み書きの関数。`save` は受けた下書きに `id` を足して返す */
function createStore(comments: StoredComment[] = []) {
  return {
    load: vi.fn(async () => comments),
    save: vi.fn(
      async ({ comment }: { comment: Omit<StoredComment, "id"> }) => ({
        id: "c1",
        ...comment,
      }),
    ),
  };
}

/** 要素の中の最初の文字の節の、始まりと終わりの位置の間を選ぶ */
function select(element: Element, start: number, end: number): void {
  const textNode = element.firstChild;
  if (textNode === null) {
    throw new Error("選ぶ文字が無い");
  }
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

/** 少し待つ（出ないことを確かめる前に、受け取りが動き終わるのを待つ） */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

/** 隠れていないコメントのボタンを返す（無ければ `undefined`） */
function visibleButton(): HTMLElement | undefined {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
}

/** 文字を選んでボタンを押し、開いた入力欄を返す */
async function openForm(root: HTMLElement): Promise<HTMLElement> {
  const paragraph = root.querySelector("p");
  if (!paragraph) {
    throw new Error("段落が無い");
  }
  select(paragraph, 0, 5);
  await vi.waitFor(() => expect(visibleButton()).toBeDefined());
  visibleButton()?.click();
  const form = document.querySelector<HTMLElement>(".mdmark-comment-form");
  if (!form) {
    throw new Error("入力欄が開かない");
  }
  return form;
}

/** 入力欄の本文の欄に書く */
function type(form: HTMLElement, body: string): void {
  const field = form.querySelector("textarea");
  if (!field) {
    throw new Error("本文の欄が無い");
  }
  field.value = body;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 入力欄の保存のボタンを押す */
function submit(form: HTMLElement): void {
  form.querySelector<HTMLButtonElement>(".is-primary")?.click();
}

/** `console.error` に出た引数を 1 つの文字にする */
function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");
}

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  for (const root of roots.splice(0)) {
    root.remove();
  }
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

// 読んだコメントに印を付け、見つからないものを一覧に出す（正常系）
test("test_attach_comments_when_loaded", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore([LOADED, ORPHAN]);
  // 実行
  detachers.push(await attachComments({ root, store, docId: DOC_ID }));
  // 検証
  expect(root.querySelector("mark.mdmark-comment-mark")?.textContent).toBe(
    "導入の手順",
  );
  const orphans = root.lastElementChild;
  expect(orphans?.classList.contains("mdmark-comment-orphans")).toBe(true);
  expect(orphans?.textContent).toContain("無い文字");
});

// 選んで書いて保存すると印を付ける（正常系）
test("test_attach_comments_when_saved", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore();
  detachers.push(await attachComments({ root, store, docId: DOC_ID }));
  const form = await openForm(root);
  type(form, BODY);
  // 実行
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(root.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  expect(store.save).toHaveBeenCalledTimes(1);
  expect(store.save).toHaveBeenCalledWith({
    docId: DOC_ID,
    comment: {
      quote: "導入の手順",
      prefix: "",
      suffix: "を整える。",
      body: BODY,
    },
  });
  expect(document.querySelector(".mdmark-comment-form")).toBeNull();
  const mark = root.querySelector<HTMLElement>("mark.mdmark-comment-mark");
  expect(document.activeElement).toBe(mark);
  // 実行
  mark?.click();
  // 検証
  const bubble = document.querySelector(".mdmark-comment-bubble");
  expect(bubble?.querySelector(".mdmark-comment-body")?.textContent).toBe(BODY);
  expect(bubble?.querySelector("b")).toBeNull();
});

// 空のまま保存すると知らせを出して save を呼ばない（異常系）
test("test_attach_comments_when_empty_body", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore();
  detachers.push(await attachComments({ root, store, docId: DOC_ID }));
  const form = await openForm(root);
  // 実行
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(form.querySelector('[role="alert"]')?.textContent).toContain(
      "コメントを書いてから保存してください。",
    ),
  );
  expect(store.save).not.toHaveBeenCalled();
});

// 保存できないと本文を残して知らせる（異常系）
test("test_attach_comments_when_save_rejected", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const store = createStore();
  store.save.mockRejectedValue(new Error("network"));
  detachers.push(await attachComments({ root, store, docId: DOC_ID }));
  const form = await openForm(root);
  type(form, BODY);
  // 実行
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(form.querySelector('[role="alert"]')?.textContent).toContain(
      "コメントを保存できませんでした",
    ),
  );
  expect(document.querySelector(".mdmark-comment-form")).toBe(form);
  expect(form.querySelector("textarea")?.value).toBe(BODY);
  expect(root.querySelector("mark.mdmark-comment-mark")).toBeNull();
  expect(loggedText(spy)).toContain("save");
  expect(loggedText(spy)).toContain(DOC_ID);
});

// 読めないと印を付けずに新しいコメントは付けられる（異常系）
test("test_attach_comments_when_load_rejected", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const store = createStore();
  store.load.mockRejectedValue(new Error("network"));
  // 実行
  detachers.push(await attachComments({ root, store, docId: DOC_ID }));
  // 検証
  expect(root.querySelector("mark.mdmark-comment-mark")).toBeNull();
  expect(loggedText(spy)).toContain("load");
  const paragraph = root.querySelector("p");
  if (paragraph) {
    select(paragraph, 0, 5);
  }
  await vi.waitFor(() => expect(visibleButton()).toBeDefined());
});

// 本文があるときの Esc で確かめ、捨てないと残す（正常系）
test("test_attach_comments_when_discarding", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const root = createRoot();
  detachers.push(
    await attachComments({ root, store: createStore(), docId: DOC_ID }),
  );
  const form = await openForm(root);
  type(form, BODY);
  // 実行
  form
    .querySelector("textarea")
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  // 検証
  expect(confirm).toHaveBeenCalledWith("書いたコメントを捨てて閉じますか？");
  expect(document.querySelector(".mdmark-comment-form")).toBe(form);
});

// コードの中の選びにはボタンを出さない（正常系）
test("test_attach_comments_when_excluded", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot(
    "<p>導入の手順を整える。</p><pre><code>コードの文字</code></pre>",
  );
  detachers.push(
    await attachComments({ root, store: createStore(), docId: DOC_ID }),
  );
  const code = root.querySelector("code");
  // 実行
  if (code) {
    select(code, 0, 3);
  }
  await settle();
  // 検証
  expect(visibleButton()).toBeUndefined();
});

// 外すと文字を元の並びに戻す（正常系）
test("test_attach_comments_when_detached", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const before = root.innerHTML;
  const detach = await attachComments({
    root,
    store: createStore([LOADED, ORPHAN]),
    docId: DOC_ID,
  });
  expect(root.querySelector("mark.mdmark-comment-mark")).not.toBeNull();
  // 実行
  detach();
  // 検証
  expect(root.innerHTML).toBe(before);
  expect(document.querySelector(".mdmark-comment-add")).toBeNull();
  expect(document.querySelector(".mdmark-comment-orphans")).toBeNull();
  expect(document.getElementById("mdmark-comment-hint")).toBeNull();
});

// 下に収まらなければ上に置く（正常系）
test("test_place_popover_when_no_room_below", async () => {
  // 準備
  const { placePopover } = await loadComments();
  const element = document.createElement("div");
  element.style.cssText = "position: fixed; width: 200px; height: 100px;";
  document.body.append(element);
  roots.push(element);
  const rect = new DOMRect(100, window.innerHeight - 20, 50, 16);
  // 実行
  placePopover({ element, rect });
  // 検証
  expect(element.getBoundingClientRect().top).toBeLessThan(rect.top);
});
