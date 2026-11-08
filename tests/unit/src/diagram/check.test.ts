import { expect, test } from "vitest";
import type { MdmarkFlowDefinition } from "../../../../src/diagram/definition.ts";
import { INQUIRY_TEXT, parsed } from "../../helpers/diagrams.ts";

/** 図の配置の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/diagram/check.ts");

/** インターフェース定義『設定と索引を点検する』の「正常系（図の定義にずれがある）」の配置のずれの定義 */
const BROKEN_FLOW: MdmarkFlowDefinition = {
  title: "配置のずれ",
  scope: "点検",
  updated: "2026-11-03",
  width: 800,
  height: 400,
  frame: { title: "システム", x: 20, y: 20, w: 600, h: 360 },
  nodes: [
    { id: "web", kind: "script", x: 40, y: 40, w: 100, h: 50, name: "Web" },
    { id: "db", kind: "data", x: 80, y: 60, w: 100, h: 50, name: "DB" },
    { id: "cache", kind: "data", x: 300, y: 200, w: 100, h: 50, name: "Cache" },
    {
      id: "queue",
      kind: "script",
      x: 580,
      y: 200,
      w: 100,
      h: 50,
      name: "Queue",
    },
    {
      id: "batch",
      kind: "script",
      x: 40,
      y: 300,
      w: 120,
      h: 48,
      name: "あ".repeat(30),
    },
  ],
  wires: [
    {
      id: "w1",
      from: "web",
      to: "queue",
      line: "flow",
      points: [
        [140, 225],
        [580, 225],
      ],
    },
  ],
} as MdmarkFlowDefinition;

// 整った配置はずれを返却しない（正常系）
test("test_check_flow_layout", async () => {
  // 準備
  const { checkFlowLayout } = await loadCheck();
  const touching = {
    title: "接するだけ",
    scope: "点検",
    updated: "2026-11-03",
    width: 400,
    height: 200,
    nodes: [
      { id: "a", kind: "script", x: 0, y: 0, w: 100, h: 60, name: "A" },
      { id: "b", kind: "script", x: 100, y: 0, w: 100, h: 60, name: "B" },
    ],
    wires: [],
  } as unknown as MdmarkFlowDefinition;
  // 実行
  const inquiry = checkFlowLayout(parsed<MdmarkFlowDefinition>(INQUIRY_TEXT));
  const edges = checkFlowLayout(touching);
  // 検証
  expect(inquiry).toEqual([]);
  expect(edges).toEqual([]);
});

// 重なり・はみ出し・横切り・ラベルの長さを返却する（異常系）
test("test_check_flow_layout_when_broken", async () => {
  // 準備
  const { checkFlowLayout } = await loadCheck();
  // 実行
  const issues = checkFlowLayout(BROKEN_FLOW);
  // 検証
  expect(issues).toHaveLength(4);
  const byKind = (kind: string) =>
    issues.filter((issue) => issue.kind === kind);
  expect(
    byKind("diagram_node_overlap").map((issue) => [...issue.ids].sort()),
  ).toEqual([["db", "web"]]);
  expect(byKind("diagram_node_overflow").map((issue) => issue.ids)).toEqual([
    ["queue"],
  ]);
  expect(
    byKind("diagram_wire_crosses_node").map((issue) => [...issue.ids].sort()),
  ).toEqual([["cache", "w1"]]);
  expect(byKind("diagram_label_too_long").map((issue) => issue.ids)).toEqual([
    ["batch"],
  ]);
});

// 全角と半角の幅で折り返す（正常系）
test("test_label_line_count", async () => {
  // 準備
  const { labelLineCount } = await loadCheck();
  // 実行
  const wide = labelLineCount({
    text: "あいうえおか",
    fontSize: 14,
    width: 70,
  });
  const narrow = labelLineCount({ text: "abcdefgh", fontSize: 14, width: 70 });
  // 検証
  expect(wide).toBe(2);
  expect(narrow).toBe(1);
});
