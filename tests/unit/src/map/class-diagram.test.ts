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
  expect(byId.get("図形")).toMatchObject({ annotation: "interface" });
  expect(byId.get("一覧")).toMatchObject({ generic: "T" });
  const members = byId.get("基本図形")?.members ?? [];
  expect(members.find((item) => item.name === "描く")).toMatchObject({
    isAbstract: true,
  });
  expect(members.find((item) => item.name === "数")).toMatchObject({
    isStatic: true,
  });
  expect(byId.get("円")).toMatchObject({ namespace: "形状" });
  expect(diagram.relations[0]).toMatchObject({
    toEnd: "triangle",
    dashed: true,
  });
  expect(diagram.relations[6]).toMatchObject({
    fromCardinality: "1",
    toCardinality: "*",
  });
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
  const view = { widths: {}, maxWidth: 220 };
  const open = classPartInputs(diagram, { ...view, collapsed: new Set() });
  const closed = classPartInputs(diagram, {
    ...view,
    collapsed: new Set(["基本図形"]),
  });
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

/** 部品の寸法と配置の間隔を読み込む */
const loadSizes = async () => {
  const { MAP_CLASS, MAP_ER } = await import("../../../../src/map/map.part.ts");
  const { MAP_LAYOUT } = await import("../../../../src/map/layout.ts");
  return { MAP_CLASS, MAP_ER, MAP_LAYOUT };
};

/** 幅に収まらないメソッドだけを持つクラス「検索」 */
const LONG_CLASS = [
  "classDiagram",
  "  class 検索 {",
  "    +検索(絞り込み条件, 期間, 件数, 詳細度, 件数のみ) dict",
  "  }",
].join("\n");

// メンバーの型の `~`（正常系）
test("test_parse_class_diagram_when_member_generics", async () => {
  // 準備
  const { parseClassDiagram } = await loadClass();
  // 実行
  const diagram = parseClassDiagram(
    [
      "classDiagram",
      "  class 型 {",
      "    +時間範囲(期間) tuple~int, int~",
      "    +対応: dict~str, list~int~~",
      "    +一覧: list~dict~str, int~~",
      "    +孤立: x~y",
      "  }",
    ].join("\n"),
  );
  // 検証
  const members = diagram.classes[0]?.members ?? [];
  expect(members.map((item) => item.text)).toEqual([
    "時間範囲(期間) tuple<int, int>",
    "対応: dict<str, list<int>>",
    "一覧: list<dict<str, int>>",
    "孤立: x~y",
  ]);
  expect(members.map((item) => item.name)).toEqual([
    "時間範囲",
    "対応",
    "一覧",
    "孤立",
  ]);
});

// 幅に収まらないメンバーを折り返す（正常系）
test("test_class_part_inputs_when_long_members", async () => {
  // 準備
  const { parseClassDiagram, classPartInputs } = await loadClass();
  const { MAP_CLASS } = await loadSizes();
  const diagram = parseClassDiagram(LONG_CLASS);
  // 実行
  const inputs = classPartInputs(diagram, {
    collapsed: new Set(),
    widths: {},
    maxWidth: 220,
  });
  // 検証
  const lines = inputs.classes[0]?.members[0]?.lines ?? 0;
  expect(lines).toBeGreaterThanOrEqual(2);
  const size = inputs.overrides["検索"]?.size;
  expect(size?.w).toBe(220);
  const oneLine =
    MAP_CLASS.head + MAP_CLASS.row + MAP_CLASS.divider * 2 + MAP_CLASS.foot;
  expect(size?.h).toBe(oneLine + (lines - 1) * MAP_CLASS.line);
});

// 補足の幅と幅の上限（正常系）
test("test_class_part_inputs_when_width", async () => {
  // 準備
  const { parseClassDiagram, classPartInputs } = await loadClass();
  const diagram = parseClassDiagram(LONG_CLASS);
  // 実行
  const given = classPartInputs(diagram, {
    collapsed: new Set(),
    widths: { 検索: 480 },
    maxWidth: 220,
  });
  const wide = classPartInputs(diagram, {
    collapsed: new Set(),
    widths: {},
    maxWidth: 360,
  });
  // 検証
  expect(given.overrides["検索"]?.size?.w).toBe(480);
  expect(given.classes[0]?.members[0]?.lines).toBe(1);
  const w = wide.overrides["検索"]?.size?.w ?? 0;
  expect(w).toBeGreaterThan(220);
  expect(w).toBeLessThanOrEqual(360);
});

// ラベルを持つ関係のクラスの左右を空ける（正常系）
test("test_class_part_inputs_when_labels", async () => {
  // 準備
  const { parseClassDiagram, classPartInputs } = await loadClass();
  const { MAP_CLASS, MAP_ER, MAP_LAYOUT } = await loadSizes();
  const view = { collapsed: new Set<string>(), widths: {}, maxWidth: 220 };
  const outside = parseClassDiagram(
    [
      "classDiagram",
      "  メイン ..> アプリ組み立て : ASGI アプリの生成",
      "  アプリ組み立て ..> 設定",
    ].join("\n"),
  );
  const inside = parseClassDiagram(
    [
      "classDiagram",
      "  namespace 変換 {",
      "    class 応答変換",
      "    class 時間範囲",
      "  }",
      "  応答変換 ..> 時間範囲 : 期間の解決",
    ].join("\n"),
  );
  // 実行
  const top = classPartInputs(outside, view).overrides;
  const nested = classPartInputs(inside, view).overrides;
  // 検証
  const need = (label: string) =>
    label.length * MAP_ER.labelChar + MAP_CLASS.labelGap * 2;
  const gap = Math.min(MAP_LAYOUT.gapRank, MAP_LAYOUT.gapItem);
  const main = top["メイン"]?.aside ?? 0;
  expect(top["アプリ組み立て"]?.aside).toBe(main);
  expect(gap + main * 2).toBeGreaterThanOrEqual(need("ASGI アプリの生成"));
  expect(top["設定"]?.aside ?? 0).toBe(0);
  for (const id of ["応答変換", "時間範囲"]) {
    const aside = nested[id]?.aside ?? 0;
    expect(MAP_LAYOUT.gapItem + aside * 2).toBeGreaterThanOrEqual(
      need("期間の解決"),
    );
  }
});
