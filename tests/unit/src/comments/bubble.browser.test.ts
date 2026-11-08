import { afterEach, expect, test, vi } from "vitest";
import { loadSource } from "../../helpers/lazy.ts";

/** 吹き出しのコメントの修正と削除の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBubble = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/comments/bubble.ts")>(
      "../../../../src/comments/bubble.ts",
    ),
  );

/** コメントの部品の HTML を読み込む */
const loadParts = () => import("../../../../src/parts/comment.ts");

const DOC_ID = "panel-setup";

const bubbles: HTMLElement[] = [];

/** 修正と削除を持つ読み書きの関数 */
function createStore() {
  return {
    load: vi.fn(async () => []),
    save: vi.fn(async () => {
      throw new Error("使わない");
    }),
    update: vi.fn(
      async (_target: { docId: string; id: string; body: string }) => {},
    ),
    remove: vi.fn(async (_target: { docId: string; id: string }) => {}),
  };
}

/** `一つ目`・`二つ目` の 2 件の吹き出しをページに置いて操作を付け、吹き出しと控えを返す */
async function setup(options?: {
  store?: ReturnType<typeof createStore>;
  isActive?: () => boolean;
}) {
  const { attachCommentActions } = await loadBubble();
  const { renderCommentBubble } = await loadParts();
  const template = document.createElement("template");
  template.innerHTML = renderCommentBubble({
    quote: "手順",
    bodies: ["一つ目", "二つ目"],
    ids: ["c1", "c2"],
    canEdit: true,
    canRemove: true,
  });
  const bubble = template.content.firstElementChild as HTMLElement;
  document.body.append(bubble);
  bubbles.push(bubble);
  const store = options?.store ?? createStore();
  const onUpdated = vi.fn();
  const onRemoved = vi.fn(() => true);
  const actions = attachCommentActions({
    bubble,
    store,
    docId: DOC_ID,
    isActive: options?.isActive ?? (() => true),
    onUpdated,
    onRemoved,
  });
  return { bubble, store, onUpdated, onRemoved, actions };
}

/** 吹き出しの `li` を並んだ順に返す */
function items(bubble: HTMLElement): HTMLElement[] {
  return [...bubble.querySelectorAll<HTMLElement>(".mdmark-comment-list > li")];
}

/** 要素の中のセレクタに合う要素を返す（無ければ例外） */
function find(parent: Element | undefined, selector: string): HTMLElement {
  const element = parent?.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`要素が無い: ${selector}`);
  }
  return element;
}

/** 本文の欄を返す */
function field(item: HTMLElement | undefined): HTMLTextAreaElement {
  return find(item, "textarea") as HTMLTextAreaElement;
}

/** 本文の欄に書く */
function type(item: HTMLElement | undefined, body: string): void {
  const textarea = field(item);
  textarea.value = body;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** `console.error` に出た引数を 1 つの文字にする */
function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");
}

/** 合図で解決する Promise と、その解決の関数 */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  for (const bubble of bubbles.splice(0)) {
    bubble.remove();
  }
  vi.restoreAllMocks();
});

// 編集して保存すると update を呼び、書き換えた本文を出して編集へフォーカスを戻す（正常系）
test("test_attach_comment_actions_when_edited", async () => {
  // 準備
  const { bubble, store, onUpdated } = await setup();
  // 実行・検証: 1 件目の「編集」を押す
  find(items(bubble)[0], '[data-action="edit"]').click();
  expect(document.activeElement).toBe(field(items(bubble)[0]));
  expect(field(items(bubble)[0]).value).toBe("一つ目");
  // 実行: 本文を書き換えて「保存」を押す
  type(items(bubble)[0], "直した本文");
  find(items(bubble)[0], 'button[type="submit"]').click();
  // 検証
  await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
  expect(store.update).toHaveBeenCalledWith({
    docId: DOC_ID,
    id: "c1",
    body: "直した本文",
  });
  expect(onUpdated).toHaveBeenCalledWith("c1", "直した本文");
  const first = items(bubble)[0];
  expect(find(first, ".mdmark-comment-body").textContent).toBe("直した本文");
  expect(document.activeElement).toBe(find(first, '[data-action="edit"]'));
});

// 本文を空にして保存すると知らせを出して update を呼ばない（異常系）
test("test_attach_comment_actions_when_edit_empty", async () => {
  // 準備
  const { bubble, store } = await setup();
  find(items(bubble)[0], '[data-action="edit"]').click();
  // 実行
  type(items(bubble)[0], "  ");
  find(items(bubble)[0], 'button[type="submit"]').click();
  // 検証
  const first = items(bubble)[0];
  expect(find(first, '[role="alert"]').textContent).toBe(
    "コメントを書いてから保存してください。",
  );
  expect(field(first).getAttribute("aria-invalid")).toBe("true");
  expect(store.update).not.toHaveBeenCalled();
});

// 修正できないと入力欄と本文を残して知らせる（異常系）
test("test_attach_comment_actions_when_update_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const store = createStore();
  store.update.mockRejectedValue(new Error("network"));
  const { bubble, onUpdated } = await setup({ store });
  find(items(bubble)[0], '[data-action="edit"]').click();
  type(items(bubble)[0], "直した本文");
  // 実行
  find(items(bubble)[0], 'button[type="submit"]').click();
  // 検証
  await vi.waitFor(() =>
    expect(
      items(bubble)[0]?.querySelector('[role="alert"]:not([hidden])')
        ?.textContent,
    ).toBe(
      "コメントを保存できませんでした。書いたコメントは残っています。もう一度「保存」を押してください。",
    ),
  );
  expect(field(items(bubble)[0]).value).toBe("直した本文");
  expect(loggedText(spy)).toContain("update");
  expect(loggedText(spy)).toContain(DOC_ID);
  expect(loggedText(spy)).toContain("c1");
  expect(onUpdated).not.toHaveBeenCalled();
});

// キャンセルと cancel() で書き換える前の本文に戻して編集へフォーカスを戻す（正常系）
test("test_attach_comment_actions_when_edit_cancelled", async () => {
  // 準備
  const { bubble, actions } = await setup();
  // 実行・検証: 何も開いていないときの cancel()
  expect(actions.cancel()).toBe(false);
  // 実行・検証: 「キャンセル」
  find(items(bubble)[0], '[data-action="edit"]').click();
  type(items(bubble)[0], "書きかけ");
  find(items(bubble)[0], '[data-action="cancel-edit"]').click();
  expect(find(items(bubble)[0], ".mdmark-comment-body").textContent).toBe(
    "一つ目",
  );
  expect(document.activeElement).toBe(
    find(items(bubble)[0], '[data-action="edit"]'),
  );
  // 実行・検証: cancel()
  find(items(bubble)[0], '[data-action="edit"]').click();
  type(items(bubble)[0], "書きかけ");
  expect(actions.cancel()).toBe(true);
  expect(find(items(bubble)[0], ".mdmark-comment-body").textContent).toBe(
    "一つ目",
  );
  expect(document.activeElement).toBe(
    find(items(bubble)[0], '[data-action="edit"]'),
  );
});

// 削除を確かめてから remove を呼び、残ったコメントのボタンへフォーカスを移す（正常系）
test("test_attach_comment_actions_when_removed", async () => {
  // 準備
  const { bubble, store, onRemoved } = await setup();
  // 実行・検証: 1 件目の「削除」を押す
  find(items(bubble)[0], '[data-action="remove"]').click();
  const first = items(bubble)[0];
  expect(find(first, ".mdmark-comment-confirm").textContent).toContain(
    "このコメントを削除しますか? 削除すると元に戻せません。",
  );
  expect(document.activeElement).toBe(
    find(first, '[data-action="cancel-remove"]'),
  );
  expect(store.remove).not.toHaveBeenCalled();
  // 実行: 確認の「削除」を押す
  find(first, ".is-danger").click();
  // 検証
  await vi.waitFor(() => expect(items(bubble)).toHaveLength(1));
  expect(store.remove).toHaveBeenCalledWith({ docId: DOC_ID, id: "c1" });
  expect(onRemoved).toHaveBeenCalledWith("c1");
  expect(document.activeElement).toBe(
    find(items(bubble)[0], '[data-action="edit"]'),
  );
});

// 確認のキャンセルと cancel() では remove を呼ばずに削除へフォーカスを戻す（正常系）
test("test_attach_comment_actions_when_remove_cancelled", async () => {
  // 準備
  const { bubble, store, actions } = await setup();
  // 実行・検証: 確認の「キャンセル」
  find(items(bubble)[0], '[data-action="remove"]').click();
  find(items(bubble)[0], '[data-action="cancel-remove"]').click();
  expect(bubble.querySelector(".mdmark-comment-confirm")).toBeNull();
  expect(document.activeElement).toBe(
    find(items(bubble)[0], '[data-action="remove"]'),
  );
  // 実行・検証: cancel()
  find(items(bubble)[0], '[data-action="remove"]').click();
  expect(actions.cancel()).toBe(true);
  expect(bubble.querySelector(".mdmark-comment-confirm")).toBeNull();
  expect(document.activeElement).toBe(
    find(items(bubble)[0], '[data-action="remove"]'),
  );
  expect(store.remove).not.toHaveBeenCalled();
});

// 削除できないと確認を開いたまま知らせる（異常系）
test("test_attach_comment_actions_when_remove_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const store = createStore();
  store.remove.mockRejectedValue(new Error("network"));
  const { bubble, onRemoved } = await setup({ store });
  find(items(bubble)[0], '[data-action="remove"]').click();
  // 実行
  find(items(bubble)[0], ".is-danger").click();
  // 検証
  await vi.waitFor(() =>
    expect(items(bubble)[0]?.querySelector('[role="alert"]')?.textContent).toBe(
      "コメントを削除できませんでした。もう一度「削除」を押してください。",
    ),
  );
  expect(items(bubble)).toHaveLength(2);
  expect(bubble.querySelector(".mdmark-comment-confirm")).not.toBeNull();
  expect(loggedText(spy)).toContain("remove");
  expect(loggedText(spy)).toContain(DOC_ID);
  expect(loggedText(spy)).toContain("c1");
  expect(onRemoved).not.toHaveBeenCalled();
});

// 待つ間に外れたら結果を描かない（正常系）
test("test_attach_comment_actions_when_inactive", async () => {
  // 準備
  let active = true;
  const store = createStore();
  const pending = deferred();
  store.update.mockReturnValue(pending.promise);
  const { bubble, onUpdated } = await setup({
    store,
    isActive: () => active,
  });
  find(items(bubble)[0], '[data-action="edit"]').click();
  type(items(bubble)[0], "直した本文");
  find(items(bubble)[0], 'button[type="submit"]').click();
  // 実行
  active = false;
  pending.resolve();
  await pending.promise;
  await new Promise((resolve) => setTimeout(resolve, 0));
  // 検証
  expect(onUpdated).not.toHaveBeenCalled();
  const submit = find(items(bubble)[0], 'button[type="submit"]');
  expect((submit as HTMLButtonElement).disabled).toBe(true);
  expect(submit.textContent).toBe("保存しています…");
});
