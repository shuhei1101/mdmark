import { expect, test } from "vitest";

/** 設定と印の引数の型・検査を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSpec = () => import("../../../../src/map/spec.ts");

// 全てのキー（正常系）
test("test_parse_map_args", async () => {
  // 準備
  const { parseMapArgs } = await loadSpec();
  // 実行
  const result = parseMapArgs('{"title": "全体", "focus": "read", "play": "autoplay", "interval": 3, "collapse": {"open": false}}');
  // 検証
  expect(result.args).toEqual({ title: "全体", focus: "read", play: "autoplay", interval: 3, collapse: { open: false, title: undefined } });
  expect(result.problems).toEqual([]);
  expect(result.unknownKeys).toEqual([]);
});

// 引数なし（正常系）
test("test_parse_map_args_when_empty", async () => {
  // 準備
  const { parseMapArgs } = await loadSpec();
  // 実行
  const result = parseMapArgs("");
  // 検証
  expect(result.args).toEqual({ interval: 2 });
  expect(result.normalized).toBe("{}");
});

// 知らないキー（正常系）
test("test_parse_map_args_when_unknown_key", async () => {
  // 準備
  const { parseMapArgs } = await loadSpec();
  // 実行
  const result = parseMapArgs('{"title": "全体", "mdoe": 1}');
  // 検証
  expect(result.unknownKeys).toEqual(["mdoe"]);
  expect(result.problems).toEqual([]);
  expect(result.normalized).toBe('{"title":"全体"}');
});

// JSON として読めない（異常系）
test("test_parse_map_args_when_not_json", async () => {
  // 準備
  const { parseMapArgs } = await loadSpec();
  // 実行
  const result = parseMapArgs("{title: 全体}");
  // 検証
  expect(result.problems.map((problem) => problem.kind)).toEqual(["map_invalid_value"]);
  expect(result.args).toEqual({ interval: 2 });
});

// 型の合わない値（異常系）
test("test_parse_map_args_when_wrong_type", async () => {
  // 準備
  const { parseMapArgs } = await loadSpec();
  // 実行
  const result = parseMapArgs('{"interval": "abc"}');
  // 検証
  expect(result.problems.map((problem) => problem.kind)).toEqual(["map_invalid_value"]);
  expect(result.args.interval).toBe(2);
});
