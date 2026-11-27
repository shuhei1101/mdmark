import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { memoryStorage, throwingStorage } from "../../helpers/storage.ts";

/** リサイズハンドルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadResize = () =>
  import("../../../../src/diagram/diagram-resize.interact.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 高さを保つキー */
const KEY = "mdmark-diagram-height:/a.html#0:図";

/** 高さ 300px の表示する枠とリサイズハンドルを配置し、リサイズハンドルを付ける */
async function setUp(storage: Storage | null, fit = 1000) {
  const { attachDiagramResize } = await loadResize();
  const root = createRootFromHtml(
    '<div class="viewport" style="height: 300px; overflow: auto"></div><div class="handle" role="separator" tabindex="0"></div>',
  );
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const handle = root.querySelector<HTMLElement>(".handle");
  if (!viewport || !handle) {
    throw new Error("表示する枠かリサイズハンドルが無い");
  }
  const resized: Array<number | null> = [];
  const result = attachDiagramResize({
    viewport,
    handle,
    key: KEY,
    storage,
    fit: () => fit,
    onResize: (height) => {
      resized.push(height);
    },
  });
  detachers.push(result.detach);
  return { viewport, handle, resized, result };
}

/** リサイズハンドルを `dy` px だけ縦にドラッグする */
function drag(handle: HTMLElement, dy: number): void {
  const point = { bubbles: true, pointerId: 1, button: 0, clientX: 10 };
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientY: 100 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientY: 100 + dy }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientY: 100 + dy }),
  );
}

// ドラッグと上下キーで高さを変えて保つ（正常系）
test("test_attach_diagram_resize", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const storage = memoryStorage();
  const { viewport, handle, resized } = await setUp(storage);
  // 実行: 200px 下へドラッグする
  drag(handle, 200);
  // 検証
  expect(viewport.style.height).toBe("500px");
  expect(handle.getAttribute("aria-valuenow")).toBe("500");
  // 実行: ↑ を押す
  handle.focus();
  await userEvent.keyboard("{ArrowUp}");
  // 検証
  expect(viewport.style.height).toBe("468px");
  expect(handle.getAttribute("aria-valuenow")).toBe("468");
  expect(storage.getItem(KEY)).toBe("468");
  expect(resized).toEqual([500, 468]);
});

// ダブルクリックで今の倍率の図の全体が収まる高さにする（正常系）
test("test_attach_diagram_resize_when_fit", async () => {
  // 準備
  const storage = memoryStorage();
  const { viewport, handle, resized } = await setUp(storage, 760);
  // 実行
  handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  // 検証
  expect(viewport.style.height).toBe("760px");
  expect(storage.getItem(KEY)).toBe("760");
  expect(resized.at(-1)).toBe(760);
});

// 保った高さで開き、読み込めない値は使用しない（正常系）
test("test_attach_diagram_resize_when_restored", async () => {
  // 準備・実行
  const kept = await setUp(memoryStorage({ [KEY]: "420" }));
  // 検証
  expect(kept.result.restored).toBe(420);
  expect(kept.viewport.style.height).toBe("420px");
  // 準備・実行
  removeRoots();
  const broken = await setUp(memoryStorage({ [KEY]: "abc" }));
  // 検証
  expect(broken.result.restored).toBeNull();
  expect(broken.viewport.style.height).toBe("300px");
  // 準備・実行: 保った高さが図の全体の収まる高さ（1000px）を超える
  removeRoots();
  const tall = await setUp(memoryStorage({ [KEY]: "1500" }));
  // 検証: 上限を持たないため、保った高さのまま当て、最大値も今の高さにする
  expect(tall.result.restored).toBe(1500);
  expect(tall.viewport.style.height).toBe("1500px");
  expect(tall.handle.getAttribute("aria-valuenow")).toBe("1500");
  expect(tall.handle.getAttribute("aria-valuemax")).toBe("1500");
});

// 保つ先が例外を投げても高さを変える（異常系）
test("test_attach_diagram_resize_when_storage_throws", async () => {
  // 準備
  const { viewport, handle } = await setUp(throwingStorage());
  // 実行
  handle.focus();
  await userEvent.keyboard("{ArrowDown}");
  // 検証
  expect(viewport.style.height).toBe("332px");
});

// ページ・順・題名でキーを作る（正常系）
test("test_diagram_height_key", async () => {
  // 準備
  const { diagramHeightKey } = await loadResize();
  // 実行
  const key = diagramHeightKey({
    pathname: "/docs/a.html",
    index: 1,
    title: "問い合わせの流れ",
  });
  // 検証
  expect(key).toBe("mdmark-diagram-height:/docs/a.html#1:問い合わせの流れ");
});

/** 開いている大きさのメニューを返却する（無ければ null） */
function sizeMenu(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".mdmark-step-menu");
}

/** 開いている大きさのメニューの、文言が `label` のボタンを返却する（無ければ例外） */
function sizeItem(label: string): HTMLButtonElement {
  const found = [
    ...(sizeMenu()?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ].find((item) => item.textContent?.trim() === label);
  if (!found) {
    throw new Error(`メニューの項目が無い: ${label}`);
  }
  return found;
}

// 動かさずに押すと大きさのメニューを開き、ボタンで高さを変える（正常系）
test("test_attach_diagram_resize_when_menu", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { handle } = await setUp(memoryStorage(), 760);
  // 実行
  drag(handle, 2);
  // 検証
  expect(sizeMenu()?.getAttribute("role")).toBe("group");
  const before = Number(handle.getAttribute("aria-valuenow"));
  // 実行: 高くする
  sizeItem("高くする").click();
  // 検証
  expect(Number(handle.getAttribute("aria-valuenow"))).toBe(before + 32);
  // 実行: 全体が収まる高さにする
  sizeItem("全体が収まる高さにする").click();
  // 検証: ダブルクリックと同じ高さで、これ以上高くできない
  expect(handle.getAttribute("aria-valuenow")).toBe("760");
  expect(sizeItem("高くする").disabled).toBe(true);
  expect(sizeItem("全体が収まる高さにする").disabled).toBe(true);
});

// Enter でも開き、Esc でハンドルへ戻る。ドラッグでは開かない（正常系）
test("test_attach_diagram_resize_when_menu_by_key", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { viewport, handle } = await setUp(memoryStorage());
  handle.focus();
  // 実行
  await userEvent.keyboard("{Enter}");
  // 検証
  expect(sizeMenu()).not.toBeNull();
  // 実行
  await userEvent.keyboard("{Escape}");
  // 検証
  expect(sizeMenu()).toBeNull();
  expect(document.activeElement).toBe(handle);
  // 実行: 5px のドラッグ
  drag(handle, 5);
  // 検証
  expect(sizeMenu()).toBeNull();
  expect(viewport.style.height).toBe("305px");
});
