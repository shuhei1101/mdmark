import type { MapSide } from "./data.ts";
import type { Direction, FlowArrow, Flowchart } from "./flowchart.ts";

/** 描いた文書の CSS の `.mdmark-diagram-node` と同じ文字の大きさ（px）・行の高さの倍率・余白（px）。CSS を修正したときは合わせて修正する */
export const LABEL_METRICS = {
  kindSize: 11,
  nameSize: 14,
  subSize: 12,
  lineHeight: 1.4,
  padY: 6,
  padX: 10,
};

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

/** 全角を文字の大きさ、半角を 0.6 倍の幅として、幅に収まるように行に分ける */
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
  fit: {
    maxWidth: number;
    width: number | undefined;
    size: { w: number; h: number } | undefined;
  },
): { w: number; h: number; lines: string[] } => {
  const { maxWidth, width, size } = fit;
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

/** 描く木を作るときに繰り返し引く値 */
type ViewContext = {
  chart: Flowchart;
  overrides: Record<string, MapOverride>;
  maxWidth: number;
  /** 閉じたグループ */
  collapsed: Set<string>;
};

/** 要素の祖先のグループ（内側から）を返す関数 */
const chainOf = (chart: Flowchart): ((id: string) => string[]) => {
  const boxParent = new Map(chart.groups.map((box) => [box.id, box.parent]));
  const parentOf = (id: string): string | undefined =>
    chart.nodes.find((node) => node.id === id)?.parent ?? boxParent.get(id);
  return (id) => {
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
};

/** 線の端を読み替えた、表示する葉と、薄く残すか */
type Visible = { id: string; faded: boolean };

/** 線の端を、表示する葉に読み替える関数 */
const visibleOfView = (
  chart: Flowchart,
  view: { enter: string | undefined; collapsed: Set<string> },
): ((nodeId: string) => Visible) => {
  const { enter, collapsed } = view;
  const chain = chainOf(chart);
  const inEntered = (id: string): boolean =>
    enter === undefined || chain(id).includes(enter) || id === enter;
  return (nodeId) => {
    const ancestors = chain(nodeId).reverse();
    if (!inEntered(nodeId)) {
      // 入った箱の外は、入った箱を含まない最も外側の要素に畳んで薄く残す
      const enterChain = chain(enter as string);
      const outer = ancestors.find(
        (box) => box !== enter && !enterChain.includes(box),
      );
      return { id: outer ?? nodeId, faded: true };
    }
    const closed = ancestors.find((box) => collapsed.has(box));
    return { id: closed ?? nodeId, faded: false };
  };
};

/** 線を描く線に足す。閉じたグループへの線は、同じ両端の線を 1 本にまとめる */
const addViewWire = (
  merged: Map<string, ViewWire>,
  wire: {
    edge: Flowchart["edges"][number];
    from: Visible;
    to: Visible;
    original: MergedWire;
  },
): void => {
  const { edge, from, to, original } = wire;
  const toClosed = from.id !== edge.from || to.id !== edge.to;
  const key = toClosed ? `${from.id}->${to.id}` : edge.id;
  const found = merged.get(key);
  if (found) {
    found.merged?.push(original);
    found.label = undefined;
    return;
  }
  merged.set(key, {
    id: toClosed ? key : edge.id,
    from: from.id,
    to: to.id,
    label: toClosed ? undefined : edge.label,
    merged: toClosed ? [original] : undefined,
  });
};

/** 描く線と、線の端にする葉 */
const mergeViewWires = (
  chart: Flowchart,
  visibleOf: (nodeId: string) => Visible,
): { merged: Map<string, ViewWire>; used: Set<string> } => {
  const merged = new Map<string, ViewWire>();
  const used = new Set<string>();
  const labelOf = (id: string): string =>
    chart.nodes.find((node) => node.id === id)?.label ?? id;
  for (const edge of chart.edges) {
    const from = visibleOf(edge.from);
    const to = visibleOf(edge.to);
    if (from.id === to.id || (from.faded && to.faded)) {
      continue;
    }
    addViewWire(merged, {
      edge,
      from,
      to,
      original: {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        fromLabel: labelOf(edge.from),
        toLabel: labelOf(edge.to),
      },
    });
    used.add(from.id);
    used.add(to.id);
  }
  return { merged, used };
};

/** 入った箱の外に薄く残す葉（線の端になるものだけ） */
const fadedIdsOf = (
  chart: Flowchart,
  context: { visibleOf: (nodeId: string) => Visible; used: Set<string> },
): Set<string> => {
  const fadedIds = new Set<string>();
  for (const edge of chart.edges) {
    for (const end of [edge.from, edge.to]) {
      const visible = context.visibleOf(end);
      if (visible.faded && context.used.has(visible.id)) {
        fadedIds.add(visible.id);
      }
    }
  }
  return fadedIds;
};

/** 描く木の葉（ノードか閉じたグループ） */
const makeLeaf = (
  context: ViewContext,
  leaf: { id: string; label: string; faded: boolean; collapsedGroup?: boolean },
): ViewLeaf => {
  const { id, label, faded, collapsedGroup = false } = leaf;
  const override = context.overrides[id];
  const size = sizeLeaf(label, {
    maxWidth: context.maxWidth,
    width: override?.width,
    size: override?.size,
  });
  const above = collapsedGroup ? 0 : (override?.above ?? 0);
  const aside = collapsedGroup ? 0 : (override?.aside ?? 0);
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

/** 描く木の箱（中のグループとノード。中身の無い箱は除く） */
const makeBox = (
  context: ViewContext,
  box: { boxId: string | undefined; title: string; direction: Direction },
): ViewBox => {
  const { chart, collapsed } = context;
  const { boxId, title, direction } = box;
  const children: ViewItem[] = [];
  for (const group of chart.groups.filter((item) => item.parent === boxId)) {
    if (collapsed.has(group.id)) {
      children.push(
        makeLeaf(context, {
          id: group.id,
          label: group.title,
          faded: false,
          collapsedGroup: true,
        }),
      );
      continue;
    }
    const child = makeBox(context, {
      boxId: group.id,
      title: group.title,
      direction: group.direction ?? direction,
    });
    if (child.children.length > 0) {
      children.push(child);
    }
  }
  for (const node of chart.nodes.filter((item) => item.parent === boxId)) {
    children.push(
      makeLeaf(context, { id: node.id, label: node.label, faded: false }),
    );
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

/** 入った箱の外に薄く残す葉 */
const outsideLeaf = (context: ViewContext, id: string): ViewLeaf => {
  const { chart } = context;
  const box = chart.groups.find((item) => item.id === id);
  return makeLeaf(context, {
    id,
    label:
      box?.title ?? chart.nodes.find((node) => node.id === id)?.label ?? id,
    faded: true,
    collapsedGroup: box !== undefined,
  });
};

/** 中へ入ったときの描く木（入った箱と、外に薄く残す葉） */
const enteredRoot = (
  context: ViewContext,
  view: { enter: string; fadedIds: Set<string> },
): ViewBox => {
  const { chart } = context;
  const entered = chart.groups.find((box) => box.id === view.enter);
  if (!entered) {
    throw new Error(`入る箱がありません: ${view.enter}`);
  }
  const inner = makeBox(context, {
    boxId: entered.id,
    title: entered.title,
    direction: entered.direction ?? chart.direction,
  });
  const outside = [...view.fadedIds].map((id) => outsideLeaf(context, id));
  return {
    kind: "box",
    id: "",
    title: "",
    direction: chart.direction,
    children: [inner, ...outside],
    w: 0,
    h: 0,
  };
};

/** 中へ入る・閉じる・視点を当てた、描く木と線を作る */
const buildView = (
  chart: Flowchart,
  view: MapView,
  fit: { overrides: Record<string, MapOverride>; maxWidth: number },
): { root: ViewBox; edges: ViewWire[] } => {
  const enter = view.entered;
  const collapsed = new Set(view.collapsed ?? []);
  const visibleOf = visibleOfView(chart, { enter, collapsed });
  const { merged, used } = mergeViewWires(chart, visibleOf);
  const fadedIds = fadedIdsOf(chart, { visibleOf, used });
  const context: ViewContext = { chart, ...fit, collapsed };
  const root =
    enter === undefined
      ? makeBox(context, {
          boxId: undefined,
          title: "",
          direction: chart.direction,
        })
      : enteredRoot(context, { enter, fadedIds });
  return { root, edges: [...merged.values()] };
};

type Local = { item: ViewItem; x: number; y: number };

/** 閉路の戻りの線を外した線（深さ優先でたどった順） */
const forwardLinksOf = (
  ids: string[],
  links: Array<[string, string]>,
): Array<[string, string]> => {
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
  return forward;
};

/** 有向グラフの段を、閉路の戻りの線を外した最長路で決める */
const assignRanks = (
  ids: string[],
  links: Array<[string, string]>,
): Map<string, number> => {
  const forward = forwardLinksOf(ids, links);
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

/** 箱を配置するときに引く値 */
type BoxContext = {
  links: Array<[string, string]>;
  overrides: Record<string, MapOverride>;
  /** 箱の ID ごとの、箱の中身の配置 */
  placed: Map<string, Local[]>;
};

/** 子孫の線を、箱の直下の子どうしの線に持ち上げる */
const liftLinks = (
  box: ViewBox,
  links: Array<[string, string]>,
): Array<[string, string]> => {
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
  return lifted;
};

/** 段ごとの子の並び（align は相手と同じ段にする） */
const rankRows = (
  ids: string[],
  context: {
    lifted: Array<[string, string]>;
    overrides: Record<string, MapOverride>;
  },
): string[][] => {
  const rank = assignRanks(ids, context.lifted);
  for (const id of ids) {
    const target = context.overrides[id]?.align;
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
  return rows;
};

/** 段の中の並び順: 前の段の位置の重心で並べ替える（order の指定を先に置く） */
const orderRows = (
  rows: string[][],
  context: {
    lifted: Array<[string, string]>;
    overrides: Record<string, MapOverride>;
  },
): void => {
  const { lifted, overrides } = context;
  const position = new Map<string, number>();
  const score = (id: string, neighbors: (id: string) => string[]): number => {
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
  const sortRow = (
    row: string[],
    neighbors: (id: string) => string[],
  ): void => {
    row.sort((a, b) => score(a, neighbors) - score(b, neighbors));
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
};

/** 段の中の寄せる側の、最初の子の位置（既定は中央） */
const justifyStart = (
  justify: MapOverride["justify"],
  room: number,
): number => {
  if (justify === "start") return 0;
  return justify === "end" ? room : room / 2;
};

/** 段ごとに子を並べた、箱の中の位置 */
const placeRows = (
  box: ViewBox,
  context: {
    rows: string[][];
    overrides: Record<string, MapOverride>;
    vertical: boolean;
  },
): Local[] => {
  const { rows, overrides, vertical } = context;
  const byId = new Map(box.children.map((child) => [child.id, child]));
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
    let at = justifyStart(justify, widest - (rowCross[index] ?? 0));
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
  return locals;
};

/** 2 つの要素が、間を空けた範囲で重なるか */
const overlaps = (a: Local, b: Local, gap: number): boolean =>
  a.x < b.x + b.item.w + gap &&
  b.x < a.x + a.item.w + gap &&
  a.y < b.y + b.item.h + gap &&
  b.y < a.y + a.item.h + gap;

/** 要素を、重なる固定した要素と先に押し出した要素から、交差軸の向きへ離す。動かしたら `true` を返却する */
const pushLocal = (
  local: Local,
  context: { locals: Local[]; fixed: Local[]; vertical: boolean },
): boolean => {
  const { locals, fixed, vertical } = context;
  const gap = MAP_LAYOUT.gapItem;
  let moved = false;
  for (const other of locals) {
    if (other === local || !overlaps(local, other, gap)) continue;
    // 固定した要素と、先に押し出した要素から離す
    if (
      !fixed.includes(other) &&
      locals.indexOf(other) >= locals.indexOf(local)
    )
      continue;
    if (vertical) {
      local.x = other.x + other.item.w + gap;
    } else {
      local.y = other.y + other.item.h + gap;
    }
    moved = true;
  }
  return moved;
};

/** 座標の固定: 指定の位置に置き、重なる要素を交差軸の向きへ押し出す */
const pinLocals = (
  locals: Local[],
  context: { overrides: Record<string, MapOverride>; vertical: boolean },
): void => {
  const { overrides, vertical } = context;
  const fixed = locals.filter(
    (local) => overrides[local.item.id]?.pos !== undefined,
  );
  for (const local of fixed) {
    const pos = overrides[local.item.id]?.pos as { x: number; y: number };
    // 固定の位置はノードの左上。ノードの左と上に空ける分だけずらして配置する
    local.x = pos.x - (local.item.kind === "leaf" ? local.item.aside : 0);
    local.y = pos.y - (local.item.kind === "leaf" ? local.item.above : 0);
  }
  for (let pass = 0; pass < locals.length * 2; pass++) {
    if (!pushApart({ locals, fixed, vertical })) {
      break;
    }
  }
};

/** 固定していない要素を 1 回ずつ押し出す。どれかを動かしたら `true` を返却する */
const pushApart = (context: {
  locals: Local[];
  fixed: Local[];
  vertical: boolean;
}): boolean => {
  let moved = false;
  for (const local of context.locals) {
    if (!context.fixed.includes(local) && pushLocal(local, context))
      moved = true;
  }
  return moved;
};

/** 中身を左上へ寄せて箱の大きさを決め、余白とタイトルの分ずらした中身の配置を記録する */
const storeBox = (
  box: ViewBox,
  context: { locals: Local[]; placed: Map<string, Local[]> },
): void => {
  const { locals, placed } = context;
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

/** 箱の中身を、内側の箱から先に配置して大きさを決める */
const layoutBox = (box: ViewBox, context: BoxContext): void => {
  for (const child of box.children) {
    if (child.kind === "box") {
      layoutBox(child, context);
    }
  }
  const { links, overrides, placed } = context;
  const lifted = liftLinks(box, links);
  const rows = rankRows(
    box.children.map((child) => child.id),
    { lifted, overrides },
  );
  orderRows(rows, { lifted, overrides });
  const vertical = box.direction === "TB";
  const locals = placeRows(box, { rows, overrides, vertical });
  pinLocals(locals, { overrides, vertical });
  storeBox(box, { locals, placed });
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

/** 線を引く格子（通り道の左右と上下の位置と、点ごとの内側にある矩形の番号） */
type Grid = {
  xs: number[];
  ys: number[];
  nx: number;
  ny: number;
  /** 格子の点ごとに、内側にある矩形の番号 */
  inside: number[][];
  indexOfRect: Map<string, number>;
  xIndex: Map<number, number>;
  yIndex: Map<number, number>;
};

/** 線を引く矩形（葉・箱・ノードの上に空けた場所） */
type RouteRect = Rect & { id: string; leaf: boolean };

/** 向きの番号ごとの、格子の左右と上下の進み */
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** 矩形の周りと中心、箱の枠の内側と経由点を通り道にした格子 */
const gridOf = (
  rects: RouteRect[],
  vias: Map<string, Array<[number, number]>>,
): Grid => {
  const m = MAP_LAYOUT.clearance;
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
  const inside: number[][] = [];
  for (const y of ys) {
    for (const x of xs) {
      inside.push(
        rects.flatMap((rect, index) =>
          strictlyInside(x, y, rect) ? [index] : [],
        ),
      );
    }
  }
  return {
    xs,
    ys,
    nx: xs.length,
    ny: ys.length,
    inside,
    indexOfRect: new Map(rects.map((rect, index) => [rect.id, index])),
    xIndex: new Map(xs.map((x, i) => [x, i])),
    yIndex: new Map(ys.map((y, j) => [y, j])),
  };
};

/** 格子の点の番号 */
const pointIndex = (grid: Grid, [x, y]: [number, number]): number =>
  (grid.yIndex.get(y) as number) * grid.nx + (grid.xIndex.get(x) as number);

/** 立っているビットの数 */
const bitCount = (value: number): number => {
  let diff = value;
  let count = 0;
  while (diff) {
    count += diff & 1;
    diff >>= 1;
  }
  return count;
};

/** 線ごとの、格子の点の通れなさと、片方だけの祖先の箱の内側にあるかのビット */
type Cells = { blockedAt: Uint8Array; maskAt: Uint8Array };

/** 格子の点 1 つの通れなさと、片方だけの祖先の箱のビット */
const cellOf = (
  list: number[],
  ancestry: {
    allowed: Set<number | undefined>;
    lca: number | undefined;
    crossing: number[];
  },
): { blocked: boolean; mask: number } => {
  const { allowed, lca, crossing } = ancestry;
  let blocked = lca !== undefined && !list.includes(lca);
  let mask = 0;
  for (const index of list) {
    if (!allowed.has(index)) {
      blocked = true;
    }
    const bit = crossing.indexOf(index);
    if (bit >= 0) {
      mask |= 1 << bit;
    }
  }
  return { blocked, mask };
};

/** 端点とその祖先以外の矩形の中と、共通の祖先の外を通れなくし、片方だけの祖先の箱（枠を 1 回ずつ出入りする箱）を、点ごとのビットにする */
const cellsOf = (
  grid: Grid,
  ancestors: { from: string[]; to: string[] },
): Cells => {
  const { from, to } = ancestors;
  const allowed = new Set(
    [...from, ...to].map((id) => grid.indexOfRect.get(id)),
  );
  const common = from.filter((id) => to.includes(id));
  const lca =
    common[0] === undefined ? undefined : grid.indexOfRect.get(common[0]);
  const crossing = [...from, ...to]
    .filter((id) => !common.includes(id))
    .map((id) => grid.indexOfRect.get(id) as number);
  const total = grid.nx * grid.ny;
  const blockedAt = new Uint8Array(total);
  const maskAt = new Uint8Array(total);
  for (let point = 0; point < total; point++) {
    const cell = cellOf(grid.inside[point] as number[], {
      allowed,
      lca,
      crossing,
    });
    blockedAt[point] = cell.blocked ? 1 : 0;
    maskAt[point] = cell.mask;
  }
  return { blockedAt, maskAt };
};

/** 線の出入り口（格子の点・出ていく向き・ノードの辺の上の点） */
type Port = { point: number; dir: number; border: [number, number] };

/** ノードの 4 辺の出入り口のうち、通れるもの */
const portsOf = (
  grid: Grid,
  context: { leaf: InnerLeaf; cells: Cells },
): Port[] => {
  const { leaf, cells } = context;
  const m = MAP_LAYOUT.clearance;
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
      point: pointIndex(grid, [port.x, port.y]),
      dir: port.dir,
      border: port.border,
    }))
    .filter((port) => cells.blockedAt[port.point] !== 1);
};

/** 補足の ends の辺の出入り口（その辺が通れなければ全ての出入り口） */
const bySide = (list: Port[], side: MapSide | undefined): Port[] => {
  if (side === undefined) return list;
  const picked = list.filter((port) => port.dir === SIDE_DIRECTION[side]);
  return picked.length > 0 ? picked : list;
};

/** 線 1 本の経路を探すときに引く値 */
type Routing = { grid: Grid; cells: Cells; edgeId: string };

/** 経路の区間 1 つ（着く点・着く点の祖先の箱のビット・着く先の中心と大きさ） */
type Leg = {
  to: Set<number>;
  mask: number;
  center: { x: number; y: number; w: number; h: number };
};

/** 残りの距離と、まだ出入りしていない祖先の枠の数（どちらも少なく見積もる） */
const heuristicOf = (
  routing: Routing,
  leg: Leg,
): ((point: number) => number) => {
  const { grid, cells } = routing;
  const { center } = leg;
  return (point) => {
    const count = bitCount((cells.maskAt[point] as number) ^ leg.mask);
    const distance =
      Math.abs((grid.xs[point % grid.nx] as number) - center.x) +
      Math.abs((grid.ys[Math.floor(point / grid.nx)] as number) - center.y) -
      center.w / 2 -
      center.h / 2;
    return Math.max(0, distance) + count * MAP_LAYOUT.borderCost;
  };
};

/** 状態（点 × 向き）から、戻らずに 1 つ進める状態ごとに `visit` を呼ぶ（曲がると重み、片方だけの祖先の枠を出入りすると重み） */
const visitSteps = (
  routing: Routing,
  state: number,
  visit: (next: number, cost: number) => void,
): void => {
  const { grid, cells } = routing;
  const { xs, ys, nx, ny } = grid;
  const point = state >> 2;
  const dir = state & 3;
  const i = point % nx;
  const j = Math.floor(point / nx);
  for (let d = 0; d < 4; d++) {
    const ni = i + (DX[d] as number);
    const nj = j + (DY[d] as number);
    const next = nj * nx + ni;
    if (
      d === ((dir + 2) & 3) ||
      ni < 0 ||
      nj < 0 ||
      ni >= nx ||
      nj >= ny ||
      cells.blockedAt[next] === 1
    ) {
      continue;
    }
    const length =
      Math.abs((xs[ni] as number) - (xs[i] as number)) +
      Math.abs((ys[nj] as number) - (ys[j] as number));
    const cross =
      bitCount(
        (cells.maskAt[point] as number) ^ (cells.maskAt[next] as number),
      ) * MAP_LAYOUT.borderCost;
    visit(next * 4 + d, length + (d === dir ? 0 : MAP_LAYOUT.bendCost) + cross);
  }
};

/** 着いた状態から始まりまで戻った点の列 */
const pathOf = (
  grid: Grid,
  trace: { reached: number; back: Int32Array },
): Array<[number, number]> => {
  const path: Array<[number, number]> = [];
  for (
    let state = trace.reached;
    state >= 0;
    state = trace.back[state] as number
  ) {
    const point = state >> 2;
    path.unshift([
      grid.xs[point % grid.nx] as number,
      grid.ys[Math.floor(point / grid.nx)] as number,
    ]);
  }
  return path;
};

/** 始まりの状態から、着く点のどれかまでの経路を探す（着いた点の状態と、点の列を返す） */
const search = (
  routing: Routing,
  leg: Leg & { from: Array<{ point: number; dir: number }> },
): { reached: number; path: Array<[number, number]> } => {
  const { grid } = routing;
  const heuristic = heuristicOf(routing, leg);
  const best = new Float64Array(grid.nx * grid.ny * 4).fill(
    Number.POSITIVE_INFINITY,
  );
  const back = new Int32Array(grid.nx * grid.ny * 4).fill(-1);
  const heap = createHeap();
  for (const start of leg.from) {
    const state = start.point * 4 + start.dir;
    best[state] = 0;
    heap.push(heuristic(start.point), state);
  }
  let current = -1;
  const relax = (next: number, cost: number): void => {
    const nextCost = (best[current] as number) + cost;
    if (nextCost < (best[next] as number)) {
      best[next] = nextCost;
      back[next] = current;
      heap.push(nextCost + heuristic(next >> 2), next);
    }
  };
  let reached = -1;
  while (heap.size() > 0) {
    current = heap.pop() as number;
    if (leg.to.has(current >> 2)) {
      reached = current;
      break;
    }
    visitSteps(routing, current, relax);
  }
  if (reached < 0) {
    throw new Error(`線を引けません: ${routing.edgeId}`);
  }
  return { reached, path: pathOf(grid, { reached, back }) };
};

/** 始まり → 経由点 → 終わりの区間 */
const legsOf = (
  routing: Routing,
  ends: { via: Array<[number, number]>; goals: Port[]; target: InnerLeaf },
): Leg[] => {
  const { grid, cells } = routing;
  const { via, goals, target } = ends;
  return [
    ...via.map(([x, y]) => ({
      to: new Set([pointIndex(grid, [x, y])]),
      mask: cells.maskAt[pointIndex(grid, [x, y])] as number,
      center: { x, y, w: 0, h: 0 },
    })),
    {
      to: new Set(goals.map((goal) => goal.point)),
      mask:
        goals[0] === undefined ? 0 : (cells.maskAt[goals[0].point] as number),
      center: {
        x: target.x + target.w / 2,
        y: target.y + target.h / 2,
        w: target.w,
        h: target.h,
      },
    },
  ];
};

/** 区間ごとに探してつなぐ（着いた状態と、点の列を返す） */
const walkLegs = (
  routing: Routing,
  route: { starts: Port[]; legs: Leg[] },
): { reached: number; path: Array<[number, number]> } => {
  let from: Array<{ point: number; dir: number }> = route.starts;
  let reached = -1;
  const path: Array<[number, number]> = [];
  for (const leg of route.legs) {
    const found = search(routing, { ...leg, from });
    path.push(...(path.length === 0 ? found.path : found.path.slice(1)));
    reached = found.reached;
    from = [{ point: reached >> 2, dir: reached & 3 }];
  }
  return { reached, path };
};

/** 同じ向きに続く点を 1 つにまとめる（経由点は残す） */
const simplifyPoints = (
  points: Array<[number, number]>,
  via: Array<[number, number]>,
): Array<[number, number]> => {
  const kept = new Set(via.map(([x, y]) => `${x},${y}`));
  return points.filter((p, index) => {
    const prev = points[index - 1];
    const next = points[index + 1];
    if (!prev || !next || kept.has(`${p[0]},${p[1]}`)) return true;
    return !(
      (prev[0] === p[0] && p[0] === next[0]) ||
      (prev[1] === p[1] && p[1] === next[1])
    );
  });
};

/** 線を引くときに引く値 */
type RouteContext = {
  leaves: InnerLeaf[];
  overrides: Record<string, MapOverride>;
  vias: Map<string, Array<[number, number]>>;
  grid: Grid;
  ancestorsOf: Map<string, string[]>;
};

/** 線 1 本を引く */
const routeEdge = (context: RouteContext, edge: ViewWire): PlacedWire => {
  const { leaves, overrides, grid } = context;
  const source = leaves.find((leaf) => leaf.id === edge.from) as InnerLeaf;
  const target = leaves.find((leaf) => leaf.id === edge.to) as InnerLeaf;
  const cells = cellsOf(grid, {
    from: context.ancestorsOf.get(edge.from) ?? [],
    to: context.ancestorsOf.get(edge.to) ?? [],
  });
  const routing: Routing = { grid, cells, edgeId: edge.id };
  const sides = overrides[edge.id]?.ends;
  const starts = bySide(portsOf(grid, { leaf: source, cells }), sides?.from);
  const goals = bySide(portsOf(grid, { leaf: target, cells }), sides?.to);
  const via = (context.vias.get(edge.id) ?? []).filter(
    (point) => cells.blockedAt[pointIndex(grid, point)] !== 1,
  );
  const { reached, path } = walkLegs(routing, {
    starts,
    legs: legsOf(routing, { via, goals, target }),
  });
  const first = path[0];
  const startPort = starts.find(
    (start) => first !== undefined && start.point === pointIndex(grid, first),
  );
  const goal = goals.find((item) => item.point === reached >> 2);
  const points: Array<[number, number]> = [
    ...(startPort ? [startPort.border] : []),
    ...path,
    ...(goal ? [goal.border] : []),
  ];
  return { ...edge, points: simplifyPoints(points, via) };
};

/** 経由点を図の座標にする（両端の共通の祖先のグループの中身の左上、無ければ図の外の余白の内側が原点） */
const viaOf = (
  context: {
    leaves: InnerLeaf[];
    boxes: Array<Rect & { id: string }>;
    overrides: Record<string, MapOverride>;
  },
  edge: ViewWire,
): Array<[number, number]> => {
  const { leaves, boxes } = context;
  const via = context.overrides[edge.id]?.via ?? [];
  if (via.length === 0) return [];
  const fromAnc = leaves.find((leaf) => leaf.id === edge.from)?.ancestors ?? [];
  const toAnc = leaves.find((leaf) => leaf.id === edge.to)?.ancestors ?? [];
  const lca = fromAnc.find((id) => toAnc.includes(id));
  const group = boxes.find((box) => box.id === lca);
  const ox = group ? group.x + MAP_LAYOUT.groupPad : MAP_LAYOUT.margin;
  const oy = group
    ? group.y + MAP_LAYOUT.groupPad + MAP_LAYOUT.groupTitle
    : MAP_LAYOUT.margin;
  return via.map((point): [number, number] => [ox + point.x, oy + point.y]);
};

/** 縦横の折れ線で線を引く。端点とその祖先以外の矩形と、ノードの上に空けた場所を通らず、祖先の箱の枠の出入りを最少にする */
const routeEdges = (
  leaves: InnerLeaf[],
  boxes: Array<Rect & { id: string }>,
  options: {
    edges: ViewWire[];
    overrides: Record<string, MapOverride>;
    reserved?: Array<Rect & { id: string }>;
  },
): PlacedWire[] => {
  const { edges, overrides, reserved = [] } = options;
  const vias = new Map(
    edges.map((edge) => [edge.id, viaOf({ leaves, boxes, overrides }, edge)]),
  );
  const rects: RouteRect[] = [
    ...leaves.map((leaf) => ({ ...leaf, leaf: true })),
    ...boxes.map((box) => ({ ...box, leaf: false })),
    ...reserved.map((rect) => ({ ...rect, leaf: true })),
  ];
  const context: RouteContext = {
    leaves,
    overrides,
    vias,
    grid: gridOf(rects, vias),
    ancestorsOf: new Map(leaves.map((leaf) => [leaf.id, leaf.ancestors])),
  };
  return edges.map((edge) => routeEdge(context, edge));
};

/** 構成図と見せ方と上書きから、ノード・グループ・線の配置を返す */
export const layoutMap = (
  chart: Flowchart,
  view: MapView,
  options: {
    overrides: Record<string, MapOverride>;
    nodeFit: "height" | "width";
  },
): MapLayout => {
  const { overrides, nodeFit } = options;
  const maxWidth =
    nodeFit === "width" ? MAP_LAYOUT.maxWidthWide : MAP_LAYOUT.maxWidth;
  const { root, edges } = buildView(chart, view, { overrides, maxWidth });
  const links = edges.map((edge): [string, string] => [edge.from, edge.to]);
  const placed = new Map<string, Local[]>();
  layoutBox(root, { links, overrides, placed });
  const leaves: InnerLeaf[] = [];
  const boxes: Array<PlacedGroup> = [];
  /** ノードの上に空けた場所 */
  const reserved: Array<Rect & { id: string }> = [];
  const walk = (
    box: ViewBox,
    origin: { ox: number; oy: number; ancestors: string[] },
  ): void => {
    const { ox, oy, ancestors } = origin;
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
        walk(item, { ox: x, oy: y, ancestors: [item.id, ...ancestors] });
      }
    }
  };
  const margin = MAP_LAYOUT.margin;
  walk(root, { ox: margin, oy: margin, ancestors: [] });
  const edgeById = new Map(chart.edges.map((edge) => [edge.id, edge]));
  const nodeById = new Map(chart.nodes.map((node) => [node.id, node]));
  const wires = routeEdges(leaves, boxes, { edges, overrides, reserved }).map(
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
