import { LABEL_METRICS } from "../diagram/check.ts";
import type { MapSide } from "./data.ts";
import type { Direction, FlowArrow, Flowchart } from "./flowchart.ts";

/** 配置の寸法（px）と経路の重み */
export const MAP_LAYOUT = {
  maxWidth: 220,
  maxWidthWide: 360,
  minWidth: 120,
  gapItem: 48,
  gapRank: 64,
  groupPad: 24,
  groupTitle: 36,
  margin: 24,
  /** 線を引く通り道の、矩形からの離れ */
  clearance: 12,
  bendCost: 30,
  /** 祖先でないグループの枠を出入りする 1 回の重み。最短より出入りを増やさないために大きくする */
  borderCost: 100000,
  /** ドラッグで近づけられる間の下限 */
  minGap: 16,
};

/** 見せ方（中へ入る・閉じる） */
export type MapView = { entered?: string | undefined; collapsed: string[] };

/** 補足の layout・動かした位置・測った大きさを合わせた 1 つの ID の制約 */
export type MapOverride = {
  align?: string | undefined;
  order?: number | undefined;
  pos?: { x: number; y: number } | undefined;
  width?: number | undefined;
  /** 段の中で寄せる側 */
  justify?: "start" | "center" | "end" | undefined;
  /** 線の端をつなぐ辺（補足の ends と、つなぎ替えた辺） */
  ends?: { from?: MapSide; to?: MapSide } | undefined;
  /** 線の経由点（両端の共通の祖先の中身の左上からの座標） */
  via?: Array<{ x: number; y: number }> | undefined;
  size?: { w: number; h: number } | undefined;
  /** ノードの上に空ける高さ（同じ状態への遷移の線とラベルの置き場所。線も通さない） */
  above?: number | undefined;
  /** ノードの左右に空ける幅（ER 図の関連の端と多重度の置き場所。線は通す） */
  aside?: number | undefined;
};

/** 辺ごとの、線が辺から出ていく向き（routeEdges の向きの番号） */
const SIDE_DIRECTION: Record<MapSide, number> = {
  right: 0,
  bottom: 1,
  left: 2,
  top: 3,
};

export type Rect = { x: number; y: number; w: number; h: number };

type ViewLeaf = {
  kind: "leaf";
  id: string;
  label: string;
  faded: boolean;
  collapsed: boolean;
  w: number;
  h: number;
  lines: string[];
  /** h のうち、ノードの上に空ける高さ */
  above: number;
  /** w のうち、ノードの左右それぞれに空ける幅 */
  aside: number;
};
type ViewBox = {
  kind: "box";
  id: string;
  title: string;
  direction: Direction;
  children: ViewItem[];
  w: number;
  h: number;
};
type ViewItem = ViewLeaf | ViewBox;

/** まとめた線の元の線 */
export type MergedWire = {
  from: string;
  to: string;
  label: string | undefined;
  /** 元の線の端のノードの名前（閉じたグループの中のノードは描かないため、名前を持たせる） */
  fromLabel: string;
  toLabel: string;
};

/** 配置したノード。ancestors は内側から */
export type PlacedNode = Rect & {
  id: string;
  lines: string[];
  faded: boolean;
  ancestors: string[];
  /** Mermaid の名前（グループを外に薄く残したノードはグループのタイトル） */
  label?: string;
  /** Mermaid のクラス（設定の map.kinds を引く） */
  classes?: string[];
};
/** 配置したグループ。閉じたグループは collapsed が true の 1 つのノードの大きさ */
export type PlacedGroup = Rect & {
  id: string;
  title: string;
  ancestors: string[];
  collapsed: boolean;
  faded: boolean;
  /** 閉じたグループの中（入れ子のグループの中を含む）のノードの数。開いたグループは持たない */
  count?: number;
};
/** 配置した線 */
export type PlacedWire = {
  id: string;
  from: string;
  to: string;
  label: string | undefined;
  merged: MergedWire[] | undefined;
  points: Array<[number, number]>;
  /** Mermaid の矢印（設定の map.lines を引く） */
  arrow?: FlowArrow;
  /** 両向きの矢印か */
  both?: boolean;
};

/** layoutMap の戻り値 */
export type MapLayout = {
  width: number;
  height: number;
  nodes: PlacedNode[];
  groups: PlacedGroup[];
  wires: PlacedWire[];
};

type ViewWire = {
  id: string;
  from: string;
  to: string;
  label: string | undefined;
  merged: MergedWire[] | undefined;
};
type InnerLeaf = PlacedNode & { collapsed: boolean; title: string };

const isWide = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return !(code <= 0x7e || (code >= 0xff61 && code <= 0xff9f));
};

/** labelLineCount と同じ見積もりで、幅に収まるように行に分ける */
const splitLines = (
  text: string,
  fontSize: number,
  width: number,
): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    let used = 0;
    for (const char of paragraph) {
      const advance = isWide(char) ? fontSize : fontSize * 0.6;
      if (used > 0 && used + advance > width) {
        lines.push(line);
        line = "";
        used = 0;
      }
      line += char;
      used += advance;
    }
    lines.push(line);
  }
  return lines;
};

/** 文字の見積もりの幅 */
const textWidth = (text: string, fontSize: number): number =>
  Math.max(
    ...text
      .split("\n")
      .map((line) =>
        [...line].reduce(
          (sum, char) => sum + (isWide(char) ? fontSize : fontSize * 0.6),
          0,
        ),
      ),
  );

/** 全角の文字を文字の大きさ、半角の文字を 0.6 倍の幅とみなし、幅で折り返した行を返す */
export const wrapLabel = (text: string, width: number): string[] =>
  splitLines(text, LABEL_METRICS.nameSize, width - LABEL_METRICS.padX * 2);

const sizeLeaf = (
  label: string,
  maxWidth: number,
  width: number | undefined,
  size?: { w: number; h: number },
): { w: number; h: number; lines: string[] } => {
  const { nameSize, kindSize, lineHeight, padX, padY } = LABEL_METRICS;
  if (size)
    return {
      w: size.w,
      h: size.h,
      lines: splitLines(label, nameSize, size.w - padX * 2),
    };
  const w =
    width ??
    Math.min(
      maxWidth,
      Math.max(
        MAP_LAYOUT.minWidth,
        Math.ceil(textWidth(label, nameSize)) + padX * 2,
      ),
    );
  const lines = splitLines(label, nameSize, w - padX * 2);
  const count = lines.length;
  const h =
    Math.ceil((kindSize + count * nameSize) * lineHeight) + padY * 2 + 16;
  return { w, h, lines };
};

/** 中へ入る・閉じる・視点を当てた、描く木と線を作る */
const buildView = (
  chart: Flowchart,
  view: MapView,
  overrides: Record<string, MapOverride>,
  maxWidth: number,
): { root: ViewBox; edges: ViewWire[] } => {
  const options = { enter: view.entered, collapsed: view.collapsed };
  const boxParent = new Map(chart.groups.map((box) => [box.id, box.parent]));
  const parentOf = (id: string): string | undefined =>
    chart.nodes.find((node) => node.id === id)?.parent ?? boxParent.get(id);
  const chain = (id: string): string[] => {
    const result: string[] = [];
    for (
      let current = parentOf(id);
      current !== undefined;
      current = boxParent.get(current)
    ) {
      result.push(current);
    }
    return result;
  };
  const collapsed = new Set(options.collapsed ?? []);
  const inEntered = (id: string): boolean =>
    options.enter === undefined ||
    chain(id).includes(options.enter) ||
    id === options.enter;
  // 線の端を、表示する葉に読み替える
  const visibleOf = (nodeId: string): { id: string; faded: boolean } => {
    const ancestors = chain(nodeId).reverse();
    if (!inEntered(nodeId)) {
      // 入った箱の外は、入った箱を含まない最も外側の要素に畳んで薄く残す
      const enterChain = chain(options.enter as string);
      const outer = ancestors.find(
        (box) => box !== options.enter && !enterChain.includes(box),
      );
      return { id: outer ?? nodeId, faded: true };
    }
    const closed = ancestors.find((box) => collapsed.has(box));
    return { id: closed ?? nodeId, faded: false };
  };
  const merged = new Map<string, ViewWire>();
  const used = new Set<string>();
  for (const edge of chart.edges) {
    const from = visibleOf(edge.from);
    const to = visibleOf(edge.to);
    if (from.id === to.id || (from.faded && to.faded)) {
      continue;
    }
    const toClosed = from.id !== edge.from || to.id !== edge.to;
    const key = toClosed ? `${from.id}->${to.id}` : edge.id;
    const found = merged.get(key);
    const labelOf = (id: string): string =>
      chart.nodes.find((node) => node.id === id)?.label ?? id;
    const original: MergedWire = {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      fromLabel: labelOf(edge.from),
      toLabel: labelOf(edge.to),
    };
    if (found) {
      found.merged?.push(original);
      found.label = undefined;
    } else {
      merged.set(key, {
        id: toClosed ? key : edge.id,
        from: from.id,
        to: to.id,
        label: toClosed ? undefined : edge.label,
        merged: toClosed ? [original] : undefined,
      });
    }
    used.add(from.id);
    used.add(to.id);
  }
  const fadedIds = new Set<string>();
  for (const edge of chart.edges) {
    for (const end of [edge.from, edge.to]) {
      const visible = visibleOf(end);
      if (visible.faded && used.has(visible.id)) {
        fadedIds.add(visible.id);
      }
    }
  }
  const keepNode = (_id: string): boolean => true;
  const makeLeaf = (
    id: string,
    label: string,
    faded: boolean,
    collapsedGroup = false,
  ): ViewLeaf => {
    const size = sizeLeaf(
      label,
      maxWidth,
      overrides[id]?.width,
      overrides[id]?.size,
    );
    const above = collapsedGroup ? 0 : (overrides[id]?.above ?? 0);
    const aside = collapsedGroup ? 0 : (overrides[id]?.aside ?? 0);
    return {
      kind: "leaf",
      id,
      label,
      faded,
      collapsed: collapsedGroup,
      ...size,
      w: size.w + aside * 2,
      h: size.h + above,
      above,
      aside,
    };
  };
  const makeBox = (
    boxId: string | undefined,
    title: string,
    direction: Direction,
  ): ViewBox => {
    const children: ViewItem[] = [];
    for (const box of chart.groups.filter((item) => item.parent === boxId)) {
      if (collapsed.has(box.id)) {
        if (keepNode(box.id)) {
          children.push(makeLeaf(box.id, box.title, false, true));
        }
        continue;
      }
      const child = makeBox(box.id, box.title, box.direction ?? direction);
      if (child.children.length > 0) {
        children.push(child);
      }
    }
    for (const node of chart.nodes.filter((item) => item.parent === boxId)) {
      if (keepNode(node.id)) {
        children.push(makeLeaf(node.id, node.label, false));
      }
    }
    return {
      kind: "box",
      id: boxId ?? "",
      title,
      direction,
      children,
      w: 0,
      h: 0,
    };
  };
  let root: ViewBox;
  if (options.enter === undefined) {
    root = makeBox(undefined, "", chart.direction);
  } else {
    const entered = chart.groups.find((box) => box.id === options.enter);
    if (!entered) {
      throw new Error(`入る箱がありません: ${options.enter}`);
    }
    const inner = makeBox(
      entered.id,
      entered.title,
      entered.direction ?? chart.direction,
    );
    const outside = [...fadedIds].map((id) => {
      const box = chart.groups.find((item) => item.id === id);
      return makeLeaf(
        id,
        box?.title ?? chart.nodes.find((node) => node.id === id)?.label ?? id,
        true,
        box !== undefined,
      );
    });
    root = {
      kind: "box",
      id: "",
      title: "",
      direction: chart.direction,
      children: [inner, ...outside],
      w: 0,
      h: 0,
    };
  }
  return { root, edges: [...merged.values()] };
};

type Local = { item: ViewItem; x: number; y: number };

/** 有向グラフの段を、閉路の戻りの線を外した最長路で決める */
const assignRanks = (
  ids: string[],
  links: Array<[string, string]>,
): Map<string, number> => {
  const out = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [from, to] of links) {
    out.get(from)?.push(to);
  }
  const state = new Map<string, "open" | "done">();
  const forward: Array<[string, string]> = [];
  const visit = (id: string): void => {
    state.set(id, "open");
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === "open") {
        continue;
      }
      forward.push([id, next]);
      if (!state.has(next)) {
        visit(next);
      }
    }
    state.set(id, "done");
  };
  for (const id of ids) {
    if (!state.has(id)) {
      visit(id);
    }
  }
  const rank = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const [from, to] of forward) {
      const next = (rank.get(from) ?? 0) + 1;
      if (next > (rank.get(to) ?? 0)) {
        rank.set(to, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return rank;
};

/** 箱の中身を、内側の箱から先に配置して大きさを決める */
const layoutBox = (
  box: ViewBox,
  links: Array<[string, string]>,
  overrides: Record<string, MapOverride>,
  placed: Map<string, Local[]>,
): void => {
  for (const child of box.children) {
    if (child.kind === "box") {
      layoutBox(child, links, overrides, placed);
    }
  }
  const ids = box.children.map((child) => child.id);
  // 子孫の線を、この箱の直下の子どうしの線に持ち上げる
  const owner = new Map<string, string>();
  const collect = (item: ViewItem, top: string): void => {
    owner.set(item.id, top);
    if (item.kind === "box") {
      for (const child of item.children) {
        collect(child, top);
      }
    }
  };
  for (const child of box.children) {
    collect(child, child.id);
  }
  const lifted: Array<[string, string]> = [];
  for (const [from, to] of links) {
    const a = owner.get(from);
    const b = owner.get(to);
    if (a !== undefined && b !== undefined && a !== b) {
      lifted.push([a, b]);
    }
  }
  const rank = assignRanks(ids, lifted);
  // align: 相手と同じ段にする
  for (const id of ids) {
    const target = overrides[id]?.align;
    if (target !== undefined && rank.has(target)) {
      const value = Math.max(rank.get(id) ?? 0, rank.get(target) ?? 0);
      rank.set(id, value);
      rank.set(target, value);
    }
  }
  const rankCount = Math.max(0, ...rank.values()) + 1;
  const rows: string[][] = Array.from({ length: rankCount }, () => []);
  for (const id of ids) {
    rows[rank.get(id) ?? 0]?.push(id);
  }
  // 並び順: 前の段の位置の重心で並べ替える（order の指定を先に置く）
  const position = new Map<string, number>();
  const sortRow = (
    row: string[],
    neighbors: (id: string) => string[],
  ): void => {
    const score = (id: string): number => {
      const fixed = overrides[id]?.order;
      if (fixed !== undefined) {
        return -1000 + fixed;
      }
      const near = neighbors(id)
        .map((n) => position.get(n))
        .filter((value): value is number => value !== undefined);
      return near.length === 0
        ? (position.get(id) ?? 0)
        : near.reduce((sum, value) => sum + value, 0) / near.length;
    };
    row.sort((a, b) => score(a) - score(b));
    row.forEach((id, index) => {
      position.set(id, index);
    });
  };
  rows.forEach((row) => {
    row.forEach((id, index) => {
      position.set(id, index);
    });
  });
  const preds = (id: string): string[] =>
    lifted.filter(([, to]) => to === id).map(([from]) => from);
  const succs = (id: string): string[] =>
    lifted.filter(([from]) => from === id).map(([, to]) => to);
  for (let sweep = 0; sweep < 4; sweep++) {
    if (sweep % 2 === 0) {
      for (const row of rows) sortRow(row, preds);
    } else {
      for (const row of [...rows].reverse()) sortRow(row, succs);
    }
  }
  const byId = new Map(box.children.map((child) => [child.id, child]));
  const vertical = box.direction === "TB";
  const main = (item: ViewItem): number => (vertical ? item.h : item.w);
  const cross = (item: ViewItem): number => (vertical ? item.w : item.h);
  const rowCross = rows.map(
    (row) =>
      row.reduce((sum, id) => sum + cross(byId.get(id) as ViewItem), 0) +
      Math.max(0, row.length - 1) * MAP_LAYOUT.gapItem,
  );
  const widest = Math.max(0, ...rowCross);
  const locals: Local[] = [];
  let along = 0;
  rows.forEach((row, index) => {
    const depth = Math.max(
      0,
      ...row.map((id) => main(byId.get(id) as ViewItem)),
    );
    // 寄せる: 段の中の最初の指定に合わせる（既定は中央）
    const justify = row
      .map((id) => overrides[id]?.justify)
      .find((value) => value !== undefined);
    const room = widest - (rowCross[index] ?? 0);
    let at = justify === "start" ? 0 : justify === "end" ? room : room / 2;
    for (const id of row) {
      const item = byId.get(id) as ViewItem;
      const offset = (depth - main(item)) / 2;
      const p = vertical
        ? { x: at, y: along + offset }
        : { x: along + offset, y: at };
      locals.push({ item, ...p });
      at += cross(item) + MAP_LAYOUT.gapItem;
    }
    along += depth + MAP_LAYOUT.gapRank;
  });
  // 座標の固定: 指定の位置に置き、重なる要素を交差軸の向きへ押し出す
  const fixed = locals.filter(
    (local) => overrides[local.item.id]?.pos !== undefined,
  );
  for (const local of fixed) {
    const pos = overrides[local.item.id]?.pos as { x: number; y: number };
    // 固定の位置はノードの左上。ノードの左と上に空ける分だけずらして配置する
    local.x = pos.x - (local.item.kind === "leaf" ? local.item.aside : 0);
    local.y = pos.y - (local.item.kind === "leaf" ? local.item.above : 0);
  }
  const gap = MAP_LAYOUT.gapItem;
  for (let pass = 0; pass < locals.length * 2; pass++) {
    let moved = false;
    for (const local of locals) {
      if (fixed.includes(local)) {
        continue;
      }
      for (const other of locals) {
        if (other === local) {
          continue;
        }
        const hit =
          local.x < other.x + other.item.w + gap &&
          other.x < local.x + local.item.w + gap &&
          local.y < other.y + other.item.h + gap &&
          other.y < local.y + local.item.h + gap;
        // 固定した要素と、先に押し出した要素から離す
        if (
          hit &&
          (fixed.includes(other) ||
            locals.indexOf(other) < locals.indexOf(local))
        ) {
          if (vertical) {
            local.x = other.x + other.item.w + gap;
          } else {
            local.y = other.y + other.item.h + gap;
          }
          moved = true;
        }
      }
    }
    if (!moved) {
      break;
    }
  }
  const minX = Math.min(0, ...locals.map((local) => local.x));
  const minY = Math.min(0, ...locals.map((local) => local.y));
  for (const local of locals) {
    local.x -= minX;
    local.y -= minY;
  }
  const contentW = Math.max(
    0,
    ...locals.map((local) => local.x + local.item.w),
  );
  const contentH = Math.max(
    0,
    ...locals.map((local) => local.y + local.item.h),
  );
  const top = box.id === "" ? 0 : MAP_LAYOUT.groupTitle;
  const pad = box.id === "" ? 0 : MAP_LAYOUT.groupPad;
  box.w = contentW + pad * 2;
  box.h = contentH + pad * 2 + top;
  placed.set(
    box.id,
    locals.map((local) => ({
      ...local,
      x: local.x + pad,
      y: local.y + pad + top,
    })),
  );
};

type Heap = {
  push: (cost: number, value: number) => void;
  pop: () => number | undefined;
  size: () => number;
};

const createHeap = (): Heap => {
  let costs = new Float64Array(1024);
  let values = new Int32Array(1024);
  let length = 0;
  return {
    push: (cost, value) => {
      if (length === costs.length) {
        const nextCosts = new Float64Array(length * 2);
        nextCosts.set(costs);
        costs = nextCosts;
        const nextValues = new Int32Array(length * 2);
        nextValues.set(values);
        values = nextValues;
      }
      let i = length;
      length += 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if ((costs[p] as number) <= cost) {
          break;
        }
        costs[i] = costs[p] as number;
        values[i] = values[p] as number;
        i = p;
      }
      costs[i] = cost;
      values[i] = value;
    },
    pop: () => {
      if (length === 0) {
        return undefined;
      }
      const top = values[0] as number;
      length -= 1;
      const cost = costs[length] as number;
      const value = values[length] as number;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= length) {
          break;
        }
        const r = l + 1;
        const m =
          r < length && (costs[r] as number) < (costs[l] as number) ? r : l;
        if ((costs[m] as number) >= cost) {
          break;
        }
        costs[i] = costs[m] as number;
        values[i] = values[m] as number;
        i = m;
      }
      costs[i] = cost;
      values[i] = value;
      return top;
    },
    size: () => length,
  };
};

const strictlyInside = (x: number, y: number, rect: Rect): boolean =>
  x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;

/** 縦横の折れ線で線を引く。端点とその祖先以外の矩形と、ノードの上に空けた場所を通らず、祖先の箱の枠の出入りを最少にする */
const routeEdges = (
  leaves: InnerLeaf[],
  boxes: Array<Rect & { id: string }>,
  edges: ViewWire[],
  overrides: Record<string, MapOverride>,
  reserved: Array<Rect & { id: string }> = [],
): PlacedWire[] => {
  const m = MAP_LAYOUT.clearance;
  /** 経由点を図の座標にする（両端の共通の祖先のグループの中身の左上、無ければ図の外の余白の内側が原点） */
  const viaOf = (edge: ViewWire): Array<[number, number]> => {
    const via = overrides[edge.id]?.via ?? [];
    if (via.length === 0) return [];
    const fromAnc =
      leaves.find((leaf) => leaf.id === edge.from)?.ancestors ?? [];
    const toAnc = leaves.find((leaf) => leaf.id === edge.to)?.ancestors ?? [];
    const lca = fromAnc.find((id) => toAnc.includes(id));
    const group = boxes.find((box) => box.id === lca);
    const ox = group ? group.x + MAP_LAYOUT.groupPad : MAP_LAYOUT.margin;
    const oy = group
      ? group.y + MAP_LAYOUT.groupPad + MAP_LAYOUT.groupTitle
      : MAP_LAYOUT.margin;
    return via.map((point): [number, number] => [ox + point.x, oy + point.y]);
  };
  const vias = new Map(edges.map((edge) => [edge.id, viaOf(edge)]));
  const rects: Array<Rect & { id: string; leaf: boolean }> = [
    ...leaves.map((leaf) => ({ ...leaf, leaf: true })),
    ...boxes.map((box) => ({ ...box, leaf: false })),
    ...reserved.map((rect) => ({ ...rect, leaf: true })),
  ];
  const xsSet = new Set<number>();
  const ysSet = new Set<number>();
  for (const rect of rects) {
    xsSet
      .add(rect.x - m)
      .add(rect.x + rect.w + m)
      .add(rect.x + rect.w / 2);
    ysSet
      .add(rect.y - m)
      .add(rect.y + rect.h + m)
      .add(rect.y + rect.h / 2);
    if (!rect.leaf) {
      // 箱の枠の内側の通り道
      xsSet.add(rect.x + m).add(rect.x + rect.w - m);
      ysSet.add(rect.y + m).add(rect.y + rect.h - m);
    }
  }
  for (const points of vias.values()) {
    for (const [x, y] of points) {
      xsSet.add(x);
      ysSet.add(y);
    }
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  const nx = xs.length;
  const ny = ys.length;
  const indexOfRect = new Map(rects.map((rect, index) => [rect.id, index]));
  // 格子の点ごとに、内側にある矩形の番号
  const inside: number[][] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i] as number;
      const y = ys[j] as number;
      const list: number[] = [];
      rects.forEach((rect, index) => {
        if (strictlyInside(x, y, rect)) {
          list.push(index);
        }
      });
      inside.push(list);
    }
  }
  const ancestorsOf = new Map<string, string[]>(
    leaves.map((leaf) => [leaf.id, leaf.ancestors]),
  );
  const xIndex = new Map(xs.map((x, i) => [x, i]));
  const yIndex = new Map(ys.map((y, j) => [y, j]));
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  return edges.map((edge) => {
    const source = leaves.find((leaf) => leaf.id === edge.from) as InnerLeaf;
    const target = leaves.find((leaf) => leaf.id === edge.to) as InnerLeaf;
    const fromAnc = ancestorsOf.get(edge.from) ?? [];
    const toAnc = ancestorsOf.get(edge.to) ?? [];
    const allowed = new Set(
      [...fromAnc, ...toAnc].map((id) => indexOfRect.get(id)),
    );
    const common = fromAnc.filter((id) => toAnc.includes(id));
    const lca =
      common[0] === undefined ? undefined : indexOfRect.get(common[0]);
    // 片方だけの祖先の箱（枠を 1 回ずつ出入りする箱）を、点ごとのビットにする
    const crossing = [...fromAnc, ...toAnc]
      .filter((id) => !common.includes(id))
      .map((id) => indexOfRect.get(id) as number);
    const total = nx * ny;
    const blockedAt = new Uint8Array(total);
    const maskAt = new Uint8Array(total);
    for (let point = 0; point < total; point++) {
      const list = inside[point] as number[];
      let isBlocked = lca !== undefined && !list.includes(lca);
      let mask = 0;
      for (const index of list) {
        if (!allowed.has(index)) {
          isBlocked = true;
        }
        const bit = crossing.indexOf(index);
        if (bit >= 0) {
          mask |= 1 << bit;
        }
      }
      blockedAt[point] = isBlocked ? 1 : 0;
      maskAt[point] = mask;
    }
    const blocked = (point: number): boolean => blockedAt[point] === 1;
    const crossCost = (a: number, b: number): number => {
      let diff = (maskAt[a] as number) ^ (maskAt[b] as number);
      let count = 0;
      while (diff) {
        count += diff & 1;
        diff >>= 1;
      }
      return count * MAP_LAYOUT.borderCost;
    };
    const ports = (
      leaf: InnerLeaf,
    ): Array<{ point: number; dir: number; border: [number, number] }> => {
      const cx = leaf.x + leaf.w / 2;
      const cy = leaf.y + leaf.h / 2;
      const list: Array<{
        x: number;
        y: number;
        dir: number;
        border: [number, number];
      }> = [
        {
          x: leaf.x + leaf.w + m,
          y: cy,
          dir: 0,
          border: [leaf.x + leaf.w, cy],
        },
        {
          x: cx,
          y: leaf.y + leaf.h + m,
          dir: 1,
          border: [cx, leaf.y + leaf.h],
        },
        { x: leaf.x - m, y: cy, dir: 2, border: [leaf.x, cy] },
        { x: cx, y: leaf.y - m, dir: 3, border: [cx, leaf.y] },
      ];
      return list
        .map((port) => ({
          point:
            (yIndex.get(port.y) as number) * nx +
            (xIndex.get(port.x) as number),
          dir: port.dir,
          border: port.border,
        }))
        .filter((port) => !blocked(port.point));
    };
    const sides = overrides[edge.id]?.ends;
    const bySide = (
      list: ReturnType<typeof ports>,
      side: MapSide | undefined,
    ) => {
      if (side === undefined) return list;
      const picked = list.filter((port) => port.dir === SIDE_DIRECTION[side]);
      return picked.length > 0 ? picked : list;
    };
    const starts = bySide(ports(source), sides?.from);
    const goals = bySide(ports(target), sides?.to);
    const pointOf = ([x, y]: [number, number]): number =>
      (yIndex.get(y) as number) * nx + (xIndex.get(x) as number);
    const via = (vias.get(edge.id) ?? []).filter(
      (point) => !blocked(pointOf(point)),
    );
    /** 始まりの状態から、着く点のどれかまでの経路を探す（着いた点の状態と、点の列を返す） */
    const search = (
      from: Array<{ point: number; dir: number }>,
      to: Set<number>,
      goalMask: number,
      center: { x: number; y: number; w: number; h: number },
    ): { reached: number; path: Array<[number, number]> } => {
      // 残りの距離と、まだ出入りしていない祖先の枠の数（どちらも少なく見積もる）
      const heuristic = (point: number): number => {
        let diff = (maskAt[point] as number) ^ goalMask;
        let count = 0;
        while (diff) {
          count += diff & 1;
          diff >>= 1;
        }
        const distance =
          Math.abs((xs[point % nx] as number) - center.x) +
          Math.abs((ys[Math.floor(point / nx)] as number) - center.y) -
          center.w / 2 -
          center.h / 2;
        return Math.max(0, distance) + count * MAP_LAYOUT.borderCost;
      };
      const best = new Float64Array(nx * ny * 4).fill(Number.POSITIVE_INFINITY);
      const back = new Int32Array(nx * ny * 4).fill(-1);
      const heap = createHeap();
      for (const start of from) {
        const state = start.point * 4 + start.dir;
        best[state] = 0;
        heap.push(heuristic(start.point), state);
      }
      let reached = -1;
      while (heap.size() > 0) {
        const state = heap.pop() as number;
        const point = state >> 2;
        const dir = state & 3;
        if (to.has(point)) {
          reached = state;
          break;
        }
        const cost = best[state] as number;
        const i = point % nx;
        const j = Math.floor(point / nx);
        for (let d = 0; d < 4; d++) {
          if (d === ((dir + 2) & 3)) {
            continue;
          }
          const ni = i + (DX[d] as number);
          const nj = j + (DY[d] as number);
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) {
            continue;
          }
          const next = nj * nx + ni;
          if (blocked(next)) {
            continue;
          }
          const length =
            Math.abs((xs[ni] as number) - (xs[i] as number)) +
            Math.abs((ys[nj] as number) - (ys[j] as number));
          const nextCost =
            cost +
            length +
            (d === dir ? 0 : MAP_LAYOUT.bendCost) +
            crossCost(point, next);
          const nextState = next * 4 + d;
          if (nextCost < (best[nextState] as number)) {
            best[nextState] = nextCost;
            back[nextState] = state;
            heap.push(nextCost + heuristic(next), nextState);
          }
        }
      }
      if (reached < 0) {
        throw new Error(`線を引けません: ${edge.id}`);
      }
      const path: Array<[number, number]> = [];
      for (let state = reached; state >= 0; state = back[state] as number) {
        const point = state >> 2;
        path.unshift([
          xs[point % nx] as number,
          ys[Math.floor(point / nx)] as number,
        ]);
      }
      return { reached, path };
    };
    // 始まり → 経由点 → 終わりの区間ごとに探してつなぐ
    const legs: Array<{
      to: Set<number>;
      mask: number;
      center: { x: number; y: number; w: number; h: number };
    }> = [
      ...via.map(([x, y]) => ({
        to: new Set([pointOf([x, y])]),
        mask: maskAt[pointOf([x, y])] as number,
        center: { x, y, w: 0, h: 0 },
      })),
      {
        to: new Set(goals.map((goal) => goal.point)),
        mask: goals[0] === undefined ? 0 : (maskAt[goals[0].point] as number),
        center: {
          x: target.x + target.w / 2,
          y: target.y + target.h / 2,
          w: target.w,
          h: target.h,
        },
      },
    ];
    let from: Array<{ point: number; dir: number }> = starts;
    let reached = -1;
    const path: Array<[number, number]> = [];
    for (const leg of legs) {
      const found = search(from, leg.to, leg.mask, leg.center);
      path.push(...(path.length === 0 ? found.path : found.path.slice(1)));
      reached = found.reached;
      from = [{ point: reached >> 2, dir: reached & 3 }];
    }
    const startPort = starts.find(
      (start) => path[0] !== undefined && start.point === pointOf(path[0]),
    );
    const goal = goals.find((item) => item.point === reached >> 2);
    const points: Array<[number, number]> = [
      ...(startPort ? [startPort.border] : []),
      ...path,
      ...(goal ? [goal.border] : []),
    ];
    const kept = new Set(via.map(([x, y]) => `${x},${y}`));
    // 同じ向きに続く点を 1 つにまとめる
    const simplified = points.filter((p, index) => {
      const prev = points[index - 1];
      const next = points[index + 1];
      if (!prev || !next || kept.has(`${p[0]},${p[1]}`)) return true;
      return !(
        (prev[0] === p[0] && p[0] === next[0]) ||
        (prev[1] === p[1] && p[1] === next[1])
      );
    });
    return { ...edge, points: simplified };
  });
};

/** 構成図と見せ方と上書きから、ノード・グループ・線の配置を返す */
export const layoutMap = (
  chart: Flowchart,
  view: MapView,
  overrides: Record<string, MapOverride>,
  nodeFit: "height" | "width",
): MapLayout => {
  const maxWidth =
    nodeFit === "width" ? MAP_LAYOUT.maxWidthWide : MAP_LAYOUT.maxWidth;
  const { root, edges } = buildView(chart, view, overrides, maxWidth);
  const links = edges.map((edge): [string, string] => [edge.from, edge.to]);
  const placed = new Map<string, Local[]>();
  layoutBox(root, links, overrides, placed);
  const leaves: InnerLeaf[] = [];
  const boxes: Array<PlacedGroup> = [];
  /** ノードの上に空けた場所 */
  const reserved: Array<Rect & { id: string }> = [];
  const walk = (
    box: ViewBox,
    ox: number,
    oy: number,
    ancestors: string[],
  ): void => {
    for (const local of placed.get(box.id) ?? []) {
      const x = ox + local.x;
      const y = oy + local.y;
      const item = local.item;
      if (item.kind === "leaf") {
        if (item.above > 0)
          reserved.push({
            id: `${item.id}::above`,
            x: x + item.aside,
            y,
            w: item.w - item.aside * 2,
            h: item.above,
          });
        leaves.push({
          id: item.id,
          x: x + item.aside,
          y: y + item.above,
          w: item.w - item.aside * 2,
          h: item.h - item.above,
          lines: item.lines,
          faded: item.faded,
          ancestors,
          collapsed: item.collapsed,
          title: item.label,
        });
      } else {
        boxes.push({
          id: item.id,
          title: item.title,
          x,
          y,
          w: item.w,
          h: item.h,
          ancestors,
          collapsed: false,
          faded: false,
        });
        walk(item, x, y, [item.id, ...ancestors]);
      }
    }
  };
  const margin = MAP_LAYOUT.margin;
  walk(root, margin, margin, []);
  const edgeById = new Map(chart.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(chart.nodes.map((node) => [node.id, node]));
  const wires = routeEdges(leaves, boxes, edges, overrides, reserved).map(
    (wire) => {
      const first = wire.merged?.[0];
      const source =
        edgeById.get(wire.id) ??
        (first === undefined
          ? undefined
          : chart.edges.find(
              (edge) => edge.from === first.from && edge.to === first.to,
            ));
      return {
        ...wire,
        arrow: source?.arrow ?? "-->",
        both: source?.both ?? false,
      };
    },
  );
  const nodes: PlacedNode[] = [];
  const groups: PlacedGroup[] = [...boxes];
  const groupParent = new Map(
    chart.groups.map((group) => [group.id, group.parent]),
  );
  /** グループの中（入れ子のグループの中を含む）のノードの数 */
  const countIn = (id: string): number =>
    chart.nodes.filter((item) => {
      for (let at = item.parent; at !== undefined; at = groupParent.get(at))
        if (at === id) return true;
      return false;
    }).length;
  for (const leaf of leaves) {
    const { collapsed, title, ...node } = leaf;
    if (collapsed)
      groups.push({
        id: node.id,
        title,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        ancestors: node.ancestors,
        collapsed: true,
        faded: node.faded,
        count: countIn(node.id),
      });
    else
      nodes.push({
        ...node,
        label: title,
        classes: nodeById.get(node.id)?.classes ?? [],
      });
  }
  return {
    width: root.w + margin * 2,
    height: root.h + margin * 2,
    nodes,
    groups,
    wires,
  };
};
