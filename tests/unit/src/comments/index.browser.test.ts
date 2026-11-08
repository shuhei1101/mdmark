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

/** コメントの構造のコメント */
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

/** HTML を入れた範囲の要素をページに配置する */
function createRoot(html = "<p>導入の手順を整える。</p>"): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  roots.push(root);
  return root;
}

/** 読み込みと保存の関数。`save` は受けた下書きに `id` を追加して返却する */
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

/** 要素の中の最初の文字のセクションの、始まりと終わりの位置の間を選ぶ */
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

/** 少し待つ（出ないことを確認する前に、受け取りが動き終わるのを待つ） */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

/** 隠れていないコメントのボタンを返却する（無ければ `undefined`） */
function visibleButton(): HTMLElement | undefined {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
}

/** 文字を選んでボタンを押し、開いた入力欄を返却する */
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

/** 入力欄の本文の欄に記載する */
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

// 読み込んだコメントにマーカーを付け、見つからないものを一覧に出す（正常系）
test("test_attach_comments_when_loaded", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore([LOADED, ORPHAN]);
  // 実行
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
  // 検証
  expect(root.querySelector("mark.mdmark-comment-mark")?.textContent).toBe(
    "導入の手順",
  );
  const orphans = root.lastElementChild;
  expect(orphans?.classList.contains("mdmark-comment-orphans")).toBe(true);
  expect(orphans?.textContent).toContain("無い文字");
});

// 選んで記載して保存するとマーカーを付ける（正常系）
test("test_attach_comments_when_saved", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore();
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
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

// 空のまま保存すると通知を出して save を呼ばない（異常系）
test("test_attach_comments_when_empty_body", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const store = createStore();
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
  const form = await openForm(root);
  // 実行
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(form.querySelector('[role="alert"]')?.textContent).toContain(
      "コメントを記載してから保存してください。",
    ),
  );
  expect(store.save).not.toHaveBeenCalled();
});

// 保存できないと本文を残して通知する（異常系）
test("test_attach_comments_when_save_rejected", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const store = createStore();
  store.save.mockRejectedValue(new Error("network"));
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
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

// 読み込めないとマーカーを付けずに新しいコメントは付けられる（異常系）
test("test_attach_comments_when_load_rejected", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const store = createStore();
  store.load.mockRejectedValue(new Error("network"));
  // 実行
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
  // 検証
  expect(root.querySelector("mark.mdmark-comment-mark")).toBeNull();
  expect(loggedText(spy)).toContain("load");
  const paragraph = root.querySelector("p");
  if (paragraph) {
    select(paragraph, 0, 5);
  }
  await vi.waitFor(() => expect(visibleButton()).toBeDefined());
});

// 本文があるときの Esc で確認し、捨てないと残す（正常系）
test("test_attach_comments_when_discarding", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const root = createRoot();
  detachers.push(
    (await attachComments({ root, store: createStore(), docId: DOC_ID }))
      .detach,
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
  expect(confirm).toHaveBeenCalledWith("記載したコメントを捨てて閉じますか？");
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
    (await attachComments({ root, store: createStore(), docId: DOC_ID }))
      .detach,
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

// 削除すると文字を元の並びに戻す（正常系）
test("test_attach_comments_when_detached", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const before = root.innerHTML;
  const { detach } = await attachComments({
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

// 下に収まらなければ上に配置する（正常系）
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

/** `手順の数` に付いたコメント */
const SECOND: StoredComment = {
  id: "c2",
  quote: "手順の数",
  prefix: "",
  suffix: "を確認する。",
  body: "二つ目のコメント",
};

/** 2 つの段落の HTML（`導入の手順` と `手順の数` を別の段落に持つ） */
const TWO_PARAGRAPHS = "<p>導入の手順を整える。</p><p>手順の数を確認する。</p>";

/** 次の描画のタイミングまで待つ */
const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/** 範囲の中のマーカーの文字を、並んだ順に返却する */
function markTexts(root: HTMLElement): string[] {
  return [...root.querySelectorAll("mark.mdmark-comment-mark")].map(
    (mark) => mark.textContent ?? "",
  );
}

/** 範囲の中の最初のマーカーを押して開いた吹き出しを返却する */
function openBubble(root: HTMLElement): HTMLElement {
  root.querySelector<HTMLElement>("mark.mdmark-comment-mark")?.click();
  const bubble = document.querySelector<HTMLElement>(".mdmark-comment-bubble");
  if (!bubble) {
    throw new Error("吹き出しが開かない");
  }
  return bubble;
}

/** 合図で解決する Promise と、その解決の関数 */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// update・remove を持たないと編集と削除を出さず、持つ関数のボタンだけを出す（正常系）
test("test_attach_comments_when_store_without_edit", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const plainRoot = createRoot();
  const removableRoot = createRoot();
  const plain = await attachComments({
    root: plainRoot,
    store: createStore([LOADED]),
    docId: DOC_ID,
  });
  detachers.push(plain.detach);
  // 実行・検証: load・save だけ
  const plainBubble = openBubble(plainRoot);
  expect(plainBubble.querySelector(".mdmark-comment-icon-button")).toBeNull();
  plain.detach();
  // 実行・検証: remove も持つ
  const removable = await attachComments({
    root: removableRoot,
    store: { ...createStore([LOADED]), remove: vi.fn(async () => {}) },
    docId: DOC_ID,
  });
  detachers.push(removable.detach);
  const buttons = openBubble(removableRoot).querySelectorAll<HTMLElement>(
    ".mdmark-comment-icon-button",
  );
  expect(buttons).toHaveLength(1);
  expect(buttons[0]?.getAttribute("aria-label")).toBe("削除");
});

// マーカーの最後のコメントを削除するとマーカーを削除して吹き出しを閉じ、ブロックへフォーカスを移す（正常系）
test("test_attach_comments_when_removed_last", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const remove = vi.fn(async (_target: { docId: string; id: string }) => {});
  const store = { ...createStore([LOADED]), remove };
  detachers.push((await attachComments({ root, store, docId: DOC_ID })).detach);
  const bubble = openBubble(root);
  // 実行
  bubble.querySelector<HTMLElement>('[data-action="remove"]')?.click();
  bubble.querySelector<HTMLElement>(".is-danger")?.click();
  // 検証
  await vi.waitFor(() =>
    expect(root.querySelector("mark.mdmark-comment-mark")).toBeNull(),
  );
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith({ docId: DOC_ID, id: "c1" });
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
  const paragraph = root.querySelector("p");
  expect(paragraph?.getAttribute("tabindex")).toBe("-1");
  expect(document.activeElement).toBe(paragraph);
});

// 再読み込みするとマーカーをもう一度付け、開いている吹き出しを閉じる（正常系）
test("test_attach_comments_when_reloaded", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot(TWO_PARAGRAPHS);
  const store = createStore([LOADED]);
  store.load.mockResolvedValueOnce([LOADED]).mockResolvedValueOnce([SECOND]);
  const controller = await attachComments({ root, store, docId: DOC_ID });
  detachers.push(controller.detach);
  openBubble(root);
  // 実行
  await controller.reload();
  // 検証
  expect(markTexts(root)).toEqual(["手順の数"]);
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
});

// 余白のマーカーを配置したとき、再読み込みするともう一度付けたマーカーの数に余白のマーカーをもう一度配置する（正常系）
test("test_attach_comments_when_reloaded_with_margin", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot(TWO_PARAGRAPHS);
  root.className = "mdmark-content";
  const store = createStore();
  store.load
    .mockResolvedValueOnce([LOADED])
    .mockResolvedValueOnce([LOADED, SECOND]);
  const controller = await attachComments({
    root,
    store,
    docId: DOC_ID,
    margin: true,
  });
  detachers.push(controller.detach);
  await nextFrame();
  await nextFrame();
  const before = document.querySelectorAll(
    ".mdmark-comment-margin .mdmark-comment-marker",
  ).length;
  // 実行
  await controller.reload();
  await nextFrame();
  await nextFrame();
  // 検証
  expect(before).toBe(1);
  expect(
    document.querySelectorAll(".mdmark-comment-margin .mdmark-comment-marker"),
  ).toHaveLength(2);
});

// 再読み込みしても記載している入力欄は残す（正常系）
test("test_attach_comments_when_reloaded_with_form", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot();
  const controller = await attachComments({
    root,
    store: createStore(),
    docId: DOC_ID,
  });
  detachers.push(controller.detach);
  const form = await openForm(root);
  type(form, BODY);
  // 実行
  await controller.reload();
  // 検証
  expect(document.querySelector(".mdmark-comment-form")).toBe(form);
  expect(form.querySelector("textarea")?.value).toBe(BODY);
});

// 再読み込みできないとマーカーを残して元のエラーで reject する（異常系）
test("test_attach_comments_when_reload_rejected", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const store = createStore([LOADED]);
  const error = new Error("network");
  const controller = await attachComments({ root, store, docId: DOC_ID });
  detachers.push(controller.detach);
  store.load.mockRejectedValueOnce(error);
  // 実行・検証
  await expect(controller.reload()).rejects.toBe(error);
  expect(markTexts(root)).toEqual(["導入の手順"]);
  expect(loggedText(spy)).toContain("load");
  expect(loggedText(spy)).toContain(DOC_ID);
});

// 次の reload か detach の後に届いた再読み込みの結果を描かない（正常系）
test("test_attach_comments_when_reload_superseded", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot(TWO_PARAGRAPHS);
  const store = createStore();
  const controller = await attachComments({ root, store, docId: DOC_ID });
  detachers.push(controller.detach);
  const second = deferred<StoredComment[]>();
  const third = deferred<StoredComment[]>();
  store.load
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  // 実行: 2 回目を待たせたまま 3 回目を呼び、3 回目を先に返却してから 2 回目を返却する
  const secondReload = controller.reload();
  const thirdReload = controller.reload();
  third.resolve([LOADED]);
  await thirdReload;
  second.resolve([SECOND]);
  await secondReload;
  // 検証
  expect(markTexts(root)).toEqual(["導入の手順"]);
  // 準備: 別の範囲で、再読み込みを待たせたまま削除する
  const otherRoot = createRoot();
  const otherStore = createStore();
  const other = await attachComments({
    root: otherRoot,
    store: otherStore,
    docId: DOC_ID,
  });
  const pending = deferred<StoredComment[]>();
  otherStore.load.mockReturnValueOnce(pending.promise);
  // 実行
  const reload = other.reload();
  other.detach();
  pending.resolve([LOADED]);
  // 検証
  await expect(reload).resolves.toBeUndefined();
  expect(otherRoot.querySelector("mark.mdmark-comment-mark")).toBeNull();
});

// マーカーへ移ってフォーカスと data-focused を付け、次の focus で前の強調を解除する（正常系）
test("test_attach_comments_when_focused", async () => {
  // 準備
  const { attachComments } = await loadComments();
  const root = createRoot(TWO_PARAGRAPHS);
  const reveal = vi.fn();
  const scrollIntoView = vi
    .spyOn(Element.prototype, "scrollIntoView")
    .mockImplementation(() => {});
  const controller = await attachComments({
    root,
    store: createStore([LOADED, SECOND]),
    docId: DOC_ID,
    reveal,
  });
  detachers.push(controller.detach);
  const [first, next] = root.querySelectorAll<HTMLElement>(
    "mark.mdmark-comment-mark",
  );
  // 実行・検証: c1 へ移る
  controller.focus("c1");
  expect(document.activeElement).toBe(first);
  expect(first?.hasAttribute("data-focused")).toBe(true);
  expect(reveal).toHaveBeenCalledWith(first);
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  expect(scrollIntoView.mock.contexts.at(-1)).toBe(first);
  // 実行・検証: c2 へ移ると前の強調を解除する
  controller.focus("c2");
  expect(first?.hasAttribute("data-focused")).toBe(false);
  expect(next?.hasAttribute("data-focused")).toBe(true);
  // 実行・検証: 無い id では何もしない
  controller.focus("無い");
  expect(next?.hasAttribute("data-focused")).toBe(true);
  expect(document.querySelector(".mdmark-comment-bubble")).toBeNull();
});
