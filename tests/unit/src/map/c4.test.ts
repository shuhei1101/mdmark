import { expect, test } from "vitest";
import { C4 } from "../../helpers/map.ts";

/** C4Context の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadC4 = () => import("../../../../src/map/c4.ts");

// モックの C4 図（正常系）
test("test_parse_c4_context", async () => {
  // 準備
  const { parseC4Context } = await loadC4();
  // 実行
  const diagram = parseC4Context(C4);
  // 検証
  expect(diagram.title).toBe("注文のシステムの全体");
  expect(diagram.boundaries).toHaveLength(2);
  const shop = diagram.boundaries.find((item) => item.id === "shop");
  expect([shop?.parent, shop?.kind]).toEqual(["company", "system"]);
  expect(diagram.elements).toHaveLength(7);
  const element = (id: string) =>
    diagram.elements.find((item) => item.id === id);
  expect([element("support")?.kind, element("support")?.external]).toEqual([
    "person",
    true,
  ]);
  expect(element("events")?.kind).toBe("system_queue");
  expect(diagram.relations.map((item) => item.id)).toEqual([
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
  ]);
  expect(diagram.relations[0]?.technology).toBe("HTTPS");
  expect(diagram.relations[2]?.direction).toBe("right");
  expect(diagram.relations[3]?.both).toBe(true);
  expect(diagram.problems).toEqual([]);
});

// 閉じの無い境界（異常系）
test("test_parse_c4_context_when_unclosed", async () => {
  // 準備
  const { parseC4Context } = await loadC4();
  // 実行
  const diagram = parseC4Context(
    'C4Context\n  System_Boundary(shop, "通販") {\n    System(store, "注文のシステム")\n',
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
});

// 段と並び（正常系）
test("test_c4_to_flowchart", async () => {
  // 準備
  const { parseC4Context, c4ToFlowchart } = await loadC4();
  // 実行
  const { chart, overrides } = c4ToFlowchart(parseC4Context(C4));
  // 検証
  expect(overrides.r3?.rankless).toBe(true);
  expect(overrides.stock?.align).toBe("store");
  expect(overrides.stock?.order ?? 0).toBeGreaterThan(
    overrides.store?.order ?? 0,
  );
  const edge = (id: string) => chart.edges.find((item) => item.id === id);
  expect(edge("r1")?.label).toBe("注文する [HTTPS]");
  expect(edge("r4")?.both).toBe(true);
  expect(chart.groups.find((item) => item.id === "shop")?.title).toBe("通販");
});

// 上向きと逆向きの関係の矢じり（正常系）
test("test_c4_to_flowchart_when_up_and_back", async () => {
  // 準備
  const { parseC4Context, c4ToFlowchart } = await loadC4();
  const diagram = parseC4Context(
    'C4Context\n  System(a, "A")\n  System(b, "B")\n  System(c, "C")\n  Rel_U(a, b, "上へ")\n  Rel_Back(a, c, "戻す")\n',
  );
  // 実行
  const { chart, reversed } = c4ToFlowchart(diagram);
  // 検証: Rel_U は段のために元と先を入れ替え、矢じりを b の側（入れ替えた線の元の側）に描く
  const edge = (id: string) => chart.edges.find((item) => item.id === id);
  expect([edge("r1")?.from, edge("r1")?.to]).toEqual(["b", "a"]);
  expect(reversed).toEqual(["r1", "r2"]);
  expect([edge("r2")?.from, edge("r2")?.to]).toEqual(["a", "c"]);
  expect(diagram.relations[1]?.direction).toBe("back");
});
