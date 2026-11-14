import { expect, test } from "vitest";
import { ER, ER_DATA } from "../../helpers/map.ts";

/** erDiagram の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEr = () => import("../../../../src/map/er.ts");

// モックの ER 図（正常系）
test("test_parse_er_diagram", async () => {
  // 準備
  const { parseErDiagram } = await loadEr();
  // 実行
  const er = parseErDiagram(ER);
  // 検証
  expect(er.tables.map((table) => table.name)).toEqual([
    "顧客",
    "注文",
    "明細",
    "商品",
    "支払い",
  ]);
  expect(er.relations.map((rel) => rel.id)).toEqual([
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
  ]);
  expect(er.tables[1]?.columns).toHaveLength(8);
  const mail = er.tables[0]?.columns.find((column) => column.name === "メール");
  expect(mail?.keys).toEqual(["UK"]);
  expect(mail?.comment).toBe("ログインに使う");
  expect(er.relations[3]?.dashed).toBe(true);
  expect([
    er.relations[1]?.fromCardinality,
    er.relations[1]?.toCardinality,
  ]).toEqual(["1", "1..n"]);
  expect(er.problems).toEqual([]);
});

// 読めない行（異常系）
test("test_parse_er_diagram_when_unreadable", async () => {
  // 準備
  const { parseErDiagram } = await loadEr();
  // 実行
  const er = parseErDiagram(
    'erDiagram\n  顧客 {\n    int id PK\n  }\n  注文 {\n    int id PK\n  }\n  顧客 -> 注文\n  顧客 ||--o{ 注文 : "注文する"\n',
  );
  // 検証
  expect(er.problems).toHaveLength(1);
  expect(er.problems[0]?.kind).toBe("map_invalid");
  expect(er.problems[0]?.message).toContain("8 行目");
  expect(er.problems[0]?.message).toContain("||--o{");
  expect(er.tables).toHaveLength(2);
  expect(er.relations).toHaveLength(1);
});

// 閉じの無いテーブル（異常系）
test("test_parse_er_diagram_when_unclosed", async () => {
  // 準備
  const { parseErDiagram } = await loadEr();
  // 実行
  const er = parseErDiagram("erDiagram\n  注文 {\n    int id PK\n");
  // 検証
  expect(er.problems).toHaveLength(1);
  expect(er.problems[0]?.kind).toBe("map_invalid");
});

// 3 段の選び方（正常系）
test("test_er_column_for", async () => {
  // 準備
  const { erColumnFor, parseErDiagram } = await loadEr();
  const er = parseErDiagram(
    'erDiagram\n  申請 {\n    int id PK\n    int 承認者ID FK "参照: 社員.ID"\n    int 顧客ID FK\n  }\n  社員 {\n    int ID PK\n  }\n',
  );
  const table = er.tables[0];
  if (!table) throw new Error("テーブルが読めない");
  // 実行・検証
  expect(erColumnFor(table, "社員")?.name).toBe("承認者ID");
  expect(erColumnFor(table, "顧客")?.name).toBe("顧客ID");
  expect(erColumnFor(table, "商品")?.name).toBe("id");
});

// 最短の経路が 2 本（正常系）
test("test_er_fanouts", async () => {
  // 準備
  const { erFanouts, parseErDiagram } = await loadEr();
  const er = parseErDiagram(ER);
  // 実行
  const result = erFanouts(er.relations, "顧客", "明細");
  // 検証
  expect(result?.tables.slice().sort()).toEqual(
    ["商品", "明細", "注文", "顧客"].sort(),
  );
  expect(result?.relations.slice().sort()).toEqual(["r1", "r2", "r3", "r5"]);
  expect(result?.fanouts).toEqual([
    { relation: "r1", from: "顧客", to: "注文" },
    { relation: "r2", from: "注文", to: "明細" },
    { relation: "r3", from: "商品", to: "明細" },
  ]);
});

// つながらない（正常系）
test("test_er_fanouts_when_disconnected", async () => {
  // 準備
  const { erFanouts, parseErDiagram } = await loadEr();
  const er = parseErDiagram(
    "erDiagram\n  A {\n    int id PK\n  }\n  B {\n    int id PK\n  }\n",
  );
  // 実行・検証
  expect(erFanouts(er.relations, "A", "B")).toBeUndefined();
});

// 分類（正常系）
test("test_er_to_flowchart", async () => {
  // 準備
  const { erToFlowchart, parseErDiagram } = await loadEr();
  const { parseMapData } = await import("../../../../src/map/data.ts");
  const er = parseErDiagram(ER);
  const { data } = parseMapData(ER_DATA);
  // 実行
  const chart = erToFlowchart(er, data.groups);
  // 検証
  expect(chart.nodes).toHaveLength(5);
  expect(chart.groups.map((group) => group.id)).toEqual(["記録"]);
  expect(
    chart.nodes
      .filter((node) => node.parent === "記録")
      .map((node) => node.id)
      .sort(),
  ).toEqual(["支払い", "明細", "注文"].sort());
  expect(chart.edges.map((edge) => edge.id)).toEqual([
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
  ]);
});
