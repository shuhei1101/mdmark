import { expect, test } from "vitest";
import {
  C4,
  C4_CONTAINER,
  C4_DEPLOYMENT,
  C4_DYNAMIC,
  C4_UNREADABLE,
} from "../../helpers/map.ts";

/** C4 の図の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadC4 = () => import("../../../../src/map/c4.ts");

// モックの C4 図（正常系）
test("test_parse_c4_context", async () => {
  // 準備
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(C4);
  // 検証
  expect(diagram.kind).toBe("C4Context");
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
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(
    'C4Context\n  System_Boundary(shop, "通販") {\n    System(store, "注文のシステム")\n',
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
});

// 段と並び（正常系）
test("test_c4_to_flowchart", async () => {
  // 準備
  const { parseC4, c4ToFlowchart } = await loadC4();
  // 実行
  const { chart, overrides } = c4ToFlowchart(parseC4(C4));
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
  const { parseC4, c4ToFlowchart } = await loadC4();
  const diagram = parseC4(
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

// コンテナ図（正常系）
test("test_parse_c4_when_container", async () => {
  // 準備
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(C4_CONTAINER);
  // 検証
  const element = (id: string) =>
    diagram.elements.find((item) => item.id === id);
  expect(diagram.kind).toBe("C4Container");
  expect([element("api")?.kind, element("api")?.technology]).toEqual([
    "container",
    "Node.js",
  ]);
  expect(element("db")?.kind).toBe("container_db");
  expect([element("mail")?.kind, element("mail")?.external]).toEqual([
    "container",
    true,
  ]);
  expect(diagram.boundaries.find((item) => item.id === "shop")?.kind).toBe(
    "container",
  );
  expect(diagram.problems).toEqual([]);
});

// 動的図（正常系）
test("test_parse_c4_when_dynamic", async () => {
  // 準備
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(C4_DYNAMIC);
  // 検証
  expect(diagram.relations.map((item) => item.index)).toEqual([1, 2, 3, 4]);
  expect(diagram.relations[2]?.from).toBe("api");
  expect(diagram.relations[2]?.to).toBe("db");
  expect(diagram.problems).toEqual([]);
});

// 配置図（正常系）
test("test_parse_c4_when_deployment", async () => {
  // 準備
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(C4_DEPLOYMENT);
  // 検証
  const boundary = (id: string) =>
    diagram.boundaries.find((item) => item.id === id);
  expect(diagram.boundaries).toHaveLength(5);
  expect(diagram.boundaries.every((item) => item.kind === "deployment")).toBe(
    true,
  );
  expect([boundary("region")?.parent, boundary("region")?.technology]).toEqual([
    "cloud",
    "ap-northeast-1",
  ]);
  expect([boundary("app")?.side, boundary("dbnode")?.side]).toEqual([
    "left",
    "right",
  ]);
  expect(diagram.problems).toEqual([]);
});

// 読めない行（異常系）
test("test_parse_c4_when_unreadable", async () => {
  // 準備
  const { parseC4 } = await loadC4();
  // 実行
  const diagram = parseC4(C4_UNREADABLE);
  // 検証
  expect(diagram.problems.map((problem) => problem.kind)).toEqual([
    "map_invalid",
  ]);
  expect(diagram.elements.map((item) => item.id)).toEqual(["customer", "web"]);
  expect(diagram.relations.map((item) => item.id)).toContain("r1");
});

// 動的図の番号（正常系）
test("test_c4_to_flowchart_when_dynamic", async () => {
  // 準備
  const { parseC4, c4ToFlowchart } = await loadC4();
  // 実行
  const { chart } = c4ToFlowchart(parseC4(C4_DYNAMIC));
  // 検証
  const label = (id: string) =>
    chart.edges.find((edge) => edge.id === id)?.label;
  expect(label("r1")).toBe("1: 注文を入力する");
  expect(label("r3")).toBe("3: 注文を保存する [SQL]");
});

// 配置先のノードの並び（正常系）
test("test_c4_to_flowchart_when_deployment", async () => {
  // 準備
  const { parseC4, c4ToFlowchart } = await loadC4();
  // 実行
  const { chart, overrides } = c4ToFlowchart(parseC4(C4_DEPLOYMENT));
  // 検証
  expect(chart.groups.find((group) => group.id === "cloud")?.title).toBe(
    "クラウド［AWS］",
  );
  expect(overrides.dbnode?.align).toBe("app");
  expect(overrides.dbnode?.order ?? 0).toBeGreaterThan(
    overrides.app?.order ?? 0,
  );
});

// 読めない行の要素を指す関係（異常系）
test("test_c4_to_flowchart_when_unreadable", async () => {
  // 準備
  const { parseC4, c4ToFlowchart } = await loadC4();
  // 実行
  const { chart } = c4ToFlowchart(parseC4(C4_UNREADABLE));
  // 検証
  expect(chart.edges.map((edge) => edge.id)).toEqual(["r1"]);
});
