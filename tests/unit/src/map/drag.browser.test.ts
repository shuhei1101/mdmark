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
  groupSizes: {},
};

/** 要素をドラッグする（pointerdown → move → up） */
function drag(
  target: Element,
  { dx, dy }: { dx: number; dy: number },
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
  drag(target, { dx: 3, dy: 0 });
  // 検証
  expect(clicks).toHaveLength(1);
  expect(moves).toHaveLength(0);
});

// ノードを動かす（正常系）
test("test_start_drag_when_node", async () => {
  // 準備
  const { target, moves } = await setUp('[data-node="A"]');
  // 実行
  drag(target, { dx: 0, dy: 40 });
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
  drag(target, { dx: 0, dy: 66 });
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
  drag(target, { dx: 0, dy: -150 }, { x: 280, y: 140 });
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

/** グループ page の中のノード A の配置（右のノード B を置くかは引数で決める） */
function groupLayout(right: number | undefined) {
  const node = ({
    id,
    x,
    y,
    ancestors,
  }: {
    id: string;
    x: number;
    y: number;
    ancestors: string[];
  }) => ({
    id,
    x,
    y,
    w: 120,
    h: 60,
    lines: [id],
    faded: false,
    ancestors,
  });
  return {
    width: 600,
    height: 400,
    nodes: [
      node({ id: "A", x: 48, y: 84, ancestors: ["page"] }),
      ...(right === undefined
        ? []
        : [node({ id: "B", x: 192 + right, y: 24, ancestors: [] })]),
    ],
    groups: [
      {
        id: "page",
        title: "page",
        x: 24,
        y: 24,
        w: 168,
        h: 144,
        ancestors: [],
        collapsed: false,
        faded: false,
      },
    ],
    wires: [],
  };
}

/** グループの縁の帯・角のボタンを配置して、押したときにドラッグを始める */
async function setUpGroup(selector: string) {
  const { startDrag } = await loadDrag();
  const root = createRootFromHtml(
    '<div data-group="page"><div class="map-group-bar is-left"></div><button class="map-group-resize"></button><div data-node="A"></div></div>',
  );
  const moves: Array<Record<string, unknown>> = [];
  const target = root.querySelector(selector) as Element;
  target.addEventListener("pointerdown", (event) => {
    startDrag({
      event: event as PointerEvent,
      layout: groupLayout(undefined),
      state: STATE,
      onMove: (state) =>
        moves.push(state as unknown as Record<string, unknown>),
      onClick: () => undefined,
    });
  });
  return { target, moves };
}

// グループの角で大きさを変える（正常系）
test("test_start_drag_when_group_corner", async () => {
  // 準備
  const { target, moves } = await setUpGroup(".map-group-resize");
  // 実行
  drag(target, { dx: 40, dy: 40 });
  // 検証
  const last = moves.at(-1) as {
    groupSizes?: Record<string, { w: number; h: number }>;
    positions: Record<string, { x: number; y: number }>;
  };
  expect(last.groupSizes?.page).toEqual({ w: 208, h: 184 });
  expect(last.positions.A ?? { x: 0, y: 0 }).toEqual({ x: 0, y: 0 });
});

// グループの縁で動かす（正常系）
test("test_start_drag_when_group_edge", async () => {
  // 準備
  const { target, moves } = await setUpGroup(".map-group-bar.is-left");
  // 実行
  drag(target, { dx: 30, dy: 0 });
  // 検証: 中のノードはグループの中身の左上からの座標のまま、グループが 30 動く
  const last = moves.at(-1) as {
    positions: Record<string, { x: number; y: number }>;
  };
  expect(last.positions.page).toEqual({ x: 30, y: 0 });
  expect(last.positions.A).toEqual({ x: 0, y: 0 });
});

// 広げる（正常系）
test("test_resize_by_key", async () => {
  // 準備
  const { resizeByKey } = await loadDrag();
  // 実行
  const next = resizeByKey({
    layout: groupLayout(undefined),
    state: STATE,
    group: "page",
    dw: 8,
    dh: 32,
  });
  // 検証
  expect(next?.groupSizes?.page).toEqual({ w: 176, h: 176 });
});

// 中身より小さくしない（正常系）
test("test_resize_by_key_when_min", async () => {
  // 準備
  const { resizeByKey } = await loadDrag();
  // 実行・検証: 今の大きさが中のノードを囲む大きさ
  expect(
    resizeByKey({
      layout: groupLayout(undefined),
      state: STATE,
      group: "page",
      dw: -32,
      dh: 0,
    }),
  ).toBeUndefined();
});

// ほかのノードに近づけない（正常系）
test("test_resize_by_key_when_blocked", async () => {
  // 準備
  const { resizeByKey } = await loadDrag();
  // 実行: 右のノードとの間が 20px
  const next = resizeByKey({
    layout: groupLayout(20),
    state: STATE,
    group: "page",
    dw: 32,
    dh: 0,
  });
  // 検証: 間が 16px になる手前まで
  expect(next?.groupSizes?.page).toEqual({ w: 172, h: 144 });
});

// マウスではポインターを捕まえる（正常系）
test("test_start_drag_when_mouse_captured", async () => {
  // 準備
  const { startDrag } = await loadDrag();
  const root = createRootFromHtml('<div data-node="A"></div>');
  const target = root.querySelector('[data-node="A"]') as Element;
  const capture = vi
    .spyOn(Element.prototype, "setPointerCapture")
    .mockImplementation(() => undefined);
  const events: PointerEvent[] = [];
  target.addEventListener("pointerdown", (event) => {
    events.push(event as PointerEvent);
    startDrag({
      event: event as PointerEvent,
      layout: LAYOUT,
      state: STATE,
      onMove: () => undefined,
      onClick: () => undefined,
    });
  });
  const press = (pointerType: string, pointerId: number) =>
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId,
        pointerType,
        clientX: 50,
        clientY: 50,
      }),
    );
  // 実行: マウスで押してから離し、指で押す
  press("mouse", 7);
  window.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerId: 7 }),
  );
  press("touch", 8);
  window.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerId: 8 }),
  );
  // 検証
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith(7);
  expect(events[0]?.defaultPrevented).toBe(true);
  expect(events[1]?.defaultPrevented).toBe(false);
});

/** 左下のノード A の右の辺から出て、右上のノード C の下の辺に入る L 字の線の配置 */
const lLayout = (cTop = 24) => ({
  width: 600,
  height: 400,
  nodes: [
    {
      id: "A",
      x: 24,
      y: 200,
      w: 120,
      h: 60,
      lines: ["A"],
      faded: false,
      ancestors: [],
    },
    {
      id: "C",
      x: 300,
      y: cTop,
      w: 120,
      h: 60,
      lines: ["C"],
      faded: false,
      ancestors: [],
    },
    {
      id: "X",
      x: 440,
      y: 120,
      w: 80,
      h: 40,
      lines: ["X"],
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
        [144, 230],
        [360, 230],
        [360, cTop + 60],
      ] as Array<[number, number]>,
    },
  ],
});

/** 点が矩形のどの辺の上にあるか */
const sideOn = (
  rect: { x: number; y: number; w: number; h: number },
  [x, y]: [number, number],
): string | undefined => {
  const inX = x >= rect.x && x <= rect.x + rect.w;
  const inY = y >= rect.y && y <= rect.y + rect.h;
  const sides: Array<[string, boolean]> = [
    ["top", y === rect.y && inX],
    ["bottom", y === rect.y + rect.h && inX],
    ["left", x === rect.x && inY],
    ["right", x === rect.x + rect.w && inY],
  ];
  return sides.find(([, on]) => on)?.[0];
};

/** 全ての区間が水平か垂直か */
const orthogonal = (points: Array<[number, number]>): boolean =>
  points
    .slice(1)
    .every(
      ([x, y], index) =>
        x === (points[index] as [number, number])[0] ||
        y === (points[index] as [number, number])[1],
    );

// 動かした区間を保つ（正常系）
test("test_apply_wire_shifts_when_inside_edge", async () => {
  // 準備
  const { applyWireShifts } = await loadDrag();
  const layout = lLayout();
  // 実行: 縦の区間（番号 1）を C の左右の端の内側で右へ 20px
  const { wires } = applyWireShifts(layout, {
    wireShifts: { "A->C": [{ segment: 1, offset: 20, count: 3 }] },
  });
  // 検証
  const points = wires[0]?.points as Array<[number, number]>;
  const [a, c] = [layout.nodes[0], layout.nodes[1]];
  expect(points.some(([x, y]) => x === 380 && y < 230)).toBe(true);
  expect(sideOn(a as never, points[0] as [number, number])).toBe("right");
  expect(sideOn(c as never, points.at(-1) as [number, number])).toBe("bottom");
  expect(orthogonal(points)).toBe(true);
});

// 越えた側の辺へ回り込む（正常系）
test("test_apply_wire_shifts_when_beyond_edge", async () => {
  // 準備
  const { applyWireShifts } = await loadDrag();
  const layout = lLayout();
  // 実行: 縦の区間を C の右端（420）より 30px 右（450）へ
  const { wires, attachments } = applyWireShifts(layout, {
    wireShifts: { "A->C": [{ segment: 1, offset: 90, count: 3 }] },
  });
  // 検証
  const points = wires[0]?.points as Array<[number, number]>;
  const c = layout.nodes[1];
  expect(sideOn(c as never, points.at(-1) as [number, number])).toBe("right");
  expect(attachments["A->C"]?.to).toBe("right");
  expect(points.some(([x, y]) => x === 450 && y < 230)).toBe(true);
  expect(orthogonal(points)).toBe(true);
});

// ノードを動かした後も浮かない（正常系）
test("test_apply_wire_shifts_when_node_moved", async () => {
  // 準備: C を上へ 40px 動かした配置（自動の経路は C の新しい下の辺 44 まで）
  const { applyWireShifts } = await loadDrag();
  const layout = lLayout(-16);
  // 実行
  const { wires } = applyWireShifts(layout, {
    wireShifts: { "A->C": [{ segment: 1, offset: 20, count: 3 }] },
  });
  // 検証
  const points = wires[0]?.points as Array<[number, number]>;
  const [a, c] = [layout.nodes[0], layout.nodes[1]];
  expect(sideOn(a as never, points[0] as [number, number])).toBeDefined();
  expect(sideOn(c as never, points.at(-1) as [number, number])).toBeDefined();
});

// 点の数が変わった線のずらしは捨てる（正常系）
test("test_apply_wire_shifts_when_points_changed", async () => {
  // 準備
  const { applyWireShifts } = await loadDrag();
  const layout = lLayout();
  // 実行
  const { wires, wireShifts } = applyWireShifts(layout, {
    wireShifts: { "A->C": [{ segment: 1, offset: 20, count: 5 }] },
  });
  // 検証
  expect(wires[0]?.points).toEqual(layout.wires[0]?.points);
  expect(wireShifts["A->C"]).toBeUndefined();
});
