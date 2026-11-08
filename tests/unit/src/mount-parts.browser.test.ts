import { afterEach, expect, test, vi } from "vitest";
import { loadSource } from "../helpers/lazy.ts";

/** 公開関数と部品を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMountParts = () =>
  loadSource(
    import.meta.glob<typeof import("../../../src/mount-parts.ts")>(
      "../../../src/mount-parts.ts",
    ),
  );

/** 部品のモジュールを読み込む処理を読み込む */
const loadPartModules = () =>
  loadSource(
    import.meta.glob<typeof import("../../../src/part-modules.ts")>(
      "../../../src/part-modules.ts",
    ),
  );

/** 代役の部品のモジュールが呼ばれたことを記録する場所 */
type Recorder = {
  imports: string[];
  drawView: Array<{ el: unknown; opts: unknown }>;
  drawViewDetached: number;
  attachView: unknown[];
  attachViewDetached: number;
  attachComments: unknown[];
  attachCommentsDetached: number;
  reload: number;
  focus: string[];
  gate?: Promise<void>;
  commentsGate?: Promise<void>;
};

/** 代役の部品のモジュールが書き込む記録の配置し場（グローバル） */
declare global {
  var __mdmarkPartTest: Recorder | undefined;
}

/** ビューの代役のモジュールのコード */
const VIEW_MODULE_CODE = `
const rec = globalThis.__mdmarkPartTest;
rec.imports.push("view");
await rec.gate;
export function drawView(el, opts) {
  rec.drawView.push({ el, opts });
  return () => { rec.drawViewDetached += 1; };
}
export function attachView(view) {
  rec.attachView.push(view);
  return () => { rec.attachViewDetached += 1; };
}
`;

/** コメントの代役のモジュールのコード */
const COMMENTS_MODULE_CODE = `
const rec = globalThis.__mdmarkPartTest;
rec.imports.push("comments");
export async function attachComments(options) {
  rec.attachComments.push(options);
  await rec.commentsGate;
  return {
    detach: () => { rec.attachCommentsDetached += 1; },
    reload: async () => { rec.reload += 1; },
    focus: (id) => { rec.focus.push(id); },
  };
}
`;

const hosts: HTMLElement[] = [];
const blobUrls: string[] = [];

/** 記録を空にして、部品のモジュールの読み込み済みと URL の差し替えを空にする */
async function resetParts(): Promise<Recorder> {
  const recorder: Recorder = {
    imports: [],
    drawView: [],
    drawViewDetached: 0,
    attachView: [],
    attachViewDetached: 0,
    attachComments: [],
    attachCommentsDetached: 0,
    reload: 0,
    focus: [],
  };
  globalThis.__mdmarkPartTest = recorder;
  const { partModules, partModuleLoaders } = await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  return recorder;
}

/** コードを持つモジュールの URL を作る */
function moduleUrl(code: string): string {
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  blobUrls.push(url);
  return url;
}

/** 部品のモジュールを代役のモジュールに差し替える */
async function useFakeModule(name: "view" | "comments"): Promise<string> {
  const { setPartModuleLoader } = await loadPartModules();
  const url = moduleUrl(
    name === "view" ? VIEW_MODULE_CODE : COMMENTS_MODULE_CODE,
  );
  setPartModuleLoader(name, () => import(/* @vite-ignore */ url));
  return url;
}

/** 読み込みが必ず失敗する URL に差し替える */
async function useBrokenModule(name: "view" | "comments"): Promise<string> {
  const { setPartModuleLoader } = await loadPartModules();
  const url = URL.createObjectURL(
    new Blob(["export {};"], { type: "text/javascript" }),
  );
  URL.revokeObjectURL(url);
  setPartModuleLoader(name, () => import(/* @vite-ignore */ url));
  return url;
}

/** HTML を入れた要素をページに配置する */
function createHost(html = ""): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  hosts.push(host);
  return host;
}

/** 少し待つ（読み込みが起きないことを確認する前に、非同期の処理が動き終わるのを待つ） */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

/** `console.error` に出た引数を 1 つの文字にする */
function loggedText(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls
    .flat()
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ");
}

/** ビューのマーカーの囲みを 2 つ持つ HTML */
const TWO_VIEWS =
  '<div class="mdmark-view"></div><div class="mdmark-view"></div>';

/** 描く対象の項目 */
const VIEW_OPTIONS = {
  columns: ["タイトル", "状態"],
  items: [{ タイトル: "配色を修正する", 状態: "未着手" }],
  group: "状態",
};

afterEach(() => {
  for (const host of hosts.splice(0)) {
    host.remove();
  }
  for (const url of blobUrls.splice(0)) {
    URL.revokeObjectURL(url);
  }
  globalThis.__mdmarkPartTest = undefined;
  vi.restoreAllMocks();
});

// モジュールの drawView を呼んで destroy を返却する（正常系）
test("test_mount_view", async () => {
  // 準備
  const { mountView } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("view");
  const el = createHost();
  // 実行
  const handle = await mountView(el, VIEW_OPTIONS);
  handle.destroy();
  handle.destroy();
  // 検証
  expect(recorder.drawView).toHaveLength(1);
  expect(recorder.drawView[0]?.el).toBe(el);
  expect(recorder.drawView[0]?.opts).toBe(VIEW_OPTIONS);
  expect(recorder.drawViewDetached).toBe(1);
});

// 引数が合わないと同期で投げ、モジュールを読み込まない（異常系）
test("test_mount_view_when_invalid", async () => {
  // 準備
  const { mountView } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("view");
  const el = createHost("前の中身");
  // 実行・検証
  expect(() => mountView(el, { ...VIEW_OPTIONS, group: "優先度" })).toThrow(
    TypeError,
  );
  await settle();
  expect(recorder.imports).toEqual([]);
  expect(el.innerHTML).toBe("前の中身");
});

// 読み込めないと通知ブロックを配置して reject する（異常系）
test("test_mount_view_when_module_unavailable", async () => {
  // 準備
  const { mountView } = await loadMountParts();
  await resetParts();
  const url = await useBrokenModule("view");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const el = createHost();
  // 実行・検証
  await expect(mountView(el, VIEW_OPTIONS)).rejects.toBeDefined();
  expect(
    el.querySelector(".mdmark .mdmark-notice .mdmark-notice-title")
      ?.textContent,
  ).toBe("この箇所を表示できません");
  expect(loggedText(spy)).toContain("view");
  expect(loggedText(spy)).toContain(url);
});

// モジュールの attachComments を呼んで destroy を返却する（正常系）
test("test_mount_comments", async () => {
  // 準備
  const { mountComments } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("comments");
  const el = createHost();
  const store = { load: vi.fn(async () => []), save: vi.fn() };
  // 実行
  const handle = await mountComments(el, { store, docId: "panel-setup" });
  handle.destroy();
  handle.destroy();
  // 検証
  expect(recorder.attachComments).toHaveLength(1);
  expect(recorder.attachComments[0]).toEqual({
    root: el,
    store,
    docId: "panel-setup",
  });
  expect(recorder.attachCommentsDetached).toBe(1);
});

// 読み込みと保存の関数が無いと同期で投げる（異常系）
test("test_mount_comments_when_invalid", async () => {
  // 準備
  const { mountComments } = await loadMountParts();
  await resetParts();
  const el = createHost();
  const store = { load: vi.fn(async () => []) };
  // 実行・検証
  expect(() =>
    mountComments(el, { store: store as never, docId: "panel-setup" }),
  ).toThrow(TypeError);
  expect(() =>
    mountComments(el, { store: store as never, docId: "panel-setup" }),
  ).toThrow("opts.store");
});

// 読み込めないと el を書き換えずに reject する（異常系）
test("test_mount_comments_when_module_unavailable", async () => {
  // 準備
  const { mountComments } = await loadMountParts();
  await resetParts();
  await useBrokenModule("comments");
  const el = createHost("前の中身");
  const store = { load: vi.fn(async () => []), save: vi.fn() };
  // 実行・検証
  await expect(
    mountComments(el, { store, docId: "panel-setup" }),
  ).rejects.toBeDefined();
  expect(el.innerHTML).toBe("前の中身");
  expect(store.load).not.toHaveBeenCalled();
});

// ビューのマーカーごとに attachView を呼ぶ（正常系）
test("test_attach_parts", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("view");
  const root = createHost(TWO_VIEWS);
  // 実行
  const { detach } = attachParts({
    root,
    features: { views: true },
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  await vi.waitFor(() => expect(recorder.attachView).toHaveLength(2));
  detach();
  // 検証
  expect(recorder.attachView).toEqual([
    ...root.querySelectorAll(".mdmark-view"),
  ]);
  expect(recorder.attachViewDetached).toBe(2);
});

// マーカーも機能も無ければモジュールを読み込まない（正常系）
test("test_attach_parts_when_no_marks", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("view");
  await useFakeModule("comments");
  const root = createHost("<p>マーカーの無い文書</p>");
  // 実行
  attachParts({
    root,
    features: { views: true, comments: false },
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  await settle();
  // 検証
  expect(recorder.imports).toEqual([]);
});

// comments がオンでも読み込みと保存の関数が無ければ読み込まず、console.error に 1 回だけ出す（正常系）
test("test_attach_parts_when_comments_without_store", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("comments");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createHost("<p>文書</p>");
  const warned = { missingStore: false };
  const options = {
    root,
    features: { comments: true },
    isCurrent: () => true,
    warned,
  };
  // 実行
  attachParts(options);
  attachParts(options);
  await settle();
  // 検証
  expect(recorder.imports).toEqual([]);
  expect(spy).toHaveBeenCalledTimes(1);
});

// 読み込みを待つ間に削除すると付けない（正常系）
test("test_attach_parts_when_detached_while_loading", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  let release: () => void = () => {};
  recorder.gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await useFakeModule("view");
  const root = createHost(TWO_VIEWS);
  // 実行
  const { detach } = attachParts({
    root,
    features: { views: true },
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  detach();
  release();
  await settle();
  // 検証
  expect(recorder.attachView).toEqual([]);
});

// 読み込めないと表を残して console.error に 1 回出す（異常系）
test("test_attach_parts_when_module_unavailable", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  await resetParts();
  const url = await useBrokenModule("view");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createHost(TWO_VIEWS);
  const before = root.innerHTML;
  // 実行
  attachParts({
    root,
    features: { views: true },
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  await vi.waitFor(() => expect(spy).toHaveBeenCalled());
  await settle();
  // 検証
  expect(root.innerHTML).toBe(before);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(loggedText(spy)).toContain("view");
  expect(loggedText(spy)).toContain(url);
});

// root の中に mountView・mountComments で付けた部品も削除する関数で片付け、root の外の部品は片付けない（正常系）
test("test_attach_parts_when_parts_mounted_inside", async () => {
  // 準備
  const { attachParts, mountView, mountComments } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("view");
  await useFakeModule("comments");
  const root = createHost("<div></div><div></div>");
  const outside = createHost();
  const [viewHost, commentsHost] = [...root.querySelectorAll("div")];
  const store = { load: vi.fn(async () => []), save: vi.fn() };
  await mountView(viewHost as HTMLElement, VIEW_OPTIONS);
  await mountComments(commentsHost as HTMLElement, {
    store,
    docId: "panel-setup",
  });
  await mountView(outside, VIEW_OPTIONS);
  const { detach } = attachParts({
    root,
    features: {},
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  // 実行
  detach();
  // 検証
  expect(recorder.attachCommentsDetached).toBe(1);
  expect(recorder.drawViewDetached).toBe(1);
});

/** 部品を開閉する処理を読み込む（`reveal` に指定する関数を比べる） */
const loadSections = () => import("../../../src/interact/sections.ts");

/** コメントの読み込みと保存の関数 */
function createStore() {
  return { load: vi.fn(async () => []), save: vi.fn() };
}

// reloadComments と focusComment を付けたコメントに任せる（正常系）
test("test_attach_parts_when_comments_reloaded", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const { openEnclosing } = await loadSections();
  const recorder = await resetParts();
  await useFakeModule("comments");
  const root = createHost("<p>文書</p>");
  const handle = attachParts({
    root,
    features: { comments: true },
    commentStore: createStore(),
    docId: "panel-setup",
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  // 実行
  await handle.reloadComments();
  handle.focusComment("c1");
  // 検証
  expect(recorder.attachComments).toHaveLength(1);
  expect(
    (recorder.attachComments[0] as { reveal?: unknown } | undefined)?.reveal,
  ).toBe(openEnclosing);
  expect(recorder.reload).toBe(1);
  expect(recorder.focus).toEqual(["c1"]);
  handle.detach();
});

// コメントを付けていないとき・読み込めないときは load を呼ばずに解決する（正常系）
test("test_attach_parts_when_comments_reload_disabled", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  await useFakeModule("comments");
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const off = attachParts({
    root: createHost("<p>文書</p>"),
    features: { comments: false },
    commentStore: createStore(),
    docId: "panel-setup",
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  // 実行・検証: コメントの機能がオフ
  await expect(off.reloadComments()).resolves.toBeUndefined();
  expect(recorder.imports).toEqual([]);
  off.detach();
  // 準備: 読み込めないモジュール
  await resetParts();
  await useBrokenModule("comments");
  const broken = attachParts({
    root: createHost("<p>文書</p>"),
    features: { comments: true },
    commentStore: createStore(),
    docId: "panel-setup",
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  // 実行・検証
  await expect(broken.reloadComments()).resolves.toBeUndefined();
  expect(spy).toHaveBeenCalled();
  broken.detach();
});

// 削除した後の reloadComments は reload を呼ばずに解決する（正常系）
test("test_attach_parts_when_comments_reload_after_detach", async () => {
  // 準備
  const { attachParts } = await loadMountParts();
  const recorder = await resetParts();
  let release: () => void = () => {};
  recorder.commentsGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await useFakeModule("comments");
  const handle = attachParts({
    root: createHost("<p>文書</p>"),
    features: { comments: true },
    commentStore: createStore(),
    docId: "panel-setup",
    isCurrent: () => true,
    warned: { missingStore: false },
  });
  await vi.waitFor(() => expect(recorder.attachComments).toHaveLength(1));
  // 実行: attachComments の解決の前に削除し、その後に再読み込みする
  handle.detach();
  release();
  // 検証
  await expect(handle.reloadComments()).resolves.toBeUndefined();
  expect(recorder.reload).toBe(0);
  expect(recorder.attachCommentsDetached).toBe(1);
});
