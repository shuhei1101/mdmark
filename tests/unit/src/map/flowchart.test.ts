import { expect, test } from "vitest";
import { FLOW } from "../../helpers/map.ts";

/** flowchart の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");

// 入れ子の subgraph・クラス・ラベル付きの線（正常系）
test("test_parse_flowchart", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(FLOW);
  // 検証
  expect(chart.direction).toBe("LR");
  expect(chart.nodes).toHaveLength(10);
  expect(chart.groups).toHaveLength(4);
  expect(chart.edges).toHaveLength(12);
  expect(chart.problems).toEqual([]);
  const marker = chart.nodes.find((node) => node.id === "marker");
  expect(marker).toMatchObject({
    label: "map のマーカーの読み取り",
    classes: ["step"],
    parent: "read",
  });
  expect(chart.groups.find((group) => group.id === "read")).toMatchObject({
    title: "記法の読み取り",
    parent: "lib",
    direction: "TB",
  });
  expect(chart.nodes.find((node) => node.id === "user")).toMatchObject({
    shape: "stadium",
    classes: ["outside"],
    parent: undefined,
  });
});

// 形状の記法（正常系）
test("test_parse_flowchart_when_shapes", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  const source =
    "flowchart TB\n  A([a])\n  B[(b)]\n  C{c}\n  D((d))\n  E{{e}}\n  F[[f]]\n";
  // 実行
  const chart = parseFlowchart(source);
  // 検証
  expect(chart.nodes.map((node) => node.shape)).toEqual([
    "stadium",
    "cylinder",
    "rhombus",
    "circle",
    "hexagon",
    "subroutine",
  ]);
});

// 連なりと & の線（正常系）
test("test_parse_flowchart_when_chained", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart("flowchart LR\n  A & B --> C --> D\n");
  // 検証
  expect(chart.edges.map((edge) => [edge.from, edge.to])).toEqual([
    ["A", "C"],
    ["B", "C"],
    ["C", "D"],
  ]);
});

// 線の ID と重なり（正常系）
test("test_parse_flowchart_when_edge_ids", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  A e1@--> C\n  A --> B\n  A --> B\n",
  );
  // 検証
  expect(chart.edges.map((edge) => edge.id)).toEqual(["e1", "A->B", "A->B#2"]);
});

// 読めない行（異常系）
test("test_parse_flowchart_when_unreadable_line", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  A --> B\n  B --> C\n  A -> B\n  C --> D\n",
  );
  // 検証
  expect(chart.problems).toHaveLength(1);
  expect(chart.problems[0]).toMatchObject({ kind: "map_invalid", line: 3 });
  expect(chart.problems[0]?.message).toContain("-->");
  expect(chart.edges.map((edge) => edge.id)).toEqual(["A->B", "B->C", "C->D"]);
});

// 閉じの無い subgraph（異常系）
test("test_parse_flowchart_when_unclosed_subgraph", async () => {
  // 準備
  const { parseFlowchart } = await loadFlowchart();
  // 実行
  const chart = parseFlowchart(
    "flowchart LR\n  subgraph g [グループ]\n    A --> B\n",
  );
  // 検証
  expect(chart.problems).toHaveLength(1);
  expect(chart.problems[0]?.kind).toBe("map_invalid");
  expect(chart.problems[0]?.message).toContain("g");
  expect(chart.groups.map((group) => group.id)).toEqual(["g"]);
});
