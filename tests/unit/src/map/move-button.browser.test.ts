import { afterEach, expect, test, vi } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";

/** 移動のボタンを読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadMoveButton = (): Promise<
  typeof import("../../../../src/map/move-button.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/map/move-button.ts",
      import.meta.url,
    ).href
  );

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 画面の左上に表示する枠を置き、`(40, 40, 120, 48)` の要素と、`panel` の位置のパネルを配置する */
function setUpViewport(panel: { x: number; y: number; w: number; h: number }) {
  addStyles();
  const root = createRootFromHtml(
    `<div class="viewport" style="position: fixed; left: 0; top: 0; width: 600px; height: 400px; overflow: auto"><div class="stage" style="position: relative; width: 600px; height: 400px"><div class="item" style="position: absolute; left: 40px; top: 40px; width: 120px; height: 48px"></div><div class="empty" style="position: absolute; left: 400px; top: 300px; width: 40px; height: 40px"></div></div><div class="panel" style="position: absolute; left: ${panel.x}px; top: ${panel.y}px; width: ${panel.w}px; height: ${panel.h}px"></div></div>`,
  );
  const query = (selector: string) =>
    root.querySelector<HTMLElement>(selector) as HTMLElement;
  return {
    viewport: query(".viewport"),
    item: query(".item"),
    empty: query(".empty"),
    panel: query(".panel"),
  };
}

/** 要素の左上の近くを押し、`dx` px だけ右へ動かして離す */
function pressAndRelease(element: Element, dx: number): void {
  const box = element.getBoundingClientRect();
  const point = (offset: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + 10 + offset,
    clientY: box.y + 10,
  });
  element.dispatchEvent(new PointerEvent("pointerdown", point(0)));
  element.dispatchEvent(new PointerEvent("pointermove", point(dx)));
  element.dispatchEvent(new PointerEvent("pointerup", point(dx)));
}

/** 表示する枠の中の移動のボタン（無ければ例外） */
function moveButton(viewport: HTMLElement): HTMLButtonElement {
  const found = viewport.querySelector<HTMLButtonElement>("button.map-move");
  if (!found) {
    throw new Error("移動のボタンが無い");
  }
  return found;
}

/** 2 つの矩形が重なるか */
function overlaps(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

/** 要素 `item` を名前 `注文を受ける` で返す pointedOf */
function pointedOfItem(item: HTMLElement) {
  return vi.fn((target: Element) =>
    item.contains(target)
      ? {
          element: item,
          name: "注文を受ける",
          items: [
            {
              label: "下へ移す",
              icon: "arrow-down" as never,
              enabled: () => true,
              run: () => {},
            },
          ],
        }
      : undefined,
  );
}

// 動かさずに押した要素の右上にボタンを出す（正常系）
test("test_attach_move_button", async () => {
  // 準備
  const { attachMoveButton } = await loadMoveButton();
  const { viewport, item, panel } = setUpViewport({
    x: 520,
    y: 8,
    w: 72,
    h: 32,
  });
  const result = attachMoveButton({
    viewport,
    panel: () => panel,
    pointedOf: pointedOfItem(item),
  });
  detachers.push(result.detach);
  // 実行
  pressAndRelease(item, 2);
  // 検証
  await vi.waitFor(() => {
    expect(moveButton(viewport).hidden).toBe(false);
  });
  const button = moveButton(viewport).getBoundingClientRect();
  const box = item.getBoundingClientRect();
  expect(button.right).toBeLessThanOrEqual(box.right);
  expect(button.top).toBeGreaterThanOrEqual(box.top);
  expect(button.left).toBeGreaterThan(box.left + box.width / 2);
  expect(moveButton(viewport).getAttribute("aria-label")).toBe(
    "「注文を受ける」を移動",
  );
});

// ドラッグしたときは出さない（正常系）
test("test_attach_move_button_when_dragged", async () => {
  // 準備
  const { attachMoveButton } = await loadMoveButton();
  const { viewport, item, panel } = setUpViewport({
    x: 520,
    y: 8,
    w: 72,
    h: 32,
  });
  const pointedOf = pointedOfItem(item);
  const result = attachMoveButton({ viewport, panel: () => panel, pointedOf });
  detachers.push(result.detach);
  // 実行
  pressAndRelease(item, 4);
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  // 検証
  const button = viewport.querySelector<HTMLButtonElement>("button.map-move");
  expect(button?.hidden ?? true).toBe(true);
  expect(pointedOf).not.toHaveBeenCalled();
});

// パネルと重なるときは左上に置く（正常系）
test("test_attach_move_button_when_near_panel", async () => {
  // 準備: 要素の右上の角 (160, 40) がパネルに入る
  const { attachMoveButton } = await loadMoveButton();
  const { viewport, item, panel } = setUpViewport({
    x: 130,
    y: 20,
    w: 80,
    h: 40,
  });
  const result = attachMoveButton({
    viewport,
    panel: () => panel,
    pointedOf: pointedOfItem(item),
  });
  detachers.push(result.detach);
  // 実行
  pressAndRelease(item, 0);
  // 検証
  await vi.waitFor(() => {
    expect(moveButton(viewport).hidden).toBe(false);
  });
  const button = moveButton(viewport).getBoundingClientRect();
  const box = item.getBoundingClientRect();
  expect(button.left).toBeGreaterThanOrEqual(box.left);
  expect(button.top).toBeGreaterThanOrEqual(box.top);
  expect(button.right).toBeLessThan(box.left + box.width / 2);
  expect(overlaps(button, panel.getBoundingClientRect())).toBe(false);
});

// 空いた場所を押すとボタンを隠しメニューを閉じる（正常系）
test("test_attach_move_button_when_hidden", async () => {
  // 準備
  const { attachMoveButton } = await loadMoveButton();
  const { viewport, item, empty, panel } = setUpViewport({
    x: 520,
    y: 8,
    w: 72,
    h: 32,
  });
  const result = attachMoveButton({
    viewport,
    panel: () => panel,
    pointedOf: pointedOfItem(item),
  });
  detachers.push(result.detach);
  pressAndRelease(item, 0);
  await vi.waitFor(() => {
    expect(moveButton(viewport).hidden).toBe(false);
  });
  moveButton(viewport).click();
  expect(document.querySelector(".mdmark-step-menu")).not.toBeNull();
  // 実行
  pressAndRelease(empty, 0);
  // 検証
  await vi.waitFor(() => {
    expect(moveButton(viewport).hidden).toBe(true);
  });
  expect(document.querySelector(".mdmark-step-menu")).toBeNull();
});

// Esc やメニューの外の押下で閉じた後も、ボタンを押すとメニューを開く（正常系）
test("test_attach_move_button_when_reopened", async () => {
  // 準備
  const { userEvent } = await import("vitest/browser");
  const { attachMoveButton } = await loadMoveButton();
  const { viewport, item, panel } = setUpViewport({
    x: 520,
    y: 8,
    w: 72,
    h: 32,
  });
  const result = attachMoveButton({
    viewport,
    panel: () => panel,
    pointedOf: pointedOfItem(item),
  });
  detachers.push(result.detach);
  pressAndRelease(item, 0);
  await vi.waitFor(() => {
    expect(moveButton(viewport).hidden).toBe(false);
  });
  moveButton(viewport).click();
  // 実行: Esc で閉じてから押す
  await userEvent.keyboard("{Escape}");
  moveButton(viewport).click();
  // 検証
  expect(document.querySelector(".mdmark-step-menu")).not.toBeNull();
  // 実行: 図の外の要素を押して閉じてから押す
  const outside = createRootFromHtml(
    '<button type="button" style="position: fixed; left: 0; bottom: 0; width: 40px; height: 40px">外</button>',
  ).querySelector("button") as HTMLButtonElement;
  await userEvent.click(outside);
  expect(document.querySelector(".mdmark-step-menu")).toBeNull();
  moveButton(viewport).click();
  // 検証
  expect(document.querySelector(".mdmark-step-menu")).not.toBeNull();
});
