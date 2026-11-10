import { expect, test } from "vitest";
import { CONFIG, DATA, FLOW } from "../../helpers/map.ts";

/** map の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/map/check.ts");

/** 範囲を 1 つの mermaid のブロックと補足で組み立てる */
const range = (mermaid: string, data?: string, args = "") => ({ args, mermaid, mermaidCount: 1, data, dataCount: data === undefined ? 0 : 1 });

// ずれの無い範囲（正常系）
test("test_collect_map_problems", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range(FLOW, DATA), CONFIG, true);
  // 検証
  expect(problems).toEqual([]);
});

// 無い ID（異常系）
test("test_collect_map_problems_when_unknown_ref", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range(FLOW, "version: 1\nnotes:\n  ghost: 無いノード\n"), CONFIG, true);
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_unknown_ref"]);
  expect(problems[0]?.message).toContain("notes.ghost");
});

// 設定に無いクラス（異常系）
test("test_collect_map_problems_when_unknown_class", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range("flowchart LR\n  A:::queue --> B\n"), CONFIG, true);
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_unknown_class"]);
  expect(problems[0]?.message).toContain("queue");
});

// 設定に無い線の名前（異常系）
test("test_collect_map_problems_when_unknown_line", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range("flowchart LR\n  A --> B\n", "version: 1\nlayout:\n  A->B:\n    line: fast\n"), CONFIG, true);
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_unknown_line"]);
  expect(problems[0]?.message).toContain("fast");
});

// mermaid のブロックが無い（異常系）
test("test_collect_map_problems_when_no_mermaid", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems({ args: "", mermaid: undefined, mermaidCount: 0, data: DATA, dataCount: 1 }, CONFIG, true);
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual(["map_invalid"]);
});

// 描けない種類（異常系）
test("test_collect_map_problems_when_unsupported_kind", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  // 実行
  const problems = collectMapProblems(range('pie\n  "a": 1\n'), CONFIG, true);
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]?.kind).toBe("map_invalid");
  expect(problems[0]?.message).toContain("flowchart");
  expect(problems[0]?.message).toContain("sequenceDiagram");
});

// 知らない印の引数（異常系）
test("test_collect_map_problems_when_unknown_arg", async () => {
  // 準備
  const { collectMapProblems } = await loadCheck();
  const withArg = range("flowchart LR\n  A --> B\n", undefined, '{"mdoe": 1}');
  // 実行
  const checked = collectMapProblems(withArg, CONFIG, true);
  const drawn = collectMapProblems(withArg, CONFIG, false);
  // 検証
  expect(checked.map((problem) => problem.kind)).toEqual(["map_unknown_key"]);
  expect(checked[0]?.message).toContain("collapse");
  expect(drawn).toEqual([]);
});

// 知っているアイコン（正常系）
test("test_check_map_config", async () => {
  // 準備
  const { checkMapConfig } = await loadCheck();
  // 実行
  const issues = checkMapConfig({ kinds: { store: { icon: "database" } } });
  // 検証
  expect(issues).toEqual([]);
});

// 無いアイコン（異常系）
test("test_check_map_config_when_unknown_icon", async () => {
  // 準備
  const { checkMapConfig } = await loadCheck();
  // 実行
  const issues = checkMapConfig({ kinds: { store: { icon: "no-such-icon" } } });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.key).toBe("map.kinds.store.icon");
  expect(issues[0]?.message).toContain("no-such-icon");
});
