import { expect, test } from "vitest";
import { MINDMAP } from "../../helpers/map.ts";

/** マインドマップの配置を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLayout = () => import("../../../../src/map/mindmap-layout.ts");
const loadMindmap = () => import("../../../../src/map/mindmap.ts");

/** 全ての項目の大きさを 100 × 40 にしてモックのマインドマップを配置する */
async function layoutMock(options: { top?: string; collapsed?: string[] }) {
  const { layoutMindmap } = await loadLayout();
  const { parseMindmap } = await loadMindmap();
  const mindmap = parseMindmap(MINDMAP);
  const sizes = new Map(
    mindmap.items.map((item) => [item.stateKey, { width: 100, height: 40 }]),
  );
  const layout = layoutMindmap({
    mindmap,
    top: options.top,
    collapsed: new Set(options.collapsed ?? []),
    sizes,
  });
  /** 表示する文字の項目の配置（同じ文字は最初の項目。描いていなければ undefined） */
  const find = (label: string) => {
    const item = mindmap.items.find((entry) => entry.label === label);
    return layout.items.find((entry) => entry.stateKey === item?.stateKey);
  };
  /** 表示する文字の項目の配置（描いていなければ失敗する） */
  const placed = (label: string) => {
    const found = find(label);
    if (found === undefined) throw new Error(`${label} を描いていません`);
    return found;
  };
  return { mindmap, layout, find, placed };
}

/** 曲線の始点と終点 */
const endsOf = (d: string) => {
  const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  return {
    start: [numbers[0], numbers[1]],
    end: [numbers.at(-2), numbers.at(-1)],
  };
};

/** 項目の縦の中央 */
const middle = (item: { y: number; height: number }) =>
  item.y + item.height / 2;

// 根を中央に配置し、枝を左右に振り分ける（正常系）
test("test_layout_mindmap", async () => {
  // 準備・実行
  const { layout, placed } = await layoutMock({});
  // 検証
  expect(layout.items).toHaveLength(14);
  expect(layout.curves).toHaveLength(13);
  const root = placed("企画の論点");
  expect(root.side).toBe("root");
  expect(placed("目的").side).toBe("right");
  expect(placed("体制").side).toBe("left");
  const right = layout.items.filter((item) => item.side === "right");
  const left = layout.items.filter((item) => item.side === "left");
  expect(right.every((item) => item.x > root.x)).toBe(true);
  expect(left.every((item) => item.x < root.x)).toBe(true);
  expect(placed("利用者を増やす").y).toBeLessThan(
    placed("継続して使ってもらう").y,
  );
  expect(middle(placed("目的"))).toBeCloseTo(
    (middle(placed("利用者を増やす")) +
      middle(placed("継続して使ってもらう"))) /
      2,
  );
  expect(
    ["目的", "体制", "予算", "スケジュール"].map(
      (label) => placed(label).color,
    ),
  ).toEqual(["blue", "green", "orange", "purple"]);
});

// 閉じた枝（正常系）
test("test_layout_mindmap_when_collapsed", async () => {
  // 準備・実行
  const { layout, find, placed } = await layoutMock({ collapsed: ["体制"] });
  // 検証
  expect(layout.items).toHaveLength(11);
  expect(find("人手が足りない")).toBeUndefined();
  expect(placed("体制")).toMatchObject({ descendants: 3, hasChildren: true });
});

// 枝の中（正常系）
test("test_layout_mindmap_when_entered", async () => {
  // 準備・実行
  const { layout, placed } = await layoutMock({ top: "体制" });
  // 検証
  expect(layout.items).toHaveLength(4);
  expect(placed("体制")).toMatchObject({
    side: "root",
    hasChildren: false,
    color: "green",
  });
  for (const item of layout.items) expect(item.color).toBe("green");
});

// 曲線の始点と終点（正常系）
test("test_layout_mindmap_when_curves", async () => {
  // 準備
  const { MINDMAP_LAYOUT } = await loadLayout();
  // 実行
  const { layout, placed } = await layoutMock({});
  // 検証
  const root = placed("企画の論点");
  const purpose = placed("目的");
  const grow = placed("利用者を増やす");
  const curveOf = (from: string, to: string) =>
    layout.curves.find((curve) => curve.from === from && curve.to === to)?.d;
  const first = endsOf(String(curveOf(root.stateKey, purpose.stateKey)));
  expect(first.start[0]).toBeCloseTo(root.x + root.width);
  expect(first.start[1]).toBeCloseTo(middle(root));
  const second = endsOf(String(curveOf(purpose.stateKey, grow.stateKey)));
  expect(second.start[0]).toBeCloseTo(
    purpose.x + purpose.width + MINDMAP_LAYOUT.gripWidth,
  );
  expect(second.end[0]).toBeCloseTo(grow.x);
  expect(second.end[1]).toBeCloseTo(middle(grow));
});

// 枝ごとの色（正常系）
test("test_mindmap_branch_color", async () => {
  // 準備
  const { mindmapBranchColor } = await loadLayout();
  const { parseMindmap } = await loadMindmap();
  const mindmap = parseMindmap(MINDMAP);
  const seven = parseMindmap(
    `mindmap\n  root\n${["A", "B", "C", "D", "E", "F", "G"].map((label) => `    ${label}`).join("\n")}\n`,
  );
  const byLabel = (label: string) =>
    mindmap.items.find((item) => item.label === label);
  // 実行
  const colors = [mindmap.root, byLabel("目的"), byLabel("人手が足りない")].map(
    (item) => (item ? mindmapBranchColor({ mindmap, item }) : "none"),
  );
  const seventh = seven.items.find((item) => item.label === "G");
  // 検証
  expect(colors).toEqual([undefined, "blue", "green"]);
  expect(
    seventh ? mindmapBranchColor({ mindmap: seven, item: seventh }) : "none",
  ).toBe("blue");
});
