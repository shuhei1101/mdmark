import { expect, test } from "vitest";
import { FLOW } from "../../helpers/map.ts";

/** 自動配置を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLayout = () => import("../../../../src/map/layout.ts");
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");

type Rect = { x: number; y: number; w: number; h: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 点が矩形の内側（辺を除く）にあるか */
const strictlyInside = (x: number, y: number, r: Rect) =>
  x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

/** 線分が矩形の内側を通るか（縦横の線分だけを扱う。線分の中点を細かく確かめる） */
const segmentCrosses = (a: [number, number], b: [number, number], r: Rect) => {
  for (let step = 0; step <= 20; step += 1) {
    const x = a[0] + ((b[0] - a[0]) * step) / 20;
    const y = a[1] + ((b[1] - a[1]) * step) / 20;
    if (strictlyInside(x, y, r)) return true;
  }
  return false;
};

/** 構成図を読んで配置する */
async function laid(
  view = {},
  overrides = {},
  {
    nodeFit = "height",
    source = FLOW,
    measureText,
  }: {
    nodeFit?: "height" | "width";
    source?: string;
    measureText?: (text: string) => number;
  } = {},
) {
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { parseFlowchart } = await loadFlowchart();
  return layoutMap(
    parseFlowchart(source),
    { collapsed: [], ...view },
    { overrides, nodeFit, measureText: measureText ?? estimateTextWidth },
  );
}

// 重なりと横切りが無い（正常系）
test("test_layout_map", async () => {
  // 準備・実行
  const layout = await laid();
  // 検証
  const items = [...layout.nodes, ...layout.groups];
  for (const [i, a] of items.entries()) {
    for (const b of items.slice(i + 1)) {
      const nested = a.ancestors?.includes(b.id) || b.ancestors?.includes(a.id);
      if (!nested) expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
    }
  }
  for (const wire of layout.wires) {
    const ends = new Set([wire.from, wire.to]);
    const allowed = new Set([
      ...ends,
      ...layout.nodes
        .filter((node) => ends.has(node.id))
        .flatMap((node) => node.ancestors),
      ...layout.groups
        .filter((group) => ends.has(group.id))
        .flatMap((group) => [group.id, ...group.ancestors]),
    ]);
    for (const rect of items.filter((item) => !allowed.has(item.id))) {
      for (const [k, point] of wire.points.slice(1).entries()) {
        const previous = wire.points[k] as [number, number];
        expect(
          segmentCrosses(previous, point, rect),
          `${wire.id} が ${rect.id} を横切る`,
        ).toBe(false);
      }
    }
  }
});

// 中へ入る（正常系）
test("test_layout_map_when_entered", async () => {
  // 準備・実行
  const layout = await laid({ entered: "read" });
  // 検証
  const read = layout.groups.find((group) => group.id === "read") as Rect;
  for (const node of layout.nodes) {
    if (node.ancestors.includes("read")) {
      expect(node.faded).toBe(false);
      expect(node.x >= read.x && node.x + node.w <= read.x + read.w).toBe(true);
    } else {
      expect(node.faded, node.id).toBe(true);
    }
  }
});

// 閉じる（正常系）
test("test_layout_map_when_collapsed", async () => {
  // 準備・実行
  const layout = await laid({ collapsed: ["store"] });
  // 検証
  expect(layout.groups.find((group) => group.id === "store")?.collapsed).toBe(
    true,
  );
  expect(
    layout.nodes.some((node) => node.id === "index" || node.id === "doc"),
  ).toBe(false);
  const toStore = layout.wires.filter(
    (wire) => wire.from === "store" || wire.to === "store",
  );
  const pairs = toStore.map((wire) => `${wire.from}-${wire.to}`);
  expect(new Set(pairs).size).toBe(pairs.length);
  expect(toStore.every((wire) => (wire.merged?.length ?? 0) >= 1)).toBe(true);
});

// 上書き（正常系）
test("test_layout_map_when_overrides", async () => {
  // 準備・実行
  const layout = await laid(
    {},
    {
      mermaid: { align: "marker" },
      data: { order: -1 },
      frame: { pos: { x: 0, y: 0 } },
    },
  );
  // 検証
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const lib = layout.groups.find((group) => group.id === "lib") as Rect;
  expect(byId.get("frame")?.x).toBe(lib.x + 24);
  expect(byId.get("frame")?.y).toBe(lib.y + 60);
  const marker = byId.get("marker") as Rect;
  const mermaid = byId.get("mermaid") as Rect;
  // 同じ段のノードは段の中で中心を揃えるので、どちらかの軸の中心が一致する
  const centerX = (rect: Rect) => rect.x + rect.w / 2;
  const centerY = (rect: Rect) => rect.y + rect.h / 2;
  expect(
    centerX(mermaid) === centerX(marker) ||
      centerY(mermaid) === centerY(marker),
  ).toBe(true);
});

// 測った大きさ（正常系）
test("test_layout_map_when_measured_size", async () => {
  // 準備・実行
  const layout = await laid({}, { mount: { size: { w: 300, h: 90 } } });
  // 検証
  expect(layout.nodes.find((node) => node.id === "mount")).toMatchObject({
    w: 300,
    h: 90,
  });
});

// node_fit が width（正常系）
test("test_layout_map_when_node_fit_width", async () => {
  // 準備
  const long = "あ".repeat(30);
  // 実行
  const layout = await laid(
    {},
    {},
    { nodeFit: "width", source: `flowchart LR\n  A["${long}"] --> B\n` },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A") as Rect;
  expect(node.w).toBeGreaterThan(220);
  expect(node.w).toBeLessThanOrEqual(360);
});

// 矩形を避ける（正常系）
test("test_route_wires", async () => {
  // 準備・実行
  const layout = await laid(
    {},
    { B: { align: "A" }, C: { align: "A" } },
    { nodeFit: "height", source: "flowchart LR\n  A --> B --> C\n  A --> C\n" },
  );
  // 検証
  const b = layout.nodes.find((node) => node.id === "B") as Rect;
  const wire = layout.wires.find(
    (item) => item.from === "A" && item.to === "C",
  );
  for (const [k, point] of (wire?.points ?? []).slice(1).entries()) {
    expect(segmentCrosses(wire?.points[k] as [number, number], point, b)).toBe(
      false,
    );
  }
});

// 祖先の枠の出入り（正常系）
test("test_route_wires_when_nested", async () => {
  // 準備・実行
  const layout = await laid(
    {},
    {},
    {
      nodeFit: "height",
      source:
        "flowchart LR\n  subgraph g [g]\n    A\n  end\n  subgraph h [h]\n    B\n  end\n  A --> B\n",
    },
  );
  // 検証
  const wire = layout.wires[0];
  for (const id of ["g", "h"]) {
    const group = layout.groups.find((item) => item.id === id) as Rect;
    let crossings = 0;
    for (const [k, point] of (wire?.points ?? []).slice(1).entries()) {
      const previous = wire?.points[k] as [number, number];
      const a = strictlyInside(previous[0], previous[1], group);
      const b = strictlyInside(point[0], point[1], group);
      if (a !== b) crossings += 1;
    }
    expect(crossings, id).toBe(1);
  }
});

// 寄せる（正常系）
test("test_layout_map_when_justify", async () => {
  // 準備
  const source =
    "flowchart TB\n  subgraph g [g]\n    A --> B\n    A --> C\n    A --> D\n  end\n";
  // 実行
  const start = await laid(
    {},
    { A: { justify: "start" } },
    { nodeFit: "height", source },
  );
  const end = await laid(
    {},
    { A: { justify: "end" } },
    { nodeFit: "height", source },
  );
  // 検証（グループの中身の左右の端はグループの内側の余白 24px の内側）
  const left = start.groups.find((item) => item.id === "g") as Rect;
  const a1 = start.nodes.find((item) => item.id === "A") as Rect;
  expect(a1.x).toBe(left.x + 24);
  const right = end.groups.find((item) => item.id === "g") as Rect;
  const a2 = end.nodes.find((item) => item.id === "A") as Rect;
  expect(a2.x + a2.w).toBe(right.x + right.w - 24);
});

// 端の辺（正常系）
test("test_route_wires_when_ends", async () => {
  // 準備・実行
  const layout = await laid(
    {},
    { "A->B": { ends: { from: "bottom", to: "top" } } },
    { nodeFit: "height", source: "flowchart LR\n  A --> B\n" },
  );
  // 検証
  const a = layout.nodes.find((node) => node.id === "A") as Rect;
  const b = layout.nodes.find((node) => node.id === "B") as Rect;
  const points = layout.wires[0]?.points ?? [];
  const first = points[0] as [number, number];
  const second = points[1] as [number, number];
  const beforeLast = points.at(-2) as [number, number];
  const last = points.at(-1) as [number, number];
  expect(first).toEqual([a.x + a.w / 2, a.y + a.h]);
  expect(last).toEqual([b.x + b.w / 2, b.y]);
  expect(second[0]).toBe(first[0]);
  expect(beforeLast[0]).toBe(last[0]);
});

// 経由点（正常系）
test("test_route_wires_when_via", async () => {
  // 準備・実行（図の全体の中身の左上は図の外の余白 24px の内側）
  const layout = await laid(
    {},
    { "A->B": { via: [{ x: 240, y: 300 }] } },
    { nodeFit: "height", source: "flowchart LR\n  A --> B\n" },
  );
  // 検証
  const points = layout.wires[0]?.points ?? [];
  expect(points).toContainEqual([264, 324]);
  for (const node of layout.nodes) {
    for (const [k, point] of points.slice(1).entries()) {
      const previous = points[k] as [number, number];
      const ends = node.id === "A" || node.id === "B";
      if (!ends) expect(segmentCrosses(previous, point, node)).toBe(false);
    }
  }
});

// 右の余白を加えた幅で 1 行に収まる名前（正常系）
test("test_layout_map_when_name_fits_with_right_padding", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  // 実行
  const layout = await laid(
    {},
    {},
    { source: "flowchart LR\n  A[データベース]\n" },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(125);
  expect(node?.h).toBe(leafHeight(1));
  expect(node?.lines).toHaveLength(1);
});

// 右の余白を除いた幅で折り返す名前（正常系）
test("test_layout_map_when_name_wraps_with_right_padding", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  const name = "あ".repeat(14);
  // 実行
  const layout = await laid(
    {},
    {},
    { nodeFit: "height", source: `flowchart LR\n  A[${name}]\n` },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(220);
  expect(node?.lines).toHaveLength(2);
  expect(node?.h).toBe(leafHeight(2));
});

// 幅を指定したノードの折り返し（正常系）
test("test_layout_map_when_width_with_right_padding", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  const name = "あ".repeat(12);
  // 実行
  const layout = await laid(
    {},
    { A: { width: 200 } },
    { source: `flowchart LR\n  A[${name}]\n` },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(200);
  expect(node?.lines).toHaveLength(2);
  expect(node?.h).toBe(leafHeight(2));
});

// 行の数の高さ（正常系）
test("test_leaf_height", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  // 実行
  const heights = [leafHeight(1), leafHeight(2)];
  // 検証
  expect(heights).toEqual([63, 83]);
});

/** 1 文字を決まった幅と測る関数 */
const perChar = (width: number) => (text: string) => [...text].length * width;

// 測った名前の幅で大きさを決める（正常系）
test("test_layout_map_when_measured_text_width", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  // 実行
  const layout = await laid(
    {},
    {},
    { source: "flowchart LR\n  A[Markdown]\n", measureText: perChar(12) },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(137);
  expect(node?.lines).toHaveLength(1);
  expect(node?.h).toBe(leafHeight(1));
});

// 測った幅で折り返す（正常系）
test("test_layout_map_when_measured_text_wraps", async () => {
  // 準備
  const { leafHeight } = await loadLayout();
  const name = "a".repeat(20);
  // 実行
  const layout = await laid(
    {},
    {},
    {
      nodeFit: "height",
      source: `flowchart LR\n  A[${name}]\n`,
      measureText: perChar(12),
    },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(220);
  expect(node?.lines).toEqual(["a".repeat(14), "a".repeat(6)]);
  expect(node?.h).toBe(leafHeight(2));
});

// pill の左の余白（正常系）
test("test_layout_map_when_pill_padding", async () => {
  // 準備・実行
  const layout = await laid(
    {},
    { A: { padLeft: 16 } },
    { source: "flowchart LR\n  A[利用側のページ]\n" },
  );
  // 検証
  const node = layout.nodes.find((item) => item.id === "A");
  expect(node?.w).toBe(145);
  expect(node?.lines).toHaveLength(1);
});

// 測った幅で折り返す（正常系）
test("test_split_lines_when_measure", async () => {
  // 準備
  const { splitLines } = await loadLayout();
  // 実行
  const lines = splitLines("abcdef", 30, perChar(10));
  // 検証
  expect(lines).toEqual(["abc", "def"]);
});

// 全角と半角の見積もり（正常系）
test("test_estimate_text_width", async () => {
  // 準備
  const { estimateTextWidth } = await loadLayout();
  // 実行
  const width = estimateTextWidth("文書の Markdown");
  // 検証
  expect(width).toBeCloseTo(117.6, 5);
});

// 閉じたグループのノードの数（正常系）
test("test_layout_map_when_collapsed_count", async () => {
  // 準備・実行
  const layout = await laid({ collapsed: ["read", "lib"] });
  // 検証
  const lib = layout.groups.find((group) => group.id === "lib");
  expect(lib?.collapsed).toBe(true);
  expect(lib?.count).toBe(7);
  for (const group of layout.groups.filter((item) => !item.collapsed))
    expect(group.count).toBeUndefined();
});

// ノードの上に空ける高さ（正常系）
test("test_layout_map_when_above", async () => {
  // 準備
  const plain = await laid();
  // 実行
  const layout = await laid({}, { mount: { above: 40 } });
  // 検証
  const before = plain.nodes.find((node) => node.id === "mount") as Rect;
  const node = layout.nodes.find((item) => item.id === "mount") as Rect;
  expect(node.h).toBe(before.h);
  for (const other of layout.nodes) {
    if (other.id === "mount") continue;
    expect(overlaps({ ...node, y: node.y - 40, h: node.h + 40 }, other)).toBe(
      false,
    );
  }
});

// 段を決める処理で使わない線（正常系）
test("test_layout_map_when_rankless", async () => {
  // 準備
  const source = "flowchart LR\n  a[a]\n  b[b]\n  a --- b\n";
  // 実行
  const layout = await laid(
    {},
    {
      "a->b": { rankless: true },
      a: { order: 0 },
      b: { align: "a", order: 1 },
    },
    { nodeFit: "height", source },
  );
  // 検証
  const a = layout.nodes.find((node) => node.id === "a") as Rect;
  const b = layout.nodes.find((node) => node.id === "b") as Rect;
  // 左から右の図の同じ段は、縦に並ぶ（x が同じで、b が a の後）
  expect(b.x + b.w / 2).toBeCloseTo(a.x + a.w / 2, 0);
  expect(b.y).toBeGreaterThan(a.y);
  const wire = layout.wires.find((item) => item.id === "a->b");
  expect(wire?.points.length ?? 0).toBeGreaterThanOrEqual(2);
});

// 閉じたグループの高さ（正常系）
test("test_layout_map_when_collapsed_height", async () => {
  // 準備・実行（測った大きさの高さ 30px は、2 つの行が収まる高さに満たない）
  const layout = await laid(
    { collapsed: ["store"] },
    { store: { size: { w: 120, h: 30 } } },
  );
  // 検証（タイトルの行 36px + 数の行 17px + 余白 上下 6px）
  const store = layout.groups.find((group) => group.id === "store");
  expect(store?.collapsed).toBe(true);
  expect(store?.h ?? 0).toBeGreaterThanOrEqual(59);
});

// 間を広げる（正常系）
test("test_layout_map_when_spread", async () => {
  // 準備
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { parseFlowchart } = await loadFlowchart();
  const chart = parseFlowchart("flowchart LR\n  A --> B\n  A --> C\n");
  const place = (spread?: number) =>
    layoutMap(
      chart,
      { collapsed: [] },
      {
        overrides: {},
        nodeFit: "height",
        spread,
        measureText: estimateTextWidth,
      },
    );
  // 実行
  const plain = place();
  const spread = place(16);
  // 検証（左から右の図の同じ段は縦に、隣の段は横に並ぶ）
  const nodeOf = (layout: typeof plain, id: string) =>
    layout.nodes.find((node) => node.id === id) as Rect;
  const gaps = (layout: typeof plain) => {
    const a = nodeOf(layout, "A");
    const b = nodeOf(layout, "B");
    const c = nodeOf(layout, "C");
    const [upper, lower] = b.y < c.y ? [b, c] : [c, b];
    return {
      item: lower.y - (upper.y + upper.h),
      rank: b.x - (a.x + a.w),
    };
  };
  expect(gaps(spread).item).toBe(gaps(plain).item + 16);
  expect(gaps(spread).rank).toBe(gaps(plain).rank + 16);
});

type Point = [number, number];

/** 2 本の線の、同じ向きで同じ直線の上に重なる区間の長さの合計 */
const collinearOverlap = (a: Point[], b: Point[]): number => {
  let total = 0;
  for (const [i, p] of a.slice(1).entries()) {
    const p0 = a[i] as Point;
    for (const [j, q] of b.slice(1).entries()) {
      const q0 = b[j] as Point;
      // 縦の区間どうしは x、横の区間どうしは y が同じときに重なる範囲を測る
      const axis =
        p0[0] === p[0] && q0[0] === q[0] && p0[0] === q0[0]
          ? 1
          : p0[1] === p[1] && q0[1] === q[1] && p0[1] === q0[1]
            ? 0
            : undefined;
      if (axis === undefined) continue;
      const low = Math.max(
        Math.min(p0[axis], p[axis]),
        Math.min(q0[axis], q[axis]),
      );
      const high = Math.min(
        Math.max(p0[axis], p[axis]),
        Math.max(q0[axis], q[axis]),
      );
      total += Math.max(0, high - low);
    }
  }
  return total;
};

/** 全ての 2 本の組の、同じ向きで同じ直線の上に重なる区間の長さの合計 */
const totalOverlap = (wires: Array<{ points: Point[] }>): number =>
  wires
    .flatMap((a, i) =>
      wires.slice(i + 1).map((b) => collinearOverlap(a.points, b.points)),
    )
    .reduce((sum, value) => sum + value, 0);

// 先に引いた線の区間を避ける（正常系）
test("test_route_wires_when_used", async () => {
  // 準備
  const { MAP_LAYOUT } = await loadLayout();
  const source =
    "flowchart LR\n  subgraph A [A]\n    a1\n    a2\n    a3\n  end\n  subgraph B [B]\n    b1\n    b2\n    b3\n  end\n  a1 --> b3\n  a2 --> b1\n  a3 --> b2\n";
  const options = { nodeFit: "height" as const, source };
  const weights = MAP_LAYOUT as Record<string, number>;
  const saved = weights.usedCost;
  // 実行
  weights.usedCost = 0;
  const free = await laid({}, {}, options);
  if (saved === undefined) delete weights.usedCost;
  else weights.usedCost = saved;
  const used = await laid({}, {}, options);
  // 検証
  expect(totalOverlap(used.wires)).toBeLessThan(totalOverlap(free.wires));
});

type TestWire = { id: string; from: string; to: string; points: Point[] };

/** 並べる処理に渡す配置（ノードと線だけを持つ） */
const layoutOf = (nodes: Array<Rect & { id: string }>, wires: TestWire[]) => ({
  width: 1000,
  height: 1000,
  nodes: nodes.map((node) => ({
    ...node,
    lines: [node.id],
    faded: false,
    ancestors: [],
  })),
  groups: [],
  wires: wires.map((wire) => ({
    ...wire,
    label: undefined,
    merged: undefined,
  })),
});

/** 左右の 2 つのノード L・R の間を縦に通る n 本の線（上のノード S{i} から下のノード T{i} へ） */
const corridorLayout = (options: {
  n: number;
  lineX: number;
  rightX: number;
}) => {
  const { n, lineX, rightX } = options;
  const nodes: Array<Rect & { id: string }> = [
    { id: "L", x: 0, y: 0, w: 100, h: 300 },
    { id: "R", x: rightX, y: 0, w: 100, h: 300 },
  ];
  const wires: TestWire[] = [];
  for (let i = 1; i <= n; i += 1) {
    // 上下の横の区間は線ごとに y を変え、縦の区間だけを x = lineX に重ねる
    const top = -10 - 8 * i;
    const bottom = 310 + 8 * i;
    const sx = -200 + 40 * i;
    const tx = rightX + 140 + 40 * i;
    nodes.push(
      { id: `S${i}`, x: sx - 10, y: -100, w: 20, h: 40 },
      { id: `T${i}`, x: tx - 10, y: 360, w: 20, h: 40 },
    );
    wires.push({
      id: `S${i}->T${i}`,
      from: `S${i}`,
      to: `T${i}`,
      points: [
        [sx, -60],
        [sx, top],
        [lineX, top],
        [lineX, bottom],
        [tx, bottom],
        [tx, 360],
      ],
    });
  }
  return layoutOf(nodes, wires);
};

/** 線ごとの、L・R の間（y が 0〜300）にかかる縦の区間の x 座標（小さい順） */
const corridorXs = (wires: Array<{ points: Point[] }>): number[] =>
  wires
    .map((wire) => {
      const k = wire.points.findIndex((p, index) => {
        const previous = wire.points[index - 1];
        return (
          previous !== undefined &&
          previous[0] === p[0] &&
          Math.min(previous[1], p[1]) < 300 &&
          Math.max(previous[1], p[1]) > 0
        );
      });
      return (wire.points[k] as Point)[0];
    })
    .sort((a, b) => a - b);

/** 線が縦横の折れ線か */
const orthogonal = (points: Point[]): boolean =>
  points.slice(1).every((p, index) => {
    const previous = points[index] as Point;
    return previous[0] === p[0] || previous[1] === p[1];
  });

// 同じ区間の 3 本を並べる（正常系）
test("test_separate_wires", async () => {
  // 準備（L の右の辺から 40px の線。通り道は clearance を含めて 112〜168px）
  const { separateWires } = await loadLayout();
  const layout = corridorLayout({ n: 3, lineX: 140, rightX: 180 });
  // 実行
  const result = separateWires(layout);
  // 検証
  expect(corridorXs(result.wires)).toEqual([132, 140, 148]);
  expect(totalOverlap(result.wires)).toBe(0);
  for (const wire of result.wires) expect(orthogonal(wire.points)).toBe(true);
  expect(result.crowded).toBe(0);
});

// 辺から 12px の格子の線を通る束（正常系）
test("test_separate_wires_when_grid_line", async () => {
  // 準備（L の右の辺から 12px の線。通り道は 112〜168px で、中ほどは 140px）
  const { separateWires } = await loadLayout();
  const layout = corridorLayout({ n: 5, lineX: 112, rightX: 180 });
  const left = layout.nodes.find((node) => node.id === "L") as Rect;
  const right = layout.nodes.find((node) => node.id === "R") as Rect;
  // 実行
  const result = separateWires(layout);
  // 検証
  expect(corridorXs(result.wires)).toEqual([124, 132, 140, 148, 156]);
  for (const wire of result.wires) {
    for (const [k, point] of wire.points.slice(1).entries()) {
      const previous = wire.points[k] as Point;
      expect(segmentCrosses(previous, point, left)).toBe(false);
      expect(segmentCrosses(previous, point, right)).toBe(false);
    }
  }
  expect(result.crowded).toBe(0);
});

// 通り道の幅が足りない（正常系）
test("test_separate_wires_when_crowded", async () => {
  // 準備（通り道は 112〜128px の 16px で、束の幅 32px に 16px 足りない）
  const { separateWires } = await loadLayout();
  const narrow = corridorLayout({ n: 5, lineX: 112, rightX: 140 });
  // spread: 16 で配置し直すと、R が 16px 右へ動く
  const widened = corridorLayout({ n: 5, lineX: 112, rightX: 156 });
  // 実行
  const crowded = separateWires(narrow).crowded;
  const after = separateWires(widened).crowded;
  // 検証
  expect(crowded).toBe(16);
  expect(after).toBe(0);
});

// 同じ点から出る線の端（正常系）
test("test_separate_wires_when_shared_end", async () => {
  // 準備（N の下の辺の中央から出て、最初の区間だけが重なる 2 本）
  const { separateWires } = await loadLayout();
  const wires: TestWire[] = [
    {
      id: "N->P",
      from: "N",
      to: "P",
      points: [
        [50, 40],
        [50, 100],
        [200, 100],
      ],
    },
    {
      id: "N->Q",
      from: "N",
      to: "Q",
      points: [
        [50, 40],
        [50, 100],
        [-100, 100],
      ],
    },
  ];
  const layout = layoutOf(
    [
      { id: "N", x: 0, y: 0, w: 100, h: 40 },
      { id: "P", x: 200, y: 80, w: 60, h: 40 },
      { id: "Q", x: -160, y: 80, w: 60, h: 40 },
    ],
    wires,
  );
  // 実行
  const result = separateWires(layout);
  // 検証
  expect(result.wires.map((wire) => wire.points)).toEqual(
    wires.map((wire) => wire.points),
  );
});

// 端点を含む区間は端点を動かさずに並べる（正常系）
test("test_separate_wires_when_end_segment", async () => {
  // 準備（A の下の辺から下へ出る線と、B の上の辺から上へ出る線が、x = 50 の縦の区間で重なる）
  const { separateWires } = await loadLayout();
  const wires: TestWire[] = [
    {
      id: "A->C",
      from: "A",
      to: "C",
      points: [
        [50, 40],
        [50, 250],
        [300, 250],
      ],
    },
    {
      id: "B->D",
      from: "B",
      to: "D",
      points: [
        [50, 300],
        [50, 100],
        [300, 100],
      ],
    },
  ];
  const layout = layoutOf(
    [
      { id: "A", x: 0, y: 0, w: 100, h: 40 },
      { id: "B", x: 0, y: 300, w: 100, h: 40 },
      { id: "C", x: 300, y: 230, w: 60, h: 40 },
      { id: "D", x: 300, y: 80, w: 60, h: 40 },
    ],
    wires,
  );
  // 実行
  const result = separateWires(layout);
  // 検証
  for (const [k, wire] of result.wires.entries()) {
    const original = wires[k] as TestWire;
    expect(wire.points[0]).toEqual(original.points[0]);
    expect(wire.points.at(-1)).toEqual(original.points.at(-1));
    expect(orthogonal(wire.points)).toBe(true);
  }
  expect(totalOverlap(result.wires)).toBe(0);
  expect(result.crowded).toBe(0);
});

// 長さが clearance 以下の端の区間（正常系）
test("test_separate_wires_when_short_end", async () => {
  // 準備（A の下の辺から 12px 進んで右へ折れる線と、B の上の辺から上へ出る線が、x = 50 の縦の区間で重なる）
  const { separateWires } = await loadLayout();
  const wires: TestWire[] = [
    {
      id: "A->C",
      from: "A",
      to: "C",
      points: [
        [50, 40],
        [50, 52],
        [300, 52],
      ],
    },
    {
      id: "B->D",
      from: "B",
      to: "D",
      points: [
        [50, 300],
        [50, 47],
        [300, 47],
      ],
    },
  ];
  const layout = layoutOf(
    [
      { id: "A", x: 0, y: 0, w: 100, h: 40 },
      { id: "B", x: 0, y: 300, w: 100, h: 40 },
      { id: "C", x: 300, y: 40, w: 60, h: 24 },
      { id: "D", x: 380, y: 35, w: 60, h: 24 },
    ],
    wires,
  );
  // 実行
  const result = separateWires(layout);
  // 検証
  for (const [k, wire] of result.wires.entries()) {
    const original = wires[k] as TestWire;
    expect(wire.points[0]).toEqual(original.points[0]);
    expect(wire.points.at(-1)).toEqual(original.points.at(-1));
    for (const [i, point] of wire.points.slice(1).entries()) {
      const previous = wire.points[i] as Point;
      expect(point, `${wire.id} の長さ 0 の区間`).not.toEqual(previous);
      const next = wire.points[i + 2];
      if (next === undefined) continue;
      // 同じ直線の上で向きを戻さない
      const axis = previous[0] === point[0] && point[0] === next[0] ? 1 : 0;
      const sameLine =
        axis === 1 || (previous[1] === point[1] && point[1] === next[1]);
      if (sameLine)
        expect(
          Math.sign(point[axis] - previous[axis]),
          `${wire.id} の折り返し`,
        ).toBe(Math.sign(next[axis] - point[axis]));
    }
  }
  expect(totalOverlap(result.wires)).toBe(0);
});
