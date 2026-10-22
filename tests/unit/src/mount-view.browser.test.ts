import { afterEach, expect, test, vi } from "vitest";
import type { MountHandle } from "../../../src/mount.ts";
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
  const { partModules, partModuleUrls } = await loadPartModules();
  partModules.clear();
  partModuleUrls.clear();
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
  const { partModules, partModuleUrls, setPartModuleUrl } =
    await loadPartModules();
  partModules.clear();
  partModuleUrls.clear();
  moduleUrl = URL.createObjectURL(
    new Blob([VIEW_MODULE_CODE], { type: "text/javascript" }),
  );
  setPartModuleUrl("view", moduleUrl);
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
