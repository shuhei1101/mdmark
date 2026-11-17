import { expect, test } from "vitest";
import { MINDMAP, MINDMAP_UNREADABLE } from "../../helpers/map.ts";

/** mindmap の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMindmap = () => import("../../../../src/map/mindmap.ts");

// モックのマインドマップ（正常系）
test("test_parse_mindmap", async () => {
  // 準備
  const { parseMindmap } = await loadMindmap();
  // 実行
  const mindmap = parseMindmap(MINDMAP);
  // 検証
  expect(mindmap.items).toHaveLength(14);
  expect(mindmap.root).toMatchObject({
    order: 0,
    label: "企画の論点",
    shape: "circle",
  });
  const byLabel = (label: string) =>
    mindmap.items.find((item) => item.label === label);
  expect(byLabel("目的")).toMatchObject({ id: "a1", shape: "square" });
  expect(byLabel("体制")).toMatchObject({ shape: "rounded" });
  expect(byLabel("担当の割り当て")).toMatchObject({ shape: "bang" });
  expect(byLabel("予算")).toMatchObject({ shape: "cloud" });
  expect(byLabel("スケジュール")).toMatchObject({ shape: "hexagon" });
  expect(byLabel("利用者を増やす")).toMatchObject({ shape: "plain" });
  expect(mindmap.root?.children).toHaveLength(4);
  const firstIssue = mindmap.items.find((item) => item.label === "課題");
  expect(byLabel("人手が足りない")?.parent).toBe(firstIssue?.order);
  expect(
    mindmap.items.some(
      (item) => item.label.includes("::icon") || item.label.includes(":::"),
    ),
  ).toBe(false);
  expect(mindmap.problems).toEqual([]);
});

// ID を持たない同じ文字の項目（正常系）
test("test_parse_mindmap_when_same_label", async () => {
  // 準備
  const { parseMindmap } = await loadMindmap();
  // 実行
  const mindmap = parseMindmap(MINDMAP);
  // 検証
  expect([...mindmap.ambiguous]).toEqual(["課題"]);
  const issues = mindmap.items.filter((item) => item.label === "課題");
  expect(issues).toHaveLength(2);
  for (const item of issues) {
    expect(item.key).toBe("課題");
    expect(item.stateKey).toBe(`n${item.order}`);
  }
  const lack = mindmap.items.find((item) => item.label === "人手が足りない");
  expect(lack).toMatchObject({
    key: "人手が足りない",
    stateKey: "人手が足りない",
  });
  const purpose = mindmap.items.find((item) => item.label === "目的");
  expect(purpose).toMatchObject({ key: "a1", stateKey: "a1" });
});

// 2 つ目の根（異常系）
test("test_parse_mindmap_when_second_root", async () => {
  // 準備
  const { parseMindmap } = await loadMindmap();
  // 実行
  const mindmap = parseMindmap(MINDMAP_UNREADABLE);
  // 検証
  expect(mindmap.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(mindmap.problems[0]?.line).toBeTypeOf("number");
  expect(mindmap.problems[0]?.message).toContain("二つ目の根");
  expect(mindmap.items).toHaveLength(4);
  expect(
    mindmap.items.filter((item) => item.parent === undefined),
  ).toHaveLength(1);
});

// 親より浅く戻る行（正常系）
test("test_parse_mindmap_when_shallower_indent", async () => {
  // 準備
  const { parseMindmap } = await loadMindmap();
  const source = "mindmap\n  root\n    A\n        B\n      C\n";
  // 実行
  const mindmap = parseMindmap(source);
  // 検証
  const byLabel = (label: string) =>
    mindmap.items.find((item) => item.label === label);
  expect(byLabel("C")?.parent).toBe(byLabel("A")?.order);
  expect(byLabel("A")?.children).toEqual([
    byLabel("B")?.order,
    byLabel("C")?.order,
  ]);
  expect(mindmap.problems).toEqual([]);
});

// ID と表示する文字（正常系）
test("test_mindmap_item_of", async () => {
  // 準備
  const { parseMindmap, mindmapItemOf } = await loadMindmap();
  const mindmap = parseMindmap(MINDMAP);
  // 実行
  const results = ["a1", "人手が足りない", "課題", "幽霊"].map((key) =>
    mindmapItemOf({ mindmap, key }),
  );
  // 検証
  expect(results[0]).toMatchObject({ kind: "found", item: { label: "目的" } });
  expect(results[1]).toMatchObject({
    kind: "found",
    item: { label: "人手が足りない" },
  });
  expect(results[2]).toEqual({ kind: "ambiguous" });
  expect(results[3]).toEqual({ kind: "missing" });
});
