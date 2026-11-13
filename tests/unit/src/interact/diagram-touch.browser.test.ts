import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 指で図を動かす操作中の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTouch = () => import("../../../../src/interact/diagram-touch.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** 表示するノードと表示する枠（中にノード 1 つ）と、外の段落を配置して付ける */
async function setUp() {
  const { attachDiagramTouch } = await loadTouch();
  const root = createRootFromHtml(
    '<div class="mdmark-diagram-box"><div class="mdmark-diagram-viewport" style="width: 300px; height: 200px"><div class="mdmark-diagram-stage" style="width: 600px; height: 400px; position: relative"><div class="mdmark-diagram-node" style="position: absolute; left: 0; top: 0; width: 80px; height: 40px">A</div></div></div></div><p class="outside">段落</p>',
  );
  const box = root.querySelector<HTMLElement>(".mdmark-diagram-box");
  const viewport = root.querySelector<HTMLElement>(".mdmark-diagram-viewport");
  const node = root.querySelector<HTMLElement>(".mdmark-diagram-node");
  const outside = root.querySelector<HTMLElement>(".outside");
  if (!box || !viewport || !node || !outside) {
    throw new Error("表示するノード・表示する枠・ノード・段落のどれかが無い");
  }
  detachers.push(attachDiagramTouch({ box, viewport }));
  return { box, viewport, node, outside };
}

/** 要素の上で押して離す（`dx` だけ動かしてから離す） */
function tap(target: Element, pointerType: string, dx = 0) {
  const rect = target.getBoundingClientRect();
  const base = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType,
    clientY: rect.y + 10,
  };
  target.dispatchEvent(
    new PointerEvent("pointerdown", { ...base, clientX: rect.x + 150 }),
  );
  target.dispatchEvent(
    new PointerEvent("pointerup", { ...base, clientX: rect.x + 150 + dx }),
  );
}

// 余白のタップで操作中にし、外のタップで解く（正常系）
test("test_attach_diagram_touch", async () => {
  // 準備
  const { box, viewport, outside } = await setUp();
  // 実行
  tap(viewport, "touch");
  const active = box.hasAttribute("data-touch-active");
  outside.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
  );
  // 検証
  expect(active).toBe(true);
  expect(box.hasAttribute("data-touch-active")).toBe(false);
});

// ノードの上のタップとドラッグと mouse では操作中にしない（正常系）
test("test_attach_diagram_touch_when_node", async () => {
  // 準備
  const { box, viewport, node } = await setUp();
  // 実行と検証
  const rect = node.getBoundingClientRect();
  const base = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType: "touch",
    clientX: rect.x + 10,
    clientY: rect.y + 10,
  };
  node.dispatchEvent(new PointerEvent("pointerdown", base));
  node.dispatchEvent(new PointerEvent("pointerup", base));
  expect(box.hasAttribute("data-touch-active")).toBe(false);
  tap(viewport, "touch", 20);
  expect(box.hasAttribute("data-touch-active")).toBe(false);
  tap(viewport, "mouse");
  expect(box.hasAttribute("data-touch-active")).toBe(false);
});

// 削除すると操作中を外し、タップに反応しない（正常系）
test("test_attach_diagram_touch_when_detached", async () => {
  // 準備
  const { box, viewport } = await setUp();
  tap(viewport, "touch");
  // 実行
  for (const detach of detachers.splice(0)) {
    detach();
  }
  const afterDetach = box.hasAttribute("data-touch-active");
  tap(viewport, "touch");
  // 検証
  expect(afterDetach).toBe(false);
  expect(box.hasAttribute("data-touch-active")).toBe(false);
});
