import { expect, test } from "vitest";
import { DATA } from "../../helpers/map.ts";

/** 補足の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadData = () => import("../../../../src/map/data.ts");

// モックの補足（正常系）
test("test_parse_map_data", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { data, problems } = parseMapData(DATA);
  // 検証
  expect(problems).toEqual([]);
  expect(data.version).toBe(1);
  expect(Object.keys(data.notes)).toEqual(["layout", "data"]);
  expect(data.walkthroughs).toHaveLength(4);
  expect(data.walkthroughs[2]).toMatchObject({
    enter: "place",
    nodes: ["layout", "route"],
  });
  expect(data.layout.read).toEqual({ color: "blue" });
});

// 補足が無い（正常系）
test("test_parse_map_data_when_empty", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { data, problems } = parseMapData(undefined);
  // 検証
  expect(data).toEqual({
    version: 1,
    notes: {},
    walkthroughs: [],
    layout: {},
    plays_over: undefined,
  });
  expect(problems).toEqual([]);
});

// 知らないキー（異常系）
test("test_parse_map_data_when_unknown_key", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { problems } = parseMapData("version: 1\nlayuot: {}\n");
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]?.kind).toBe("map_unknown_key");
  expect(problems[0]?.message).toContain("layuot");
  for (const key of ["notes", "walkthroughs", "layout", "plays_over"]) {
    expect(problems[0]?.message).toContain(key);
  }
});

// -- を含む値（異常系）
test("test_parse_map_data_when_double_hyphen", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { problems } = parseMapData(
    "version: 1\nwalkthroughs:\n  - text: a -- b\n",
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(problems[0]?.message).toContain("walkthroughs[0].text");
});

// YAML として読めない（異常系）
test("test_parse_map_data_when_unreadable", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { data, problems } = parseMapData("notes: [\n");
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(data.notes).toEqual({});
});
