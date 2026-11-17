import { expect, test } from "vitest";
import {
  BLOCK,
  GANTT,
  GIT_GRAPH,
  JOURNEY,
  TIMELINE,
} from "../../helpers/map.ts";

/** 軸と格子の配置を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLayout = () => import("../../../../src/map/axis-grid-layout.ts");
const loadAxisGrid = () => import("../../../../src/map/axis-grid.ts");

/** 読み取って配置する */
async function layOut(options: {
  kind: "gantt" | "timeline" | "gitGraph" | "journey" | "block";
  source: string;
  entered?: string;
  collapsed?: string[];
  selected?: { kind: "item" | "branch" | "actor"; key: string };
}) {
  const { parseAxisGrid } = await loadAxisGrid();
  const { layoutAxisGrid } = await loadLayout();
  const grid = parseAxisGrid({ kind: options.kind, source: options.source });
  const layout = layoutAxisGrid({
    grid,
    entered: options.entered,
    collapsed: new Set(options.collapsed ?? []),
    today: "2026-11-12",
    selected: options.selected,
  });
  const keyOf = (label: string) =>
    grid.items.find((item) => item.label === label || item.id === label)
      ?.stateKey;
  const placed = (label: string) =>
    layout.items.find(
      (item) => item.stateKey === keyOf(label) || item.stateKey === label,
    );
  return { grid, layout, placed };
}

// 日付の軸（正常系）
test("test_layout_axis_grid_when_gantt", async () => {
  // 準備・実行
  const { layout, placed } = await layOut({ kind: "gantt", source: GANTT });
  const off = await layOut({
    kind: "gantt",
    source: GANTT.replace(
      "excludes weekends",
      "excludes weekends\n  todayMarker off",
    ),
  });
  // 検証
  const req = placed("要件を決める");
  const des = placed("設計する");
  expect(des?.x).toBe((req?.x ?? 0) + (req?.width ?? 0));
  expect(layout.ticks[0]?.value).toBe("2026-11-02");
  const tick = layout.ticks.find((item) => item.value === "2026-11-12");
  expect(layout.today).toBe(tick?.x);
  expect(off.layout.today).toBeUndefined();
});

// 閉じた section と中へ入った section（正常系）
test("test_layout_axis_grid_when_gantt_collapsed_entered", async () => {
  // 準備
  const whole = await layOut({ kind: "gantt", source: GANTT });
  // 実行
  const closed = await layOut({
    kind: "gantt",
    source: GANTT,
    collapsed: ["開発"],
  });
  const entered = await layOut({
    kind: "gantt",
    source: GANTT,
    entered: "s3",
  });
  // 検証
  const dev = closed.layout.items.find((item) => item.stateKey === "開発");
  expect(dev).toMatchObject({ shape: "collapsed", count: 2 });
  expect(closed.layout.ticks).toEqual(whole.layout.ticks);
  expect(entered.layout.items).toHaveLength(2);
  expect(entered.layout.ticks[0]?.value).toBe("2026-11-09");
  expect(entered.layout.ticks.at(-1)?.value).toBe("2026-11-17");
});

// 記載順の軸と閉じた section（正常系）
test("test_layout_axis_grid_when_timeline", async () => {
  // 準備
  const { AXIS_GRID_LAYOUT } = await loadLayout();
  // 実行
  const open = await layOut({ kind: "timeline", source: TIMELINE });
  const closed = await layOut({
    kind: "timeline",
    source: TIMELINE,
    collapsed: ["記法を作る"],
  });
  // 検証
  const xs = [
    "2026-04",
    "2026-05",
    "2026-06",
    "2026-08",
    "2026-10",
    "2026-11",
  ].map((label) => open.placed(label)?.x ?? Number.NaN);
  for (let index = 1; index < xs.length; index += 1) {
    expect((xs[index] ?? 0) - (xs[index - 1] ?? 0)).toBe(AXIS_GRID_LAYOUT.step);
  }
  const first = closed.placed("2026-04")?.x ?? 0;
  expect(closed.placed("2026-08")?.x).toBe(first + AXIS_GRID_LAYOUT.step * 2);
});

// ブランチの線（正常系）
test("test_layout_axis_grid_when_git_graph", async () => {
  // 準備・実行
  const { grid, layout, placed } = await layOut({
    kind: "gitGraph",
    source: GIT_GRAPH,
  });
  // 検証
  const lanes = layout.lanes.filter((lane) => lane.kind === "branch");
  expect(lanes.map((lane) => lane.key)).toEqual(["main", "develop", "feat"]);
  const xs = grid.items.map(
    (item) =>
      layout.items.find((placedItem) => placedItem.stateKey === item.stateKey)
        ?.x ?? Number.NaN,
  );
  for (let index = 1; index < xs.length; index += 1) {
    expect(xs[index]).toBeGreaterThan(xs[index - 1] ?? 0);
  }
  const axis = placed("axis");
  const feat = lanes.find((lane) => lane.key === "feat");
  expect((axis?.y ?? 0) + (axis?.height ?? 0) / 2).toBe(feat?.y);
});

// 点数の高さと人の線（正常系）
test("test_layout_axis_grid_when_journey", async () => {
  // 準備・実行
  const selected = await layOut({
    kind: "journey",
    source: JOURNEY,
    selected: { kind: "actor", key: "AI" },
  });
  const closed = await layOut({
    kind: "journey",
    source: JOURNEY,
    collapsed: ["点検する"],
  });
  // 検証
  const ys = selected.layout.items.map((item) => item.y);
  expect(selected.placed("文書を開く")?.y).toBe(Math.min(...ys));
  expect(selected.placed("ずれを直す")?.y).toBe(Math.max(...ys));
  const actorLane = selected.layout.lanes.find(
    (lane) => lane.kind === "actor" && lane.key === "AI",
  );
  expect(actorLane?.members).toHaveLength(3);
  const check = closed.layout.items.find(
    (item) => item.stateKey === "点検する",
  );
  expect(check?.y).toBe(closed.placed("記法を調べる")?.y);
});

// 格子と閉じた入れ子（正常系）
test("test_layout_axis_grid_when_block", async () => {
  // 準備
  const { AXIS_GRID_LAYOUT } = await loadLayout();
  // 実行
  const open = await layOut({ kind: "block", source: BLOCK });
  const closed = await layOut({
    kind: "block",
    source: BLOCK,
    collapsed: ["core"],
  });
  // 検証
  const page = open.placed("page");
  const cdn = open.placed("cdn");
  const mdmark = open.placed("mdmark");
  expect(page?.width).toBeGreaterThan((cdn?.width ?? 0) * 2);
  expect(mdmark?.x).toBe(page?.x);
  const openCore = open.layout.frames.find((frame) => frame.key === "core");
  expect(openCore?.x).toBe(cdn?.x);
  const closedCore = closed.layout.items.find(
    (item) => item.stateKey === "core",
  );
  expect(closedCore?.width).toBe(openCore?.width);
  expect(closedCore?.height).toBe(AXIS_GRID_LAYOUT.row);
  expect(closed.placed("doc")?.x).toBe(open.placed("doc")?.x);
});
