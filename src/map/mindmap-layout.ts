import type { Mindmap, MindmapItem } from "./mindmap.ts";

/** マインドマップの配置の寸法（px）。持ち手の幅は 28px のボタン 2 つと間 4px に余白を加えた幅 */
export const MINDMAP_LAYOUT = {
  gapX: 72,
  gapY: 16,
  margin: 32,
  gripWidth: 64,
  itemWidth: 120,
  itemHeight: 40,
} as const;

/** 1 レイヤー目の枝に記載順で割り当てる色の名前 */
export const MINDMAP_BRANCH_COLORS = [
  "blue",
  "green",
  "orange",
  "purple",
  "red",
  "yellow",
] as const;

/** 項目の側（今の図の根か、根の左右のどちらか） */
export type MindmapSide = "root" | "left" | "right";

/** 項目 1 つの位置と描き方 */
export type MindmapPlacement = {
  stateKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: MindmapSide;
  color: string | undefined;
  /** 持ち手を付けるか（今の図の根は付けない） */
  hasChildren: boolean;
  /** 子孫の項目の数 */
  descendants: number;
};

/** 親から子への曲線 1 本 */
export type MindmapCurve = {
  from: string;
  to: string;
  d: string;
  color: string | undefined;
};

/** `layoutMindmap` の戻り値 */
export type MindmapLayout = {
  items: MindmapPlacement[];
  curves: MindmapCurve[];
  width: number;
  height: number;
};

/** 項目の大きさ */
type Size = { width: number; height: number };

/** 項目が属する全体の図の根からの 1 レイヤー目の枝の記載順で、枝の色の名前を返却する */
export const mindmapBranchColor = (options: {
  mindmap: Mindmap;
  item: MindmapItem;
}): string | undefined => {
  const { mindmap, item } = options;
  const root = mindmap.root;
  if (!root || item.order === root.order) return undefined;
  let branch = item;
  while (branch.parent !== undefined && branch.parent !== root.order) {
    const parent = mindmap.items[branch.parent];
    if (!parent) break;
    branch = parent;
  }
  const at = root.children.indexOf(branch.order);
  return MINDMAP_BRANCH_COLORS[at % MINDMAP_BRANCH_COLORS.length];
};

/** 子孫の項目の数 */
const descendantsOf = (mindmap: Mindmap, item: MindmapItem): number =>
  item.children.reduce((sum, order) => {
    const child = mindmap.items[order];
    return sum + 1 + (child ? descendantsOf(mindmap, child) : 0);
  }, 0);

/** 配置の途中で引く値 */
type Context = {
  mindmap: Mindmap;
  top: MindmapItem;
  collapsed: ReadonlySet<string>;
  sizes: ReadonlyMap<string, Size>;
  /** 項目の `order` ごとの、子孫を含めて占める高さ */
  blocks: Map<number, number>;
};

/** 項目の大きさ（測っていなければ既定の大きさ） */
const sizeOf = (context: Context, item: MindmapItem): Size =>
  context.sizes.get(item.stateKey) ?? {
    width: MINDMAP_LAYOUT.itemWidth,
    height: MINDMAP_LAYOUT.itemHeight,
  };

/** 描く子（閉じた項目は無い） */
const shownChildren = (context: Context, item: MindmapItem): MindmapItem[] =>
  context.collapsed.has(item.stateKey)
    ? []
    : item.children.flatMap((order) => {
        const child = context.mindmap.items[order];
        return child ? [child] : [];
      });

/** 子の並びの高さ（子の占める高さと間の `gapY`） */
const childrenHeight = (context: Context, kids: MindmapItem[]): number =>
  kids.reduce(
    (sum, kid, at) =>
      sum +
      (context.blocks.get(kid.order) ?? 0) +
      (at > 0 ? MINDMAP_LAYOUT.gapY : 0),
    0,
  );

/** 子孫を含めて占める高さを求めて `blocks` に入れる */
const measureBlock = (context: Context, item: MindmapItem): number => {
  const kids = shownChildren(context, item);
  for (const kid of kids) measureBlock(context, kid);
  const block = Math.max(
    sizeOf(context, item).height,
    childrenHeight(context, kids),
  );
  context.blocks.set(item.order, block);
  return block;
};

/** 今の図の根の子を、占める高さの合計が小さい側（同じなら右）へ振り分ける */
const splitSides = (context: Context) => {
  const sides = { right: [] as MindmapItem[], left: [] as MindmapItem[] };
  const totals = { right: 0, left: 0 };
  for (const kid of shownChildren(context, context.top)) {
    const side = totals.right <= totals.left ? "right" : "left";
    sides[side].push(kid);
    totals[side] +=
      (context.blocks.get(kid.order) ?? 0) +
      (sides[side].length > 1 ? MINDMAP_LAYOUT.gapY : 0);
  }
  return { sides, totals };
};

/** 子を持つ項目か（今の図の根は持ち手を付けない） */
const hasGrip = (context: Context, item: MindmapItem): boolean =>
  item.order !== context.top.order && item.children.length > 0;

/** 側ごとのレイヤーの幅（項目の幅と持ち手の幅の最大） */
const columnWidths = (context: Context, kids: MindmapItem[]): number[] => {
  const widths: number[] = [];
  const visit = (item: MindmapItem, depth: number) => {
    const own =
      sizeOf(context, item).width +
      (hasGrip(context, item) ? MINDMAP_LAYOUT.gripWidth : 0);
    widths[depth] = Math.max(widths[depth] ?? 0, own);
    for (const kid of shownChildren(context, item)) visit(kid, depth + 1);
  };
  for (const kid of kids) visit(kid, 0);
  return widths;
};

/** 根の中心からレイヤーの内側の端までの横の距離 */
const columnOffset = (
  context: Context,
  widths: number[],
  depth: number,
): number => {
  let offset = sizeOf(context, context.top).width / 2 + MINDMAP_LAYOUT.gapX;
  for (let at = 0; at < depth; at += 1)
    offset += (widths[at] ?? 0) + MINDMAP_LAYOUT.gapX;
  return offset;
};

/** 片側の項目を、記載順に上から並べて配置する */
const placeSide = (
  context: Context,
  side: { name: "left" | "right"; kids: MindmapItem[]; start: number },
  placed: MindmapPlacement[],
): void => {
  const widths = columnWidths(context, side.kids);
  const place = (item: MindmapItem, depth: number, top: number) => {
    const size = sizeOf(context, item);
    const block = context.blocks.get(item.order) ?? size.height;
    const offset = columnOffset(context, widths, depth);
    placed.push({
      stateKey: item.stateKey,
      x: side.name === "right" ? offset : -offset - size.width,
      y: top + (block - size.height) / 2,
      width: size.width,
      height: size.height,
      side: side.name,
      color: mindmapBranchColor({ mindmap: context.mindmap, item }),
      hasChildren: hasGrip(context, item),
      descendants: descendantsOf(context.mindmap, item),
    });
    const kids = shownChildren(context, item);
    let cursor = top + (block - childrenHeight(context, kids)) / 2;
    for (const kid of kids) {
      place(kid, depth + 1, cursor);
      cursor += (context.blocks.get(kid.order) ?? 0) + MINDMAP_LAYOUT.gapY;
    }
  };
  let cursor = side.start;
  for (const kid of side.kids) {
    place(kid, 0, cursor);
    cursor += (context.blocks.get(kid.order) ?? 0) + MINDMAP_LAYOUT.gapY;
  }
};

/** 親から子への 3 次ベジェ曲線 */
const curveOf = (pair: {
  parent: MindmapPlacement;
  child: MindmapPlacement;
  plain: boolean;
}): string => {
  const { parent, child, plain } = pair;
  const right = child.side === "right";
  const grip = parent.hasChildren ? MINDMAP_LAYOUT.gripWidth : 0;
  const sx = right ? parent.x + parent.width + grip : parent.x - grip;
  const sy = parent.y + parent.height / 2;
  const ex = right ? child.x : child.x + child.width;
  const ey = plain ? child.y + child.height : child.y + child.height / 2;
  const mx = (sx + ex) / 2;
  return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
};

/** 描いた項目どうしの親から子への曲線 */
const curvesOf = (
  context: Context,
  placed: MindmapPlacement[],
): MindmapCurve[] => {
  const byKey = new Map(placed.map((item) => [item.stateKey, item]));
  return context.mindmap.items.flatMap((item) => {
    const child = byKey.get(item.stateKey);
    const parentItem =
      item.parent === undefined
        ? undefined
        : context.mindmap.items[item.parent];
    const parent = parentItem ? byKey.get(parentItem.stateKey) : undefined;
    if (!child || !parent || child.side === "root") return [];
    return [
      {
        from: parent.stateKey,
        to: child.stateKey,
        d: curveOf({ parent, child, plain: item.shape === "plain" }),
        color: child.color,
      },
    ];
  });
};

/** 全体を外周の余白から始まる座標にずらし、持ち手も含めた幅を求める */
const shiftInto = (placed: MindmapPlacement[]): number => {
  const { margin, gripWidth } = MINDMAP_LAYOUT;
  const grip = (item: MindmapPlacement, side: MindmapSide) =>
    item.side === side && item.hasChildren ? gripWidth : 0;
  const minX = Math.min(...placed.map((item) => item.x - grip(item, "left")));
  for (const item of placed) {
    item.x += margin - minX;
    item.y += margin;
  }
  return (
    Math.max(
      ...placed.map((item) => item.x + item.width + grip(item, "right")),
    ) + margin
  );
};

/** 今の図の根を中央に配置し、根の子を左右に振り分けて、深いレイヤーほど外へ並べる */
export const layoutMindmap = (options: {
  mindmap: Mindmap;
  top: string | undefined;
  collapsed: ReadonlySet<string>;
  sizes: ReadonlyMap<string, Size>;
}): MindmapLayout => {
  const { mindmap } = options;
  const top =
    mindmap.items.find((item) => item.stateKey === options.top) ?? mindmap.root;
  if (!top) return { items: [], curves: [], width: 0, height: 0 };
  const context: Context = {
    mindmap,
    top,
    collapsed: options.collapsed,
    sizes: options.sizes,
    blocks: new Map(),
  };
  measureBlock(context, top);
  const { sides, totals } = splitSides(context);
  const topSize = sizeOf(context, top);
  const height = Math.max(topSize.height, totals.right, totals.left);
  const placed: MindmapPlacement[] = [
    {
      stateKey: top.stateKey,
      x: -topSize.width / 2,
      y: (height - topSize.height) / 2,
      width: topSize.width,
      height: topSize.height,
      side: "root",
      color: mindmapBranchColor({ mindmap, item: top }),
      hasChildren: false,
      descendants: descendantsOf(mindmap, top),
    },
  ];
  for (const name of ["right", "left"] as const) {
    placeSide(
      context,
      { name, kids: sides[name], start: (height - totals[name]) / 2 },
      placed,
    );
  }
  const width = shiftInto(placed);
  return {
    items: placed,
    curves: curvesOf(context, placed),
    width,
    height: height + MINDMAP_LAYOUT.margin * 2,
  };
};
