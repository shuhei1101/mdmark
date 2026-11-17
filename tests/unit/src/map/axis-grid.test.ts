import { expect, test } from "vitest";
import {
  BLOCK,
  GANTT,
  GANTT_UNREADABLE,
  GIT_GRAPH,
  JOURNEY,
  TIMELINE,
} from "../../helpers/map.ts";

/** 軸と格子の配置の図の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadAxisGrid = () => import("../../../../src/map/axis-grid.ts");

// ガントチャート（正常系）
test("test_parse_axis_grid_when_gantt", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "gantt", source: GANTT });
  // 検証
  expect(grid.items).toHaveLength(8);
  expect(grid.sections).toHaveLength(4);
  const byLabel = (label: string) =>
    grid.items.find((item) => item.label === label);
  const req = byLabel("要件を決める");
  const des = byLabel("設計する");
  const imp = byLabel("実装する");
  expect(req?.detail).toMatchObject({
    kind: "gantt",
    start: "2026-11-02",
    end: "2026-11-05",
  });
  expect(des?.detail).toMatchObject({ start: "2026-11-05" });
  expect(imp?.detail).toMatchObject({ start: "2026-11-11", end: "2026-11-18" });
  expect(grid.links.filter((link) => link.kind === "after")).toHaveLength(5);
  expect([...grid.ambiguous]).toEqual(["準備"]);
  const prepare = grid.sections.filter((section) => section.label === "準備");
  expect(prepare.map((section) => section.stateKey)).toEqual(["s1", "s3"]);
  expect(byLabel("手順書を書く")?.key).toBe("手順書を書く");
  expect(grid.title).toBe("リリースの計画");
  expect(grid.problems).toEqual([]);
});

// タイムライン（正常系）
test("test_parse_axis_grid_when_timeline", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "timeline", source: TIMELINE });
  // 検証
  const periods = grid.items.filter((item) => item.shape === "period");
  const events = grid.items.filter((item) => item.shape === "event");
  expect(periods).toHaveLength(6);
  expect(events).toHaveLength(9);
  expect(grid.sections).toHaveLength(2);
  const first = periods.find((item) => item.label === "2026-04");
  expect(first?.section).toBeUndefined();
  const may = periods.find((item) => item.label === "2026-05");
  const notice = events.find((item) => item.label === "注意書き");
  expect(notice?.parent).toBe(may?.order);
  expect(grid.title).toBe("mdmark の歩み");
  expect(grid.problems).toEqual([]);
});

// Git グラフ（正常系）
test("test_parse_axis_grid_when_git_graph", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "gitGraph", source: GIT_GRAPH });
  // 検証
  expect(grid.branches).toEqual(["main", "develop", "feat"]);
  expect(grid.items).toHaveLength(10);
  const sixth = grid.items.find((item) => item.order === 6);
  expect(sixth).toMatchObject({ label: "", key: "c6" });
  expect(grid.items.find((item) => item.id === "axis")?.shape).toBe(
    "highlight",
  );
  const pick = grid.items.find((item) => item.shape === "cherryPick");
  expect(pick?.detail).toMatchObject({ kind: "gitGraph", source: "map" });
  expect(grid.items.filter((item) => item.shape === "merge")).toHaveLength(2);
  expect(grid.links.filter((link) => link.kind === "merge")).toHaveLength(2);
  expect(JSON.stringify(grid.items)).not.toMatch(/[0-9a-f]{7}-/);
  expect(grid.problems).toEqual([]);
});

// ジャーニー（正常系）
test("test_parse_axis_grid_when_journey", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "journey", source: JOURNEY });
  // 検証
  expect(grid.items).toHaveLength(7);
  expect(grid.sections).toHaveLength(3);
  expect(grid.actors).toEqual(["作成者", "AI", "読者"]);
  const trace = grid.items.find((item) => item.label === "図を辿る");
  expect(trace?.detail).toMatchObject({
    kind: "journey",
    score: 4,
    actors: ["読者", "作成者", "AI"],
  });
  expect(grid.problems).toEqual([]);
});

// ブロック図（正常系）
test("test_parse_axis_grid_when_block", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "block", source: BLOCK });
  // 検証
  expect(grid.options.columns).toBe(3);
  const page = grid.items.find((item) => item.id === "page");
  expect(page?.detail).toMatchObject({ kind: "block", width: 2 });
  expect(grid.items.filter((item) => item.shape === "space")).toHaveLength(1);
  expect(grid.sections).toHaveLength(1);
  expect(grid.sections[0]).toMatchObject({ label: "core", columns: 2 });
  expect(grid.sections[0]?.members).toHaveLength(2);
  expect(grid.links).toHaveLength(3);
  expect(grid.links.some((link) => link.label === "描く")).toBe(true);
  expect(grid.problems).toEqual([]);
});

// 1 行目の単語（正常系）
test("test_parse_axis_grid_when_first_word", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const block = parseAxisGrid({ kind: "block", source: BLOCK });
  const git = parseAxisGrid({ kind: "gitGraph", source: GIT_GRAPH });
  // 検証
  expect(block).toMatchObject({ kind: "block", firstWord: "block-beta" });
  expect(git).toMatchObject({ kind: "gitGraph", firstWord: "gitGraph" });
});

// 読めない行（異常系）
test("test_parse_axis_grid_when_unreadable", async () => {
  // 準備
  const { parseAxisGrid } = await loadAxisGrid();
  // 実行
  const grid = parseAxisGrid({ kind: "gantt", source: GANTT_UNREADABLE });
  // 検証
  expect(grid.problems).toHaveLength(1);
  expect(grid.problems[0]).toMatchObject({ kind: "map_invalid" });
  expect(grid.problems[0]?.message).toContain("四日");
  expect(grid.problems[0]?.line).toBe(4);
  expect(grid.items.map((item) => item.label)).toEqual(["要件を決める"]);
});

// 各種のキー（正常系）
test("test_axis_grid_item_of", async () => {
  // 準備
  const { parseAxisGrid, axisGridItemOf } = await loadAxisGrid();
  const gantt = parseAxisGrid({ kind: "gantt", source: GANTT });
  const git = parseAxisGrid({ kind: "gitGraph", source: GIT_GRAPH });
  // 実行
  const kindOf = (grid: typeof gantt, key: string) =>
    axisGridItemOf({ grid, key }).kind;
  // 検証
  expect(kindOf(gantt, "imp")).toBe("item");
  expect(kindOf(gantt, "手順書を書く")).toBe("item");
  expect(kindOf(gantt, "公開")).toBe("section");
  expect(kindOf(gantt, "準備")).toBe("ambiguous");
  expect(kindOf(gantt, "幽霊")).toBe("missing");
  expect(kindOf(git, "c6")).toBe("item");
  expect(kindOf(git, "README を書く")).toBe("item");
  expect(kindOf(git, "feat")).toBe("branch");
});
