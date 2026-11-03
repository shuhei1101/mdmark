import { afterEach, expect, test, vi } from "vitest";
import type { MountHandle } from "../../../src/mount.ts";
import { addStyles } from "../helpers/dom.ts";
import { loadSource } from "../helpers/lazy.ts";

/** 描く処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMount = () => import("../../../src/mount.ts");

/** 部品のモジュールを読む処理を読み込む */
const loadPartModules = () =>
  loadSource(
    import.meta.glob<typeof import("../../../src/part-modules.ts")>(
      "../../../src/part-modules.ts",
    ),
  );

/** 代役のビューの部品のモジュールが呼ばれたことを控える場所 */
type Recorder = { attached: Element[]; detached: number };

/** 代役のモジュールが書き込む控えの置き場（グローバル） */
declare global {
  var __mdmarkMountTest: Recorder | undefined;
}

/** attachView が呼ばれた要素と外した回数を控える、ビューの代役のモジュールのコード */
const VIEW_MODULE_CODE = `
const rec = globalThis.__mdmarkMountTest;
export function drawView() { return () => {}; }
export function attachView(view) {
  rec.attached.push(view);
  return () => { rec.detached += 1; };
}
`;

/** ビューの印を持つ文書 */
const VIEW_MARKDOWN = [
  "<!-- view: group=状態 -->",
  "",
  "| 題 | 状態 |",
  "| --- | --- |",
  "| a | 未着手 |",
  "",
  "<!-- /view -->",
  "",
].join("\n");

const elements: HTMLElement[] = [];
const handles: MountHandle[] = [];
let moduleUrl: string | undefined;

afterEach(async () => {
  for (const handle of handles.splice(0)) {
    handle.destroy();
  }
  for (const el of elements.splice(0)) {
    el.remove();
  }
  const { partModules, partModuleLoaders } = await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  if (moduleUrl !== undefined) {
    URL.revokeObjectURL(moduleUrl);
    moduleUrl = undefined;
  }
  globalThis.__mdmarkMountTest = undefined;
});

// ビューの印があると部品を付け、描き直すと前の部品を外す（正常系）
test("test_mount_when_view_marked", async () => {
  // 準備
  const record: Recorder = { attached: [], detached: 0 };
  globalThis.__mdmarkMountTest = record;
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  const url = URL.createObjectURL(
    new Blob([VIEW_MODULE_CODE], { type: "text/javascript" }),
  );
  moduleUrl = url;
  setPartModuleLoader("view", () => import(/* @vite-ignore */ url));
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  const { mount } = await loadMount();
  // 実行
  const handle = mount(el, { markdown: VIEW_MARKDOWN });
  handles.push(handle);
  await vi.waitFor(() => expect(record.attached).toHaveLength(1));
  // 検証
  expect(record.attached[0]).toBe(el.querySelector("div.mdmark-view"));
  expect(record.detached).toBe(0);
  // 実行
  handle.update("印の無い文書\n");
  // 検証
  await vi.waitFor(() => expect(record.detached).toBe(1));
});

/** attachComments が受けた root を控える、コメントの代役のモジュールのコード */
const COMMENTS_MODULE_CODE = `
const rec = globalThis.__mdmarkMountTest;
export async function attachComments({ root }) {
  rec.attached.push(root);
  return {
    detach: () => { rec.detached += 1; },
    reload: async () => {},
    focus: () => {},
  };
}
`;

// 右側の目次が無くても、コメントの機能では本文を列に包む（正常系）
test("test_mount_when_comments_without_side_toc", async () => {
  // 準備
  addStyles();
  const record: Recorder = { attached: [], detached: 0 };
  globalThis.__mdmarkMountTest = record;
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  const url = URL.createObjectURL(
    new Blob([COMMENTS_MODULE_CODE], { type: "text/javascript" }),
  );
  moduleUrl = url;
  setPartModuleLoader("comments", () => import(/* @vite-ignore */ url));
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  const { mount } = await loadMount();
  // 実行
  const handle = mount(el, {
    markdown: "見出しの無い段落\n",
    config: { features: { comments: true } },
    commentStore: {
      load: async () => [],
      save: async ({ comment }) => ({ ...comment, id: "c1" }),
    },
    docId: "doc",
  });
  handles.push(handle);
  await vi.waitFor(() => expect(record.attached).toHaveLength(1));
  // 検証
  const content = el.firstElementChild as HTMLElement;
  expect(content.matches("div.mdmark-content")).toBe(true);
  expect(record.attached[0]).toBe(content);
  // 実行
  const margin = document.createElement("div");
  margin.className = "mdmark-comment-margin";
  margin.style.height = "20px";
  content.after(margin);
  // 検証
  const contentRect = content.getBoundingClientRect();
  const marginRect = margin.getBoundingClientRect();
  expect(marginRect.top).toBeCloseTo(contentRect.top, 0);
  expect(marginRect.left).toBeGreaterThan(contentRect.right);
  // 実行
  handle.destroy();
  // 検証
  expect(el.childNodes).toHaveLength(0);
});
