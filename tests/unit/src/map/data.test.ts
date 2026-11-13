import { expect, test } from "vitest";
import { DATA } from "../../helpers/map.ts";

/** 補足の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadData = () => import("../../../../src/map/data.ts");

/** 上書きの全てのキーを持つ補足 */
const OVERRIDES = JSON.stringify({
  version: 1,
  layout: {
    data: { justify: "start" },
    store: { collapsed: true },
    "mount->marker": {
      ends: { from: { side: "bottom" }, to: { side: "top" } },
      via: [{ x: 240, y: 80 }],
    },
  },
});

// モックの補足（正常系）
test("test_parse_map_data", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { data, problems } = parseMapData(DATA);
  const overrides = parseMapData(OVERRIDES);
  // 検証
  expect(problems).toEqual([]);
  expect(data.version).toBe(1);
  expect(Object.keys(data.notes)).toEqual(["layout", "data"]);
  expect(data.notes.data).toEqual({
    text: "version と機能ごとのキーをスキーマで検査する",
  });
  expect(data.walkthroughs).toHaveLength(4);
  expect(data.walkthroughs[1]?.text.split("\n")).toHaveLength(3);
  expect(data.walkthroughs[2]).toMatchObject({
    enter: "place",
    nodes: ["layout", "route"],
  });
  expect(data.layout.read).toEqual({ color: "blue" });
  expect(overrides.problems).toEqual([]);
  expect(overrides.data.layout).toEqual({
    data: { justify: "start" },
    store: { collapsed: true },
    "mount->marker": {
      ends: { from: "bottom", to: "top" },
      via: [{ x: 240, y: 80 }],
    },
  });
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
    groups: {},
  });
  expect(problems).toEqual([]);
});

// 知らないキー（異常系）
test("test_parse_map_data_when_unknown_key", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { problems } = parseMapData('{"version": 1, "layuot": {}}');
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
    '{"version": 1, "walkthroughs": [{"text": "a -- b"}]}',
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(problems[0]?.message).toContain("walkthroughs[0].text");
});

// JSON のオブジェクトとして読めない（異常系）
test("test_parse_map_data_when_unreadable", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const unreadable = parseMapData('{"notes": [\n');
  const notObject = parseMapData("[1]");
  // 検証
  for (const { data, problems } of [unreadable, notObject]) {
    expect(problems.map((problem) => problem.kind)).toEqual([
      "map_invalid_value",
    ]);
    expect(data.notes).toEqual({});
  }
  expect(notObject.problems[0]?.message).toContain("JSON のオブジェクト");
});

// 知らない辺と寄せる側（異常系）
test("test_parse_map_data_when_invalid_side", async () => {
  // 準備
  const { parseMapData } = await loadData();
  const source = JSON.stringify({
    version: 1,
    layout: {
      data: { justify: "left" },
      "mount->marker": { ends: { from: { side: "middle" } } },
    },
  });
  // 実行
  const { data, problems } = parseMapData(source);
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
    "map_invalid_value",
  ]);
  expect(data.layout.data?.justify).toBeUndefined();
  expect(data.layout["mount->marker"]?.ends).toBeUndefined();
});

// 説明が文字（異常系）
test("test_parse_map_data_when_note_is_string", async () => {
  // 準備
  const { parseMapData } = await loadData();
  // 実行
  const { data, problems } = parseMapData(
    '{"version": 1, "notes": {"mount": "公開関数"}}',
  );
  // 検証
  expect(problems.map((problem) => problem.kind)).toEqual([
    "map_invalid_value",
  ]);
  expect(data.notes.mount).toBeUndefined();
});
