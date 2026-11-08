import { expect, test } from "vitest";

/** 階層の表の計算を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTreeLogic = () => import("../../../src/tree-logic.ts");

/** test_plan_tree_rows と test_filter_tree_rows で使用する表のキーの列 */
const TREE_KEYS = [
  "features.table",
  "features.html",
  "aliases[].id",
  "aliases[].metadata.alias_type.type",
];

// `.` で分け、`[]` を名前に残す（正常系）
test("test_split_key_path", async () => {
  // 準備
  const { splitKeyPath } = await loadTreeLogic();
  // 実行
  const split = splitKeyPath("aliases[].metadata.alias_type.type");
  // 検証
  expect(split.names).toEqual(["aliases[]", "metadata", "alias_type", "type"]);
  expect(split.parents).toEqual([
    "aliases[]",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
  ]);
});

// 表に無い親を補い、深さと子の有無を付ける（正常系）
test("test_plan_tree_rows", async () => {
  // 準備
  const { planTreeRows } = await loadTreeLogic();
  // 実行
  const rows = planTreeRows(TREE_KEYS);
  // 検証
  expect(rows.map((row) => [row.path, row.virtual])).toEqual([
    ["features", true],
    ["features.table", false],
    ["features.html", false],
    ["aliases[]", true],
    ["aliases[].id", false],
    ["aliases[].metadata", true],
    ["aliases[].metadata.alias_type", true],
    ["aliases[].metadata.alias_type.type", false],
  ]);
  expect(rows.at(-1)?.depth).toBe(3);
  expect(rows.at(-1)?.parent).toBe("aliases[].metadata.alias_type");
  expect(rows.at(-1)?.name).toBe("type");
  expect(rows.at(-1)?.source).toBe(3);
  expect(rows[0]?.hasChildren).toBe(true);
  expect(rows[0]?.source).toBeUndefined();
  expect(rows[1]?.hasChildren).toBe(false);
});

// 後ろに記載した親の行は補わず、その行を親にする（正常系）
test("test_plan_tree_rows_when_parent_written_later", async () => {
  // 準備
  const { planTreeRows } = await loadTreeLogic();
  // 実行
  const rows = planTreeRows(["a.b", "a"]);
  // 検証
  expect(rows.map((row) => [row.path, row.source, row.virtual])).toEqual([
    ["a", 1, false],
    ["a.b", 0, false],
  ]);
});

// 入れ子のキーと配列の要素のキーにパスを付ける（正常系）
test("test_yaml_line_paths", async () => {
  // 準備
  const { yamlLinePaths } = await loadTreeLogic();
  const lines = [
    "aliases:",
    "  - id: terms",
    "    paths:",
    "      - dev/*.yaml",
    "    metadata:",
    "      alias_type:",
    "        type: custom",
  ];
  // 実行
  const paths = yamlLinePaths(lines);
  // 検証
  expect(paths).toEqual([
    "aliases[]",
    "aliases[].id",
    "aliases[].paths",
    undefined,
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ]);
});

// コメント・空の行・複数行の文字列の中はパスを持たない（正常系）
test("test_yaml_line_paths_when_comments", async () => {
  // 準備
  const { yamlLinePaths } = await loadTreeLogic();
  const lines = ["# 説明", "", "note: |", "  a: b", "next: 1"];
  // 実行
  const paths = yamlLinePaths(lines);
  // 検証
  expect(paths).toEqual([undefined, undefined, "note", undefined, "next"]);
});

// 該当した行の祖先を残し、補った行を数えない（正常系）
test("test_filter_tree_rows", async () => {
  // 準備
  const { planTreeRows, filterTreeRows } = await loadTreeLogic();
  const rows = planTreeRows(TREE_KEYS);
  // 実行
  const byId = filterTreeRows({ rows, word: "id" });
  const byMetadata = filterTreeRows({ rows, word: "metadata" });
  // 検証
  expect([...byId.keep].sort()).toEqual(["aliases[]", "aliases[].id"]);
  expect([...byId.hits]).toEqual(["aliases[].id"]);
  expect(byId.count).toBe(1);
  expect([...byMetadata.keep].sort()).toEqual([
    "aliases[]",
    "aliases[].metadata",
  ]);
  expect(byMetadata.count).toBe(0);
});
