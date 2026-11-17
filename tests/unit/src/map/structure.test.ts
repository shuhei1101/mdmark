import { expect, test } from "vitest";

/** 範囲の構造の確認を読み込む */
const loadStructure = () => import("../../../../src/map/structure.ts");

// 形の正しい範囲（正常系）
test("test_collect_map_structure", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  // 実行
  const result = collectMapStructure({
    args: "",
    mermaid: "flowchart LR\n  A --> B\n",
    mermaidCount: 1,
    dataCount: 1,
  });
  // 検証
  expect(result.problems).toEqual([]);
  expect(result.kind).toBe("flowchart");
});

// mermaid のブロックが 2 つ（異常系）
test("test_collect_map_structure_when_two_blocks", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  // 実行
  const result = collectMapStructure({
    args: "",
    mermaid: "flowchart LR\n  A --> B\n",
    mermaidCount: 2,
    dataCount: 0,
  });
  // 検証
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(result.kind).toBeUndefined();
});

// 読めない引数（異常系）
test("test_collect_map_structure_when_bad_args", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  // 実行
  const result = collectMapStructure({
    args: "{title: 全体}",
    mermaid: "flowchart LR\n  A --> B\n",
    mermaidCount: 1,
    dataCount: 0,
  });
  // 検証
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(result.kind).toBe("flowchart");
});

// ER 図と状態遷移図（正常系）
test("test_collect_map_structure_when_er_and_state", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  const kindOf = (mermaid: string) =>
    collectMapStructure({ args: "", mermaid, mermaidCount: 1, dataCount: 0 });
  // 実行
  const results = [
    kindOf("erDiagram\n  A ||--o{ B : x\n"),
    kindOf("stateDiagram-v2\n  [*] --> A\n"),
    kindOf("stateDiagram\n  [*] --> A\n"),
  ];
  // 検証
  expect(results.map((result) => result.problems)).toEqual([[], [], []]);
  expect(results.map((result) => result.kind)).toEqual([
    "erDiagram",
    "stateDiagram",
    "stateDiagram",
  ]);
});

// クラス図・アーキテクチャ図・C4 図（正常系）
test("test_collect_map_structure_when_class_architecture_c4", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  const kindOf = (mermaid: string) =>
    collectMapStructure({ args: "", mermaid, mermaidCount: 1, dataCount: 0 });
  // 実行
  const results = [
    kindOf("classDiagram\n  class A\n"),
    kindOf("architecture-beta\n  service a(server)[A]\n"),
    kindOf('C4Context\n  Person(a, "A")\n'),
  ];
  const container = kindOf('C4Container\n  Person(a, "A")\n');
  // 検証
  expect(results.map((result) => result.problems)).toEqual([[], [], []]);
  expect(results.map((result) => result.kind)).toEqual([
    "classDiagram",
    "architecture",
    "C4Context",
  ]);
  expect(container.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(container.kind).toBeUndefined();
});
