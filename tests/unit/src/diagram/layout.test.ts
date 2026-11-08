import { expect, test } from "vitest";
import type { MdmarkFlowDefinition } from "../../../../src/diagram/definition.ts";
import { JUDGEMENT_AUTO_TEXT, parsed } from "../../helpers/diagrams.ts";

/** 判定フローチャートの配置を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLayout = () => import("../../../../src/diagram/layout.ts");

/** 配置の点検を読み込む */
const loadCheck = () => import("../../../../src/diagram/check.ts");

type Laid = MdmarkFlowDefinition & { width: number; height: number };
type Box = { id: string; x: number; y: number; w: number; h: number };

/** 配置した定義からノードを `id` で参照する */
function node(definition: MdmarkFlowDefinition, id: string): Box {
  const found = definition.nodes.find((item) => item.id === id) as
    | Box
    | undefined;
  if (found === undefined) {
    throw new Error(`ノードが無い: ${id}`);
  }
  return found;
}

/** 線の点が縦と横の線分だけか */
function orthogonal(definition: MdmarkFlowDefinition): boolean {
  return definition.wires.every((wire) => {
    const points = (wire as { points?: Array<[number, number]> }).points ?? [];
    return (
      points.length >= 2 &&
      points.slice(1).every((point, index) => {
        const previous = points[index];
        return (
          previous !== undefined &&
          (point[0] === previous[0] || point[1] === previous[1])
        );
      })
    );
  });
}

// モックの judgement-auto と同じ列と行の関係に配置する（正常系）
test("test_layout_flowchart", async () => {
  // 準備
  const { layoutFlowchart } = await loadLayout();
  const { checkFlowLayout } = await loadCheck();
  const definition = parsed<MdmarkFlowDefinition>(JUDGEMENT_AUTO_TEXT);
  // 実行
  const laid = layoutFlowchart(definition) as Laid;
  // 検証
  const expectedY = { start: 16, q1: 156, a1: 188, q2: 332, r1: 370, r2: 508 };
  const expectedSize = {
    start: [100, 100],
    q1: [280, 136],
    a1: [200, 72],
    q2: [280, 136],
    r1: [200, 60],
    r2: [200, 60],
  };
  for (const [id, y] of Object.entries(expectedY)) {
    const box = node(laid, id);
    expect(box.y).toBe(y);
    expect([box.w, box.h]).toEqual(
      expectedSize[id as keyof typeof expectedSize],
    );
  }
  expect(laid.height).toBe(584);
  const center = (id: string) => node(laid, id).x + node(laid, id).w / 2;
  expect(new Set(["start", "q1", "q2", "r2"].map(center)).size).toBe(1);
  expect(node(laid, "q1").x).toBe(16);
  const rightX = node(laid, "q1").x + node(laid, "q1").w + 120;
  expect(node(laid, "a1").x).toBe(rightX);
  expect(node(laid, "r1").x).toBe(rightX);
  expect(laid.width).toBe(rightX + 200 + 16);
  expect(orthogonal(laid)).toBe(true);
  expect(checkFlowLayout(laid)).toEqual([]);
  expect(definition.nodes[0]).not.toHaveProperty("x");
});

// 両方の先が結果なら NO を下、YES を右に配置する（正常系）
test("test_layout_flowchart_when_both_results", async () => {
  // 準備
  const { layoutFlowchart } = await loadLayout();
  const definition = {
    title: "判定",
    scope: "点検",
    updated: "2026-11-05",
    nodes: [
      { id: "start", kind: "start", name: "始める" },
      { id: "q", kind: "question", name: "回答できるか" },
      { id: "yes", kind: "result", name: "返信する" },
      { id: "no", kind: "result", name: "起票する" },
    ],
    wires: [
      { id: "w0", from: "start", to: "q", line: "flow" },
      { id: "w1", from: "q", to: "yes", line: "flow", label: "YES" },
      { id: "w2", from: "q", to: "no", line: "flow", label: "NO" },
    ],
  } as unknown as MdmarkFlowDefinition;
  // 実行
  const laid = layoutFlowchart(definition);
  // 検証
  const q = node(laid, "q");
  const yes = node(laid, "yes");
  const no = node(laid, "no");
  expect(yes.y + yes.h / 2).toBe(q.y + q.h / 2);
  expect(yes.x).toBeGreaterThan(q.x + q.w);
  expect(no.y).toBeGreaterThan(q.y + q.h);
  expect(no.x + no.w / 2).toBe(q.x + q.w / 2);
});

// 名前が収まらないノードの高さを追加し、配置のずれを出さない（正常系）
test("test_layout_flowchart_when_long_name", async () => {
  // 準備
  const { layoutFlowchart } = await loadLayout();
  const { checkFlowLayout } = await loadCheck();
  const definition = parsed<MdmarkFlowDefinition>(JUDGEMENT_AUTO_TEXT);
  Object.assign(node(definition, "a1") as object, { name: "あ".repeat(40) });
  // 実行
  const laid = layoutFlowchart(definition);
  // 検証
  expect(node(laid, "a1").h).toBeGreaterThan(72);
  expect(checkFlowLayout(laid)).toEqual([]);
});

// 開始から届かないノードを一番下に並べる（正常系）
test("test_layout_flowchart_when_unreachable", async () => {
  // 準備
  const { layoutFlowchart } = await loadLayout();
  const { checkFlowLayout } = await loadCheck();
  const definition = parsed<MdmarkFlowDefinition>(JUDGEMENT_AUTO_TEXT);
  definition.nodes.push({
    id: "lost",
    kind: "result",
    name: "どこにもつながらない",
  } as unknown as MdmarkFlowDefinition["nodes"][number]);
  // 実行
  const laid = layoutFlowchart(definition);
  // 検証
  const lost = node(laid, "lost");
  const others = laid.nodes
    .map((item) => item as unknown as Box)
    .filter((item) => item.id !== "lost");
  expect(others.every((item) => lost.y > item.y + item.h)).toBe(true);
  expect(checkFlowLayout(laid)).toEqual([]);
});

// 下の質問から上の行の結果へ入る線を、結果の下辺で止める（正常系）
test("test_layout_flowchart_when_shared_result", async () => {
  // 準備
  const { layoutFlowchart } = await loadLayout();
  const definition = {
    title: "判定",
    scope: "点検",
    updated: "2026-11-05",
    nodes: [
      { id: "start", kind: "start", name: "始める" },
      { id: "q1", kind: "question", name: "よくある質問か" },
      { id: "q2", kind: "question", name: "担当者が回答できるか" },
      { id: "ok", kind: "result", name: "返信する" },
      { id: "ng", kind: "result", name: "起票する" },
    ],
    wires: [
      { id: "w0", from: "start", to: "q1", line: "flow" },
      { id: "w1", from: "q1", to: "ok", line: "flow", label: "YES" },
      { id: "w2", from: "q1", to: "q2", line: "flow", label: "NO" },
      { id: "w3", from: "q2", to: "ok", line: "flow", label: "YES" },
      { id: "w4", from: "q2", to: "ng", line: "flow", label: "NO" },
    ],
  } as unknown as MdmarkFlowDefinition;
  // 実行
  const laid = layoutFlowchart(definition);
  // 検証
  const ok = node(laid, "ok");
  const q2 = node(laid, "q2");
  expect(ok.y + ok.h).toBeLessThan(q2.y + q2.h / 2);
  const points = laid.wires.find((wire) => wire.id === "w3")?.points ?? [];
  expect(points.at(-1)).toEqual([ok.x + ok.w / 2, ok.y + ok.h]);
  expect(orthogonal(laid)).toBe(true);
});
