import { expect, test } from "vitest";
import { STATE } from "../../helpers/map.ts";

/** stateDiagram の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadState = () => import("../../../../src/map/state-diagram.ts");

// モックの状態遷移図（正常系）
test("test_parse_state_diagram", async () => {
  // 準備
  const { parseStateDiagram } = await loadState();
  // 実行
  const diagram = parseStateDiagram(STATE);
  // 検証
  expect(diagram.transitions).toHaveLength(13);
  expect(diagram.transitions[0]?.id).toBe("t1");
  expect(diagram.transitions[12]?.id).toBe("t13");
  expect(diagram.composites.map((item) => item.id)).toEqual(["実行中", "保留"]);
  expect(diagram.notes).toHaveLength(1);
  expect(diagram.states.filter((item) => item.kind === "choice")).toHaveLength(
    1,
  );
  const byId = new Map(diagram.states.map((item) => [item.id, item]));
  expect(byId.get("s1")?.label).toBe("差し戻しの理由を確認する");
  expect(byId.get("処理")?.parent).toBe("実行中");
  expect(byId.get("準備")?.parent).toBe("実行中");
  expect(diagram.problems).toEqual([]);
});

// 閉じの無い入れ子の状態（異常系）
test("test_parse_state_diagram_when_unclosed", async () => {
  // 準備
  const { parseStateDiagram } = await loadState();
  // 実行
  const diagram = parseStateDiagram(
    "stateDiagram-v2\n  [*] --> 実行中\n  state 実行中 {\n    [*] --> 処理\n",
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
});

// 付け替えと補い（正常系）
test("test_state_to_flowchart", async () => {
  // 準備
  const { parseStateDiagram, stateToFlowchart } = await loadState();
  const diagram = parseStateDiagram(STATE);
  // 実行
  const { chart, loops } = stateToFlowchart(diagram);
  // 検証
  const edge = (id: string) => chart.edges.find((item) => item.id === id);
  expect(edge("t5")?.to).toBe("start_実行中");
  expect(edge("t12")?.to).toBe("start_保留");
  expect(edge("t13")?.from).toBe("end_保留");
  const parents = new Map(chart.nodes.map((node) => [node.id, node.parent]));
  expect(parents.get("start_保留")).toBe("保留");
  expect(parents.get("end_保留")).toBe("保留");
  expect(loops.map((item) => item.id)).toEqual(["t2"]);
  expect(edge("t2")).toBeUndefined();
  expect(chart.edges.filter((item) => item.id.startsWith("n"))).toHaveLength(1);
});

// mermaid の公式の記法の例の状態遷移図の行を読み取る（正常系）
test("test_parse_state_diagram_when_mermaid_syntax", async () => {
  // 準備
  const { parseStateDiagram } = await loadState();
  const source = [
    "stateDiagram-v2",
    "  s2 : This is a state description",
    "  state fork_state <<fork>>",
    "  [*] --> fork_state",
    "  fork_state --> s2",
    "  note right of s2",
    "    Important information!",
    "    second line.",
    "  end note",
    "  state Active {",
    "    A --> B",
    "    --",
    "    C --> D",
    "  }",
    "  Crash:::bad --> [*]",
    "  classDef bad fill:#f00,color:#fff",
  ].join("\n");
  // 実行
  const diagram = parseStateDiagram(source);
  const state = (id: string) => diagram.states.find((one) => one.id === id);
  // 検証
  expect(diagram.problems).toEqual([]);
  expect(state("s2")?.label).toBe("This is a state description");
  expect(diagram.notes.find((note) => note.of === "s2")?.text).toBe(
    "Important information!\nsecond line.",
  );
  expect(state("fork_state")?.kind).toBe("fork");
  const regions = diagram.composites.filter(
    (composite) => composite.parent === "Active",
  );
  expect(regions).toHaveLength(2);
  expect(diagram.styles.nodes.Crash).toEqual({ fill: "#f00", color: "#fff" });
});
