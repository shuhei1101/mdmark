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
  nodeFit: "height" | "width" = "height",
  source = FLOW,
) {
  const { layoutMap } = await loadLayout();
  const { parseFlowchart } = await loadFlowchart();
  return layoutMap(
    parseFlowchart(source),
    { collapsed: [], ...view },
    { overrides, nodeFit },
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
  expect(mermaid.x === marker.x || mermaid.y === marker.y).toBe(true);
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
    "width",
    `flowchart LR\n  A["${long}"] --> B\n`,
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
    "height",
    "flowchart LR\n  A --> B --> C\n  A --> C\n",
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
    "height",
    "flowchart LR\n  subgraph g [g]\n    A\n  end\n  subgraph h [h]\n    B\n  end\n  A --> B\n",
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
  const start = await laid({}, { A: { justify: "start" } }, "height", source);
  const end = await laid({}, { A: { justify: "end" } }, "height", source);
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
    "height",
    "flowchart LR\n  A --> B\n",
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
    "height",
    "flowchart LR\n  A --> B\n",
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

// 全角 30 文字（正常系）
test("test_wrap_label", async () => {
  // 準備
  const { wrapLabel } = await loadLayout();
  // 実行
  const lines = wrapLabel("あ".repeat(30), 220);
  // 検証
  expect(lines.length).toBeGreaterThanOrEqual(2);
  for (const line of lines) {
    expect(line.length * 14).toBeLessThanOrEqual(200);
  }
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
