import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** コメントのカスタム要素を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElement = () =>
  loadSource(
    import.meta.glob<
      typeof import("../../../../src/comments/mdmark-comments.element.ts")
    >("../../../../src/comments/mdmark-comments.element.ts"),
  );

/** 部品のモジュールを読み込む処理を読み込む */
const loadPartModules = () => import("../../../../src/part-modules.ts");

/** コメントの部品のモジュールを読み込む */
const loadComments = () => import("../../../../src/comments/index.ts");

const TEXT = "導入の手順を整える。";

const elements: HTMLElement[] = [];

beforeAll(async () => {
  addStyles();
  const { defineCommentsElement } = await loadElement().catch(() => ({
    defineCommentsElement: undefined,
  }));
  defineCommentsElement?.(customElements);
});

beforeEach(async () => {
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  setPartModuleLoader("comments", loadComments);
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
  window.getSelection()?.removeAllRanges();
});

/** `導入の手順` に付いたコメント */
const comment = () => ({
  id: "c-1",
  quote: "導入の手順",
  prefix: "",
  suffix: "を整える。",
  body: "手順の数を 3 にする",
});

/** 型 MdmarkCommentsElement のプロパティを持つ要素 */
type CommentsElement = HTMLElement & {
  comments?: unknown;
  editable?: unknown;
  removable?: unknown;
};

/** `導入の手順を整える。` の `p` を持つ <mdmark-comments> をページに配置する */
function createComments(): CommentsElement {
  const element = document.createElement("mdmark-comments") as CommentsElement;
  element.innerHTML = `<p>${TEXT}</p>`;
  document.body.append(element);
  elements.push(element);
  return element;
}

/** 付け終えるまで待つ（部品のモジュールの読み込みを含む） */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

/** 段落の最初の 5 文字（`導入の手順`）を選び、コメントのボタンを押して入力欄を返却する */
async function openForm(element: HTMLElement): Promise<HTMLElement> {
  const textNode = element.querySelector("p")?.firstChild;
  if (!textNode) {
    throw new Error("選ぶ文字が無い");
  }
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  await vi.waitFor(() => {
    const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
    expect(button && !button.hidden).toBe(true);
  });
  document.querySelector<HTMLElement>(".mdmark-comment-add")?.click();
  const form = document.querySelector<HTMLElement>(".mdmark-comment-form");
  if (!form) {
    throw new Error("入力欄が開かない");
  }
  return form;
}

// 指定したコメントにマーカーを付ける（正常系）
test("test_attach_now", async () => {
  // 準備
  await loadElement();
  const element = createComments();
  // 実行
  element.comments = [comment()];
  await flush();
  // 検証
  await vi.waitFor(() =>
    expect(
      element.querySelector("mark.mdmark-comment-mark")?.textContent,
    ).toBe("導入の手順"),
  );
  expect(element.querySelector("p")?.textContent).toBe(TEXT);
});

// 保存をイベントで送信し、入力欄を閉じて表示を変えない（正常系）
test("test_attach_now_when_saved", async () => {
  // 準備
  await loadElement();
  const element = createComments();
  element.comments = [];
  await flush();
  const saves = vi.fn();
  element.addEventListener("mdmark-comment-save", (event) =>
    saves((event as CustomEvent).detail),
  );
  const form = await openForm(element);
  const field = form.querySelector("textarea");
  if (field) {
    field.value = "手順の数を <b>3</b> にする";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // 実行
  form.querySelector<HTMLButtonElement>(".is-primary")?.click();
  await flush();
  // 検証
  expect(saves).toHaveBeenCalledTimes(1);
  expect(saves).toHaveBeenCalledWith({
    quote: "導入の手順",
    prefix: "",
    suffix: "を整える。",
    body: "手順の数を <b>3</b> にする",
  });
  expect(document.querySelector(".mdmark-comment-form")).toBeNull();
  expect(element.querySelector("mark.mdmark-comment-mark")).toBeNull();
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

// 誤った指定は本文を残して通知ブロックを配置する（異常系）
test("test_attach_now_when_invalid", async () => {
  // 準備
  await loadElement();
  const element = createComments();
  // 実行
  const assign = () => {
    element.comments = "c-1";
  };
  expect(assign).not.toThrow();
  await flush();
  // 検証
  const notice = element.firstElementChild;
  expect(notice?.classList.contains("mdmark-notice")).toBe(true);
  expect(notice?.innerHTML).toContain("この箇所を表示できません");
  expect(notice?.innerHTML).toContain("<code>comments</code>");
  expect(element.querySelector("p")?.textContent).toBe(TEXT);
});

// 取り除くとマーカーを削除する（正常系）
test("test_disconnected_callback", async () => {
  // 準備
  await loadElement();
  const element = createComments();
  element.comments = [comment()];
  await flush();
  await vi.waitFor(() =>
    expect(element.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  // 実行
  element.remove();
  // 検証
  expect(element.querySelector("mark.mdmark-comment-mark")).toBeNull();
  expect(element.querySelector("p")?.innerHTML).toBe(TEXT);
});

// 未登録なら登録し、登録済みなら何もしない（正常系）
test("test_define_comments_element", async () => {
  // 準備
  const { defineCommentsElement, MdmarkCommentsElement } = await loadElement();
  const define = vi.fn();
  const registered: Array<CustomElementConstructor | undefined> = [
    undefined,
    class extends HTMLElement {},
  ];
  const registry = {
    get: vi.fn(() => registered.shift()),
    define,
  } as unknown as CustomElementRegistry;
  // 実行
  defineCommentsElement(registry);
  defineCommentsElement(registry);
  // 検証
  expect(define).toHaveBeenCalledTimes(1);
  expect(define).toHaveBeenCalledWith(
    "mdmark-comments",
    MdmarkCommentsElement,
  );
});
