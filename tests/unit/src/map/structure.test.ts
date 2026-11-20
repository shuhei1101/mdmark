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
    kindOf('C4Container\n  Person(a, "A")\n'),
    kindOf('C4Deployment\n  Deployment_Node(a, "A")\n'),
  ];
  const unknown = kindOf('C4Foo\n  Person(a, "A")\n');
  // 検証
  expect(results.map((result) => result.problems)).toEqual([
    [],
    [],
    [],
    [],
    [],
  ]);
  expect(results.map((result) => result.kind)).toEqual([
    "classDiagram",
    "architecture",
    "C4Context",
    "C4Container",
    "C4Deployment",
  ]);
  expect(unknown.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(unknown.kind).toBeUndefined();
});

// front matter とコメントの行を飛ばす（正常系）
test("test_plain_map_source_of", async () => {
  // 準備
  const { plainMapSourceOf } = await loadStructure();
  // 実行
  const result = plainMapSourceOf(
    "---\ntitle: 受付\n---\n%% メモ\nflowchart LR\n  A --> B",
  );
  // 検証
  expect(result?.kind).toBe("flowchart");
  expect(result?.title).toBe("受付");
  expect(result?.body.startsWith("%% メモ")).toBe(true);
  expect(result?.body).not.toContain("---");
  expect(result?.frontMatter).toBe("---\ntitle: 受付\n---");
});

// accTitle のタイトル（正常系）
test("test_plain_map_source_of_when_acc_title", async () => {
  // 準備
  const { plainMapSourceOf } = await loadStructure();
  // 実行
  const result = plainMapSourceOf(
    "sequenceDiagram\n  accTitle: 注文\n  A->>B: 送る",
  );
  // 検証
  expect(result?.kind).toBe("sequenceDiagram");
  expect(result?.title).toBe("注文");
  expect(result?.frontMatter).toBeUndefined();
});

// 設定を持つと対象にしない（正常系）
test("test_plain_map_source_of_when_config", async () => {
  // 準備
  const { plainMapSourceOf } = await loadStructure();
  // 実行
  const withConfig = plainMapSourceOf(
    "---\nconfig:\n  theme: forest\n  gitGraph:\n    mainBranchName: MetroLine1\n---\ngitGraph\n  commit",
  );
  const withInit = plainMapSourceOf(
    '%%{init: {"theme": "forest"}}%%\nflowchart LR\n  A --> B',
  );
  // 検証
  expect(withConfig?.kind).toBe("gitGraph");
  expect(withConfig?.mainBranchName).toBe("MetroLine1");
  expect(withInit?.kind).toBe("flowchart");
  expect(withInit?.body.startsWith("flowchart")).toBe(true);
  expect(withInit?.body).not.toContain("%%{");
  expect(withInit?.mainBranchName).toBeUndefined();
});

// 最初の単語が block のブロック図（正常系）
test("test_plain_map_source_of_when_block", async () => {
  // 準備
  const { plainMapSourceOf } = await loadStructure();
  // 実行
  const block = plainMapSourceOf("block\n  columns 3\n  a b c");
  const beta = plainMapSourceOf("block-beta\n  a b");
  // 検証
  expect(block?.kind).toBe("block");
  expect(beta?.kind).toBe("block");
});

// front matter と %%{init} の mainBranchName を読み取る（正常系）
test("test_mermaid_main_branch_of", async () => {
  // 準備
  const { mermaidMainBranchOf } = await loadStructure();
  const front =
    "---\nconfig:\n  gitGraph:\n    mainBranchName: MetroLine1\n---\n";
  const init = '%%{init: {"gitGraph": {"mainBranchName": "trunk"}}}%%\n';
  // 実行
  const names = [
    `${front}gitGraph\n  commit`,
    `${init}gitGraph\n  commit`,
    `${front}${init}gitGraph\n  commit`,
    "gitGraph\n  commit",
  ].map((source) => mermaidMainBranchOf(source));
  // 検証
  expect(names).toEqual(["MetroLine1", "trunk", "trunk", undefined]);
});

// map が描けない種類（正常系）
test("test_plain_map_source_of_when_other_kind", async () => {
  // 準備
  const { plainMapSourceOf } = await loadStructure();
  // 実行
  const pie = plainMapSourceOf('pie\n  "A" : 1');
  const xy = plainMapSourceOf("xychart-beta\n  bar [1, 2]");
  // 検証
  expect(pie).toBeUndefined();
  expect(xy).toBeUndefined();
});

// マインドマップ（正常系）
test("test_collect_map_structure_when_mindmap", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  // 実行
  const result = collectMapStructure({
    args: "",
    mermaid: "mindmap\n  root\n    A\n",
    mermaidCount: 1,
    dataCount: 0,
  });
  // 検証
  expect(result.problems).toEqual([]);
  expect(result.kind).toBe("mindmap");
});

// 軸と格子の配置の図（正常系）
test("test_collect_map_structure_when_axis_grid", async () => {
  // 準備
  const { collectMapStructure } = await loadStructure();
  const firstLines = ["gantt", "timeline", "gitGraph", "journey", "block-beta"];
  // 実行
  const results = firstLines.map((line) =>
    collectMapStructure({
      args: "",
      mermaid: `${line}\n`,
      mermaidCount: 1,
      dataCount: 0,
    }),
  );
  // 検証
  for (const result of results) expect(result.problems).toEqual([]);
  expect(results.map((result) => result.kind)).toEqual([
    "gantt",
    "timeline",
    "gitGraph",
    "journey",
    "block",
  ]);
});
