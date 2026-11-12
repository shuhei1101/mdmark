import {
  MAP_LAYOUT,
  type MapLayout,
  type PlacedGroup,
  type PlacedNode,
  type PlacedWire,
  type Rect,
} from "./layout.ts";
import type { MapSide, MapState } from "./state.ts";

/** この値より動かずに離したら押した扱いにする（px） */
export const DRAG_THRESHOLD_PX = 4;
/** Alt + 矢印キー 1 回で動かす量（px） */
export const KEY_MOVE_PX = 8;
/** Alt + Shift + 矢印キー 1 回で動かす量（px） */
export const KEY_MOVE_PX_LARGE = 32;
/** 端の区間を動かしたとき、ノードの辺の端から内側に取る余白（px） */
const EDGE_INSET = 8;

type Item = (PlacedNode | PlacedGroup) & { ancestors: string[] };

/** 要素の親のグループ（ancestors は内側から） */
const parentOf = (layout: MapLayout, item: Item): PlacedGroup | undefined =>
  item.ancestors
    .map((id) => layout.groups.find((group) => group.id === id))
    .find((group) => group !== undefined);

/** 親の中身の左上（最上位は図の余白の内側） */
export const originOf = (parent: Rect | undefined): { x: number; y: number } =>
  parent
    ? {
        x: parent.x + MAP_LAYOUT.groupPad,
        y: parent.y + MAP_LAYOUT.groupPad + MAP_LAYOUT.groupTitle,
      }
    : { x: MAP_LAYOUT.margin, y: MAP_LAYOUT.margin };

/** 全てのノードとグループの今の位置を、親の中身の左上からの座標で固定する */
export const freezePositions = (
  layout: MapLayout,
  positions: MapState["positions"],
): MapState["positions"] => {
  const next = { ...positions };
  for (const item of [...layout.nodes, ...layout.groups]) {
    if (next[item.id]) continue;
    const origin = originOf(parentOf(layout, item));
    next[item.id] = { x: item.x - origin.x, y: item.y - origin.y };
  }
  return next;
};

/** 要素を rect に動かせるか: ほかの要素との間が minGap より狭くならず、広がる親のグループもそうなるか */
const fitsAt = (layout: MapLayout, item: Item, rect: Rect): boolean => {
  const gap = MAP_LAYOUT.minGap;
  const items: Item[] = [...layout.nodes, ...layout.groups];
  const hit = (a: Rect, b: Rect) =>
    a.x < b.x + b.w + gap &&
    b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap &&
    b.y < a.y + a.h + gap;
  const siblingsOf = (container: PlacedGroup | undefined, self: string) =>
    items.filter(
      (other) =>
        other.id !== self &&
        parentOf(layout, other)?.id === container?.id &&
        !other.ancestors.includes(self),
    );
  let parent = parentOf(layout, item);
  if (siblingsOf(parent, item.id).some((other) => hit(rect, other)))
    return false;
  let inner = rect;
  while (parent) {
    const grown = {
      x: parent.x,
      y: parent.y,
      w: Math.max(parent.w, inner.x + inner.w + MAP_LAYOUT.groupPad - parent.x),
      h: Math.max(parent.h, inner.y + inner.h + MAP_LAYOUT.groupPad - parent.y),
    };
    const outer = parentOf(layout, parent);
    if (siblingsOf(outer, parent.id).some((other) => hit(grown, other)))
      return false;
    inner = grown;
    parent = outer;
  }
  return true;
};

/** ノードかグループを (dx, dy) だけ動かした位置を返す。近づけすぎる位置へは動かさず、動かせる所まで戻す */
export const moveItem = (
  layout: MapLayout,
  item: Item,
  dx: number,
  dy: number,
): { x: number; y: number } => {
  const origin = originOf(parentOf(layout, item));
  const steps = Math.ceil(Math.hypot(dx, dy));
  for (let step = steps; step >= 0; step -= 1) {
    const t = steps === 0 ? 0 : step / steps;
    const x = Math.max(origin.x, item.x + dx * t);
    const y = Math.max(origin.y, item.y + dy * t);
    if (step === 0 || fitsAt(layout, item, { x, y, w: item.w, h: item.h })) {
      return { x: Math.round(x - origin.x), y: Math.round(y - origin.y) };
    }
  }
  return { x: item.x - origin.x, y: item.y - origin.y };
};

/** 点が矩形の内側（辺を除く）か */
const inside = (rect: Rect, [x, y]: [number, number]) =>
  x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;

/** ノードの外の点から、ノードのどの辺へまっすぐ入れるか */
const enterFrom = (
  rect: Rect,
  [x, y]: [number, number],
): [number, number] | undefined => {
  const insideX = x >= rect.x + EDGE_INSET && x <= rect.x + rect.w - EDGE_INSET;
  const insideY = y >= rect.y + EDGE_INSET && y <= rect.y + rect.h - EDGE_INSET;
  if (insideX && y >= rect.y + rect.h) return [x, rect.y + rect.h];
  if (insideX && y <= rect.y) return [x, rect.y];
  if (insideY && x >= rect.x + rect.w) return [rect.x + rect.w, y];
  if (insideY && x <= rect.x) return [rect.x, y];
  return undefined;
};

/** 端の点がノードのどの辺にあるか */
const sideOf = (rect: Rect, [x, y]: [number, number]): MapSide | undefined => {
  if (y === rect.y) return "top";
  if (y === rect.y + rect.h) return "bottom";
  if (x === rect.x) return "left";
  if (x === rect.x + rect.w) return "right";
  return undefined;
};

/** 端の区間を決め直す: ノードの中に入った折れ点を捨て、ノードの外の一番近い折れ点からつなぐ辺を決める */
const fixEnd = (
  points: Array<[number, number]>,
  rect: Rect | undefined,
): Array<[number, number]> => {
  if (!rect || points.length < 3) return points;
  let body = points.slice(0, -1);
  while (body.length > 1 && inside(rect, body.at(-1) as [number, number]))
    body = body.slice(0, -1);
  const end = enterFrom(rect, body.at(-1) as [number, number]);
  return end ? [...body, end] : points;
};

/** 動かした線の区間のずらしを線の点に当て、端のつなぐ辺を決め直す。点の数が変わった線のずらしは捨てる */
export const applyWireShifts = (
  layout: MapLayout,
  state: Pick<MapState, "wireShifts">,
): {
  wires: PlacedWire[];
  attachments: MapState["attachments"];
  wireShifts: MapState["wireShifts"];
} => {
  const rectOf = (id: string): Rect | undefined =>
    layout.nodes.find((node) => node.id === id) ??
    layout.groups.find((group) => group.id === id);
  const attachments: MapState["attachments"] = {};
  const wireShifts: MapState["wireShifts"] = {};
  const wires = layout.wires.map((wire) => {
    const shifts = state.wireShifts[wire.id];
    if (!shifts || shifts.length === 0) return wire;
    if (
      shifts.some(
        (shift) =>
          shift.count !== undefined && shift.count !== wire.points.length,
      )
    )
      return wire;
    wireShifts[wire.id] = shifts;
    let points = wire.points.map((point): [number, number] => [
      point[0],
      point[1],
    ]);
    for (const { segment, offset } of shifts) {
      const a = points[segment];
      const b = points[segment + 1];
      if (!a || !b) continue;
      const axis = a[1] === b[1] ? 1 : 0;
      a[axis] += offset;
      b[axis] += offset;
    }
    points = fixEnd(points, rectOf(wire.to));
    points = fixEnd([...points].reverse(), rectOf(wire.from)).reverse();
    const from = rectOf(wire.from);
    const to = rectOf(wire.to);
    const fromSide = from
      ? sideOf(from, points[0] as [number, number])
      : undefined;
    const toSide = to
      ? sideOf(to, points.at(-1) as [number, number])
      : undefined;
    attachments[wire.id] = {
      ...(fromSide ? { from: fromSide } : {}),
      ...(toSide ? { to: toSide } : {}),
    };
    return { ...wire, points };
  });
  return { wires, attachments, wireShifts };
};

/** 押した場所（ノード・グループのタイトルの行・線の区間）からドラッグを始める。4px 動くまでは押した扱い。`pointercancel` で動かした分を戻す */
export const startDrag = (options: {
  event: PointerEvent;
  layout: MapLayout;
  state: MapState;
  onMove: (state: MapState) => void;
  onClick: () => void;
  /** 図の中身の座標とポインターの座標の比 */
  scale?: number;
  /** ポインターの位置を図の中身の座標にする（線の区間を data-segment で指さないときに使う） */
  pointOf?: (event: PointerEvent) => [number, number];
}): void => {
  const { event, layout, onMove, onClick } = options;
  const scale = options.scale ?? 1;
  const target = event.target instanceof Element ? event.target : undefined;
  const nodeId =
    target?.closest("[data-node]")?.getAttribute("data-node") ?? undefined;
  const groupId =
    target
      ?.closest(".map-group-bar, .map-group-head")
      ?.closest("[data-group]")
      ?.getAttribute("data-group") ?? undefined;
  const hit = target?.closest(".map-wire-hit");
  const wireId = hit?.getAttribute("data-wire") ?? undefined;
  const wire =
    wireId === undefined
      ? undefined
      : layout.wires.find((item) => item.id === wireId);
  const item: Item | undefined =
    nodeId !== undefined
      ? layout.nodes.find((node) => node.id === nodeId)
      : groupId !== undefined
        ? layout.groups.find((group) => group.id === groupId)
        : undefined;
  let segment: number | undefined;
  if (wire) {
    const given = hit?.getAttribute("data-segment");
    segment =
      given === null || given === undefined
        ? nearestSegment(wire, options.pointOf?.(event))
        : Number(given);
  }
  const startX = event.clientX;
  const startY = event.clientY;
  let moved = false;
  let state = options.state;
  const move = (next: PointerEvent) => {
    const dx = (next.clientX - startX) / scale;
    const dy = (next.clientY - startY) / scale;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!moved)
      state = { ...state, positions: freezePositions(layout, state.positions) };
    moved = true;
    if (item) {
      state = {
        ...state,
        positions: {
          ...state.positions,
          [item.id]: moveItem(layout, item, dx, dy),
        },
      };
    } else if (wire && segment !== undefined) {
      const a = wire.points[segment];
      const b = wire.points[segment + 1];
      if (!a || !b) return;
      const horizontal = a[1] === b[1];
      const offset = Math.round(horizontal ? dy : dx);
      const others = (state.wireShifts[wire.id] ?? []).filter(
        (shift) => shift.segment !== segment,
      );
      const wireShifts = {
        ...state.wireShifts,
        [wire.id]: [{ segment, offset, count: wire.points.length }, ...others],
      };
      const applied = applyWireShifts(layout, { wireShifts });
      state = {
        ...state,
        wireShifts,
        attachments: { ...state.attachments, ...applied.attachments },
      };
    }
    onMove(state);
  };
  const release = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
  };
  const up = () => {
    release();
    if (!moved) onClick();
  };
  // ブラウザが指のドラッグを文書のスクロールに切り替えたときは、動かした分を押した時点の状態に戻す
  const cancel = () => {
    release();
    if (moved) onMove(options.state);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
};

/** フォーカスしたノード・グループを (dx, dy) だけ、線は真ん中の区間を区間と直角の向きへ動かした状態を返す。動かせないときは undefined */
export const moveByKey = (options: {
  layout: MapLayout;
  state: MapState;
  target: { node?: string; group?: string; wire?: string };
  dx: number;
  dy: number;
}): MapState | undefined => {
  const { layout, target, dx, dy } = options;
  const state = {
    ...options.state,
    positions: freezePositions(layout, options.state.positions),
  };
  const item: Item | undefined =
    target.node !== undefined
      ? layout.nodes.find((node) => node.id === target.node)
      : target.group !== undefined
        ? layout.groups.find((group) => group.id === target.group)
        : undefined;
  if (item) {
    const next = moveItem(layout, item, dx, dy);
    const before = state.positions[item.id];
    if (before && before.x === next.x && before.y === next.y) return undefined;
    return { ...state, positions: { ...state.positions, [item.id]: next } };
  }
  const wire = layout.wires.find((one) => one.id === target.wire);
  if (!wire || wire.points.length < 2) return undefined;
  const segment = Math.floor((wire.points.length - 2) / 2);
  const a = wire.points[segment];
  const b = wire.points[segment + 1];
  if (!a || !b) return undefined;
  const offset = a[1] === b[1] ? dy : dx;
  if (offset === 0) return undefined;
  const shifts = options.state.wireShifts[wire.id] ?? [];
  const old = shifts.find((shift) => shift.segment === segment)?.offset ?? 0;
  const wireShifts = {
    ...options.state.wireShifts,
    [wire.id]: [
      { segment, offset: old + offset, count: wire.points.length },
      ...shifts.filter((shift) => shift.segment !== segment),
    ],
  };
  const applied = applyWireShifts(layout, { wireShifts });
  return {
    ...options.state,
    wireShifts,
    attachments: { ...options.state.attachments, ...applied.attachments },
  };
};

/** 線の区間のうち、点に一番近い区間の番号 */
export const nearestSegment = (
  wire: PlacedWire,
  point: [number, number] | undefined,
): number | undefined => {
  if (!point) return undefined;
  let best: { index: number; distance: number } | undefined;
  for (let index = 0; index < wire.points.length - 1; index += 1) {
    const a = wire.points[index] as [number, number];
    const b = wire.points[index + 1] as [number, number];
    const horizontal = a[1] === b[1];
    const within = horizontal
      ? point[0] >= Math.min(a[0], b[0]) - 4 &&
        point[0] <= Math.max(a[0], b[0]) + 4
      : point[1] >= Math.min(a[1], b[1]) - 4 &&
        point[1] <= Math.max(a[1], b[1]) + 4;
    const distance = horizontal
      ? Math.abs(point[1] - a[1])
      : Math.abs(point[0] - a[0]);
    if (within && (best === undefined || distance < best.distance))
      best = { index, distance };
  }
  return best?.index;
};
