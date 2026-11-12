import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** ドラッグを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDrag = () => import("../../../../src/map/drag.ts");

afterEach(() => {
  removeRoots();
  vi.restoreAllMocks();
});

/** 2 つのノードと 1 本の線の配置 */
const LAYOUT = {
  width: 600,
  height: 400,
  nodes: [
    {
      id: "A",
      x: 24,
      y: 24,
      w: 120,
      h: 60,
      lines: ["A"],
      faded: false,
      ancestors: [],
    },
    {
      id: "B",
      x: 24,
      y: 160,
      w: 120,
      h: 60,
      lines: ["B"],
      faded: false,
      ancestors: [],
    },
    {
      id: "C",
      x: 300,
      y: 24,
      w: 120,
      h: 60,
      lines: ["C"],
      faded: false,
      ancestors: [],
    },
  ],
  groups: [],
  wires: [
    {
      id: "A->C",
      from: "A",
      to: "C",
      label: undefined,
      merged: undefined,
      points: [
        [144, 54],
        [200, 54],
        [200, 140],
        [360, 140],
        [360, 84],
      ] as Array<[number, number]>,
    },
  ],
};

/** 空の状態 */
const STATE = {
  collapsed: [],
  entered: undefined,
  selected: [],
  positions: {},
  wireShifts: {},
  attachments: {},
  order: undefined,
  height: undefined,
};

/** 要素をドラッグする（pointerdown → move → up） */
function drag(
  target: Element,
  dx: number,
  dy: number,
  start = { x: 50, y: 50 },
) {
  const base = { bubbles: true, pointerId: 1, button: 0 };
  const down = new PointerEvent("pointerdown", {
    ...base,
    clientX: start.x,
    clientY: start.y,
  });
  target.dispatchEvent(down);
  window.dispatchEvent(
    new PointerEvent("pointermove", {
      ...base,
      clientX: start.x + dx,
      clientY: start.y + dy,
    }),
  );
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      ...base,
      clientX: start.x + dx,
      clientY: start.y + dy,
    }),
  );
  return down;
}

/** ノードと線の要素を配置して、押したときにドラッグを始める */
async function setUp(selector: string) {
  const { startDrag } = await loadDrag();
  const root = createRootFromHtml(
    '<div data-node="A"></div><div data-node="B"></div><div data-node="C"></div><svg><path class="map-wire-hit" data-wire="A->C" data-segment="2"></path></svg>',
  );
  const moves: Array<typeof STATE> = [];
  const clicks: number[] = [];
  const target = root.querySelector(selector) as Element;
  target.addEventListener("pointerdown", (event) => {
    startDrag({
      event: event as PointerEvent,
      layout: LAYOUT,
      state: STATE,
      onMove: (state) => moves.push(state as typeof STATE),
      onClick: () => clicks.push(1),
    });
  });
  return { target, moves, clicks };
}

// 押しただけ（正常系）
test("test_start_drag_when_click", async () => {
  // 準備
  const { target, moves, clicks } = await setUp('[data-node="A"]');
  // 実行
  drag(target, 3, 0);
  // 検証
  expect(clicks).toHaveLength(1);
  expect(moves).toHaveLength(0);
});

// ノードを動かす（正常系）
test("test_start_drag_when_node", async () => {
  // 準備
  const { target, moves } = await setUp('[data-node="A"]');
  // 実行
  drag(target, 0, 40);
  // 検証: 位置は親の中身の左上（最上位は図の余白の内側 24, 24）からの座標
  const last = moves.at(-1) as unknown as {
    positions: Record<string, { x: number; y: number }>;
  };
  expect(last.positions.A).toEqual({ x: 0, y: 40 });
  expect(last.positions.C).toEqual({ x: 276, y: 0 });
});

// 近づけすぎ（正常系）
test("test_start_drag_when_blocked", async () => {
  // 準備
  const { target, moves } = await setUp('[data-node="A"]');
  // 実行: B の上端（160）との間が 10px になる位置（A の下端 150）まで動かす
  drag(target, 0, 66);
  // 検証: 間が 16px の位置（A の図の y が 84。親の中身からは 60）で止まる
  const last = moves.at(-1) as unknown as {
    positions: Record<string, { x: number; y: number }>;
  };
  expect(last.positions.A?.y).toBe(60);
});

// つなぎ替え（正常系）
test("test_start_drag_when_reattach", async () => {
  // 準備
  const { target, moves } = await setUp(".map-wire-hit");
  // 実行: C の下を通る真ん中の区間（y が 140）を、C の上（y が 24 より上）まで動かす
  drag(target, 0, -150, { x: 280, y: 140 });
  // 検証
  const last = moves.at(-1) as unknown as {
    wireShifts: Record<string, Array<{ segment: number; offset: number }>>;
    attachments?: Record<string, { to: string }>;
  };
  expect(last.wireShifts["A->C"]?.[0]).toMatchObject({
    segment: 2,
    offset: -150,
  });
  expect(last.attachments?.["A->C"]?.to).toBe("top");
});

// ノード（正常系）
test("test_move_by_key_when_node", async () => {
  // 準備
  const { moveByKey } = await loadDrag();
  // 実行
  const next = moveByKey({
    layout: LAYOUT,
    state: STATE,
    target: { node: "A" },
    dx: 0,
    dy: 8,
  });
  // 検証
  expect(next?.positions.A).toEqual({ x: 0, y: 8 });
});

// 線の真ん中の区間（正常系）
test("test_move_by_key_when_wire", async () => {
  // 準備
  const { moveByKey } = await loadDrag();
  // 実行
  const next = moveByKey({
    layout: LAYOUT,
    state: STATE,
    target: { wire: "A->C" },
    dx: 8,
    dy: 0,
  });
  // 検証
  expect(next?.wireShifts["A->C"]?.[0]).toMatchObject({
    segment: 1,
    offset: 8,
  });
});

// 動かせない（正常系）
test("test_move_by_key_when_blocked", async () => {
  // 準備
  const { moveByKey } = await loadDrag();
  // 実行・検証
  expect(
    moveByKey({
      layout: LAYOUT,
      state: STATE,
      target: { node: "A" },
      dx: 0,
      dy: -8,
    }),
  ).toBeUndefined();
  expect(
    moveByKey({
      layout: LAYOUT,
      state: STATE,
      target: { wire: "A->C" },
      dx: 0,
      dy: 8,
    }),
  ).toBeUndefined();
});

// pointercancel で動かした分を戻し、その後の移動で動かさない（正常系）
test("test_start_drag_when_cancelled", async () => {
  // 準備
  const { target, moves, clicks } = await setUp('[data-node="A"]');
  const base = { bubbles: true, pointerId: 1, button: 0, pointerType: "touch" };
  // 実行: 下へ 40px 動かしてから pointercancel、続けてさらに下へ 40px
  target.dispatchEvent(
    new PointerEvent("pointerdown", { ...base, clientX: 50, clientY: 50 }),
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { ...base, clientX: 50, clientY: 90 }),
  );
  window.dispatchEvent(
    new PointerEvent("pointercancel", { ...base, clientX: 50, clientY: 90 }),
  );
  const count = moves.length;
  window.dispatchEvent(
    new PointerEvent("pointermove", { ...base, clientX: 50, clientY: 130 }),
  );
  // 検証: pointercancel で押した時点の状態に戻り、その後は onMove を呼ばない
  expect(count).toBeGreaterThanOrEqual(2);
  expect(moves.at(-1)).toBe(STATE);
  expect(moves).toHaveLength(count);
  expect(clicks).toHaveLength(0);
});
