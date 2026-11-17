import { expect, test } from "vitest";
import { CLASS } from "../../helpers/map.ts";

/** classDiagram の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadClass = () => import("../../../../src/map/class-diagram.ts");

// モックのクラス図（正常系）
test("test_parse_class_diagram", async () => {
  // 準備
  const { parseClassDiagram } = await loadClass();
  // 実行
  const diagram = parseClassDiagram(CLASS);
  // 検証
  expect(diagram.classes).toHaveLength(6);
  expect(diagram.relations.map((item) => item.id)).toEqual([
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
    "r7",
  ]);
  expect(diagram.namespaces).toEqual(["形状"]);
  expect(diagram.notes).toHaveLength(1);
  const byId = new Map(diagram.classes.map((item) => [item.id, item]));
  expect(byId.get("図形")?.annotation).toBe("interface");
  expect(byId.get("一覧")?.generic).toBe("T");
  const members = byId.get("基本図形")?.members ?? [];
  expect(members.find((item) => item.name === "描く")?.isAbstract).toBe(true);
  expect(members.find((item) => item.name === "数")?.isStatic).toBe(true);
  expect(byId.get("円")?.namespace).toBe("形状");
  const r1 = diagram.relations[0];
  expect(r1?.toEnd).toBe("triangle");
  expect(r1?.dashed).toBe(true);
  const r7 = diagram.relations[6];
  expect([r7?.fromCardinality, r7?.toCardinality]).toEqual(["1", "*"]);
  expect(diagram.problems).toEqual([]);
});

// 読めない行（異常系）
test("test_parse_class_diagram_when_unreadable", async () => {
  // 準備
  const { parseClassDiagram } = await loadClass();
  // 実行
  const diagram = parseClassDiagram(
    "classDiagram\n  class 図面\n  class 円\n  図面 -x- 円\n  図面 --> 円\n",
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
  expect(diagram.problems[0]?.line).toBe(3);
  expect(diagram.classes.map((item) => item.id)).toEqual(["図面", "円"]);
  expect(diagram.relations).toHaveLength(1);
});

// 閉じの無いクラス（異常系）
test("test_parse_class_diagram_when_unclosed", async () => {
  // 準備
  const { parseClassDiagram } = await loadClass();
  // 実行
  const diagram = parseClassDiagram(
    "classDiagram\n  class 図面 {\n    +名前 string\n",
  );
  // 検証
  expect(diagram.problems).toHaveLength(1);
  expect(diagram.problems[0]?.kind).toBe("map_invalid");
});

// ノード・グループ・線（正常系）
test("test_class_to_flowchart", async () => {
  // 準備
  const { parseClassDiagram, classToFlowchart } = await loadClass();
  // 実行
  const chart = classToFlowchart(parseClassDiagram(CLASS));
  // 検証
  expect(chart.nodes).toHaveLength(7);
  expect(chart.groups.map((item) => item.id)).toEqual(["形状"]);
  expect(chart.nodes.filter((node) => node.parent === "形状")).toHaveLength(3);
  expect(chart.edges).toHaveLength(8);
  const node = (id: string) => chart.nodes.find((item) => item.id === id);
  expect(node("一覧")?.label).toBe("一覧<T>");
  const edge = (id: string) => chart.edges.find((item) => item.id === id);
  expect(edge("r1")?.from).toBe("基本図形");
  const n1 = edge("n1");
  expect([n1?.from, n1?.to].sort()).toEqual(["note_1", "描画器"].sort());
  expect(n1?.arrow).toContain(".");
});

// 端と大きさ（正常系）
test("test_class_part_inputs", async () => {
  // 準備
  const { parseClassDiagram, classPartInputs } = await loadClass();
  const diagram = parseClassDiagram(CLASS);
  // 実行
  const open = classPartInputs(diagram, new Set());
  const closed = classPartInputs(diagram, new Set(["基本図形"]));
  // 検証
  expect(closed.ends.filter((end) => end.shape !== undefined)).toHaveLength(6);
  expect(closed.ends.filter((end) => end.card !== undefined)).toHaveLength(2);
  expect(closed.ends.some((end) => end.wire === "r7" && end.shape)).toBe(false);
  const heightOf = (inputs: typeof open, id: string) =>
    inputs.overrides[id]?.size?.h ?? Number.NaN;
  expect(heightOf(closed, "基本図形")).toBeLessThan(heightOf(open, "基本図形"));
  // 描画器はメンバー 2 行（属性 1・メソッド 1）と区切り線 2 本の分だけ、閉じたクラスより高い
  expect(heightOf(open, "描画器")).toBeGreaterThan(
    heightOf(closed, "基本図形"),
  );
  expect(open.classes.find((item) => item.id === "図形")?.annotation).toBe(
    "interface",
  );
});

// click と link の行をリンク先にする（正常系）
test("test_parse_class_diagram_when_links", async () => {
  // 準備
  const { parseClassDiagram } = await loadClass();
  // 実行
  const diagram = parseClassDiagram(
    [
      "classDiagram",
      "  class 図面",
      "  class 円",
      "  class 線",
      '  click 図面 href "./drawing.md"',
      '  click 円 "https://example.com"',
      '  link 線 "./line.md"',
    ].join("\n"),
  );
  // 検証
  expect(diagram.links).toEqual({
    図面: "./drawing.md",
    円: "https://example.com",
    線: "./line.md",
  });
  expect(diagram.problems).toEqual([]);
});

// リンク先を構成図に写す（正常系）
test("test_class_to_flowchart_when_links", async () => {
  // 準備
  const { parseClassDiagram, classToFlowchart } = await loadClass();
  const diagram = parseClassDiagram(
    'classDiagram\n  class 図面\n  click 図面 href "./drawing.md"',
  );
  // 実行
  const chart = classToFlowchart(diagram);
  // 検証
  expect(chart.links).toEqual({ 図面: "./drawing.md" });
});
