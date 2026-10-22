import { afterEach, expect, inject, test, vi } from "vitest";
import type {
  MdmarkComment,
  MdmarkCommentsHandle,
} from "../../../src/index.ts";

type Built = typeof import("../../../src/index.ts");

const DOC_ID = "panel-setup";
const BODY = "手順の数を <b>3</b> にする";

/** `quote` が `導入の手順` のコメントを作る */
function comment(id: string, quote = "導入の手順"): MdmarkComment {
  return { id, quote, prefix: "", suffix: "", body: `本文 ${id}` };
}

const elements: HTMLElement[] = [];
const handles: MdmarkCommentsHandle[] = [];
let stylesheetLoaded: Promise<void> | undefined;
let built: Promise<Built> | undefined;

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

/** 部品のモジュールを 404 にして配る、ビルドした配布物のファイルの URL にする */
function blockedDistUrl(file: string): string {
  return `/fixtures/dist/blocked${inject("builtRoot")}/dist/${file}`;
}

/** ビルドした CSS を 1 度だけ読み込む */
function loadStylesheet(): Promise<void> {
  stylesheetLoaded ??= new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = distUrl("index.css");
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.append(link);
  });
  return stylesheetLoaded;
}

/** ビルドした JS を 1 度だけ読み込み、CSS と合わせて使える状態にする */
async function loadBuilt(): Promise<Built> {
  await loadStylesheet();
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  return built;
}

/** `導入の手順を整える。` の段落を持つ、コメントを付けられる範囲の要素と、その外の段落をページに置く */
function createHost(): { el: HTMLElement; outside: HTMLElement } {
  const el = document.createElement("div");
  el.innerHTML = "<p>導入の手順を整える。</p>";
  const outside = document.createElement("p");
  outside.textContent = "要素の外の段落";
  document.body.append(el, outside);
  elements.push(el, outside);
  return { el, outside };
}

/** 読み書きの関数。`save` は受けた下書きに `id: "c1"` を足して返す */
function createStore(loaded: MdmarkComment[] = []) {
  return {
    load: vi.fn(async (_target: { docId: string }) => loaded),
    save: vi.fn(
      async (target: {
        docId: string;
        comment: Omit<MdmarkComment, "id">;
      }): Promise<MdmarkComment> => ({ id: "c1", ...target.comment }),
    ),
  };
}

/** コメントを付けられるようにし、後始末のために戻り値を控える */
async function mountCommentsTracked(
  el: HTMLElement,
  store: ReturnType<typeof createStore>,
): Promise<MdmarkCommentsHandle> {
  const { mountComments } = await loadBuilt();
  const handle = await mountComments(el, { store, docId: DOC_ID });
  handles.push(handle);
  return handle;
}

/** 要素の中の最初の文字の節の、始まりと終わりの位置の間を選ぶ */
function select(element: Element, start: number, end: number): void {
  const text = element.firstChild;
  if (!text) {
    throw new Error("選ぶ文字が無い");
  }
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** 隠れていないコメントのボタンを返す（無ければ `undefined`） */
function visibleButton(): HTMLElement | undefined {
  const button = document.querySelector<HTMLElement>(".mdmark-comment-add");
  return button && !button.hidden ? button : undefined;
}

/** 少し待つ（出ないことを確かめる前に、選びの受け取りが動き終わるのを待つ） */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}

/** 段落の文字を選び、ボタンを押して入力欄を開き、本文を書く */
async function openFormAndType(el: Element, body: string): Promise<Element> {
  const paragraph = el.querySelector("p");
  if (!paragraph) {
    throw new Error("段落が無い");
  }
  select(paragraph, 0, 5);
  await vi.waitFor(() => expect(visibleButton()).toBeDefined());
  visibleButton()?.click();
  const form = document.querySelector(".mdmark-comment-form");
  const field = form?.querySelector("textarea");
  if (!form || !field) {
    throw new Error("入力欄が開かない");
  }
  field.value = body;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return form;
}

/** 入力欄の保存のボタンを押す */
function submit(form: Element): void {
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
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

// 使う側の要素の中の文字を選んでコメントを保存し、印を付け、片付ける（正常系）
test("test_normal", async () => {
  // 準備
  const { el, outside } = createHost();
  const store = createStore();
  const handle = await mountCommentsTracked(el, store);
  // 検証
  expect(store.load).toHaveBeenCalledTimes(1);
  expect(store.load).toHaveBeenCalledWith({ docId: DOC_ID });
  // 実行
  select(outside, 0, 3);
  await settle();
  // 検証
  expect(visibleButton()).toBeUndefined();
  // 実行
  const form = await openFormAndType(el, BODY);
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
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
  const mark = el.querySelector<HTMLElement>("mark.mdmark-comment-mark");
  expect(mark?.textContent).toBe("導入の手順");
  // 実行
  mark?.click();
  // 検証
  const bubble = document.querySelector(".mdmark-comment-bubble");
  expect(bubble?.querySelector(".mdmark-comment-body")?.textContent).toBe(BODY);
  expect(bubble?.querySelector("b")).toBeNull();
  // 実行
  handle.destroy();
  select(el.querySelector("p") as Element, 0, 3);
  await settle();
  // 検証
  expect(el.querySelector("mark")).toBeNull();
  expect(el.textContent).toBe("導入の手順を整える。");
  expect(visibleButton()).toBeUndefined();
});

// load が返したコメントの箇所に、呼んだ時点で印を付ける（正常系）
test("test_normal_when_loaded", async () => {
  // 準備
  const { el } = createHost();
  const store = createStore([comment("c1"), comment("c2", "無い文字")]);
  // 実行
  await mountCommentsTracked(el, store);
  // 検証
  expect(el.querySelector("mark.mdmark-comment-mark")?.textContent).toBe(
    "導入の手順",
  );
  const orphans = el.querySelector(".mdmark-comment-orphans");
  expect(orphans?.textContent).toContain("無い文字");
  expect(el.querySelectorAll("mark.mdmark-comment-mark")).toHaveLength(1);
});

// save が reject すると、入力欄と本文を残して知らせを出し、印を付けない（異常系）
test("test_error_when_save_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { el } = createHost();
  const store = createStore();
  store.save.mockRejectedValue(new Error("network"));
  await mountCommentsTracked(el, store);
  const form = await openFormAndType(el, BODY);
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
  expect(el.querySelector("mark")).toBeNull();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("save");
  expect(loggedText(spy)).toContain(DOC_ID);
  expect(loggedText(spy)).toContain("network");
});

// load が reject すると、印を付けずに解決し、新しいコメントは付けられる（異常系）
test("test_error_when_load_rejected", async () => {
  // 準備
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { el } = createHost();
  const store = createStore();
  store.load.mockRejectedValue(new Error("network"));
  // 実行
  await mountCommentsTracked(el, store);
  // 検証
  expect(el.querySelector("mark")).toBeNull();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("load");
  expect(loggedText(spy)).toContain(DOC_ID);
  expect(loggedText(spy)).toContain("network");
  // 実行
  const form = await openFormAndType(el, BODY);
  submit(form);
  // 検証
  await vi.waitFor(() =>
    expect(el.querySelector("mark.mdmark-comment-mark")).not.toBeNull(),
  );
  expect(store.save).toHaveBeenCalledTimes(1);
});

// store が save を持たないときと docId が空のときに、el を書き換えずに TypeError を投げる（異常系）
test("test_error_when_arguments_invalid", async () => {
  // 準備
  const { mountComments } = await loadBuilt();
  const { el } = createHost();
  const before = el.innerHTML;
  const loadOnly = { load: vi.fn(async () => []) };
  const store = createStore();
  // 実行・検証
  expect(() =>
    mountComments(el, { store: loadOnly as never, docId: DOC_ID }),
  ).toThrow(TypeError);
  expect(() =>
    mountComments(el, { store: loadOnly as never, docId: DOC_ID }),
  ).toThrow("store");
  expect(() => mountComments(el, { store, docId: "" })).toThrow(TypeError);
  expect(() => mountComments(el, { store, docId: "" })).toThrow("docId");
  expect(loadOnly.load).not.toHaveBeenCalled();
  expect(store.load).not.toHaveBeenCalled();
  expect(el.innerHTML).toBe(before);
});

// コメントの部品のモジュールを読めないと、el を書き換えずに reject する（異常系）
test("test_error_when_module_unavailable", async () => {
  // 準備
  await loadStylesheet();
  const blocked: Built = await import(
    /* @vite-ignore */ blockedDistUrl("index.js")
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { el } = createHost();
  const before = el.innerHTML;
  const store = createStore();
  // 実行
  const mounting = blocked.mountComments(el, { store, docId: DOC_ID });
  // 検証
  await expect(mounting).rejects.toBeDefined();
  expect(store.load).not.toHaveBeenCalled();
  expect(el.innerHTML).toBe(before);
  // 実行
  select(el.querySelector("p") as Element, 0, 5);
  await settle();
  // 検証
  expect(visibleButton()).toBeUndefined();
});
