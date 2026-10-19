import { expect, test } from "vitest";
import type {
  MdmarkChartDefinition,
  MdmarkFlowDefinition,
  MdmarkSequenceDefinition,
} from "../../../../src/diagram/definition.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  parsed,
  REPLY_TIME_TEXT,
} from "../../helpers/diagrams.ts";
import { findTag, matches } from "../../helpers/html.ts";

/** 図の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagram = () => import("../../../../src/parts/diagram.ts");

/** 図の枠を描くときの本体 */
const BODY = {
  html: '<svg class="mdmark-diagram-wires"></svg>',
  width: 1100,
  height: 560,
  tips: "",
};

/** `html` の中で `needles` が書いた順に現れるか */
function inOrder(html: string, needles: string[]): boolean {
  let from = 0;
  for (const needle of needles) {
    const at = html.indexOf(needle, from);
    if (at < 0) {
      return false;
    }
    from = at + needle.length;
  }
  return true;
}

/** `data-wire` を持つ線のパスの最初の点の y を、現れた順に返す（`loop` の線を除く） */
function wireStartYs(html: string): number[] {
  return matches(html, /<path[^>]*class="mdmark-diagram-wire"[^>]*>/g)
    .filter((tag) => !tag.includes('data-line="loop"'))
    .map((tag) => {
      const d = /\sd="([^"]*)"/.exec(tag)?.[1] ?? "";
      const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      return numbers[1] ?? Number.NaN;
    });
}

/** 箱 `id` の `left` を返す */
function leftOf(html: string, id: string): number {
  const tag = findTag(html, `data-node="${id}"`);
  return Number(/left:\s*(-?\d+(?:\.\d+)?)px/.exec(tag)?.[1] ?? Number.NaN);
}

// 題・ボタンの帯・凡例をこの順に出す（正常系）
test("test_render_diagram_frame", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "問い合わせへの自動返信の構成",
    scope: "メールを受け取ってから返信するまで",
    updated: "2026-10-17",
    legend: [
      { sample: "script", label: "スクリプト" },
      { sample: "flow", label: "処理の流れ" },
    ],
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  expect(html).toContain("figure");
  expect(html).toContain("mdmark-diagram");
  expect(
    inOrder(html, [
      "<figcaption",
      'role="toolbar"',
      'role="group"',
      'aria-label="凡例"',
    ]),
  ).toBe(true);
  expect(html).toMatch(
    /<[a-z]+[^>]*\bhidden\b[^>]*>[\s\S]*?aria-label="左へ動かす"/,
  );
  expect(html).toContain("問い合わせへの自動返信の構成");
  expect(html).toContain("2026-10-17");
});

// モーダルでは閉じるボタンを置き、全画面で開くボタンを置かない（正常系）
test("test_render_diagram_frame_when_modal", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "題",
    scope: "範囲",
    updated: "2026-10-17",
    legend: [],
    modal: true,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  expect(html).toContain('aria-label="全画面を閉じる"');
  expect(html).not.toContain('aria-label="全画面で開く"');
});

// 枠・層・箱・線・ツールチップを出す（正常系）
test("test_render_flow", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  // 実行
  const { html, tips } = renderFlow(definition, "d1");
  // 検証
  expect(matches(html, /class="mdmark-diagram-lane"/g)).toHaveLength(3);
  expect(matches(html, /class="mdmark-diagram-node[ "]/g)).toHaveLength(9);
  expect(matches(html, /class="mdmark-diagram-wire"/g)).toHaveLength(10);
  const withTip = definition.wires.filter((wire) => wire.tip).length;
  const withIo = definition.nodes.filter((node) => node.io).length;
  expect(matches(tips, /role="tooltip"/g)).toHaveLength(withTip + withIo);
  expect(html).toMatch(
    /<path[^>]*data-line="loop"[^>]*stroke-dasharray="8 4"|<path[^>]*stroke-dasharray="8 4"[^>]*data-line="loop"/,
  );
});

// 定義の文字の HTML を文字にする（異常系）
test("test_render_flow_when_text_escaped", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  const first = definition.nodes[0];
  if (first === undefined) {
    throw new Error("見本の箱が無い");
  }
  first.name = "<img src=x onerror=alert(1)>";
  // 実行
  const { html } = renderFlow(definition, "d1");
  // 検証
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
});

// 相手とメッセージを順に置く（正常系）
test("test_render_sequence", async () => {
  // 準備
  const { renderSequence } = await loadDiagram();
  const definition = parsed<MdmarkSequenceDefinition>(INQUIRY_SEQ_TEXT);
  // 実行
  const { html } = renderSequence(definition, "d1");
  // 検証
  const lefts = definition.participants.map((p) => leftOf(html, p.id));
  expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
  expect(new Set(lefts).size).toBe(lefts.length);
  const ys = wireStartYs(html);
  expect(ys).toHaveLength(definition.steps.length);
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
  expect(matches(html, /data-line="reply"/g).length).toBeGreaterThanOrEqual(2);
  expect(html).toMatch(/data-line="loop"/);
  expect(html).toContain("stroke-dasharray");
  expect(html).toContain(definition.loop?.label ?? "");
});

// 系列ごとに線と点を描き、読み上げに値を載せる（正常系）
test("test_render_chart", async () => {
  // 準備
  const { renderChart } = await loadDiagram();
  const definition = parsed<MdmarkChartDefinition>(REPLY_TIME_TEXT);
  // 実行
  const { html, tips } = renderChart(definition);
  // 検証
  expect(matches(html, /<path[^>]*data-series="1"/g)).toHaveLength(1);
  expect(matches(html, /<path[^>]*data-series="2"/g)).toHaveLength(1);
  expect(matches(html, /class="mdmark-diagram-point"/g)).toHaveLength(10);
  expect(html).toContain(
    'aria-label="返信までの時間。自動返信: 12・9・14・8・10。担当者: 42・38・51・35・44"',
  );
  expect(tips).toBe("");
});

// 出るものだけを載せる（正常系）
test("test_legend_for", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const definition: MdmarkFlowDefinition = {
    title: "小さな図",
    scope: "確かめ",
    updated: "2026-10-18",
    width: 400,
    height: 200,
    nodes: [
      { id: "a", kind: "external", x: 0, y: 0, w: 100, h: 60, name: "外" },
      { id: "b", kind: "script", x: 200, y: 0, w: 100, h: 60, name: "中" },
    ],
    wires: [
      {
        id: "w1",
        from: "a",
        to: "b",
        line: "flow",
        points: [
          [100, 30],
          [200, 30],
        ],
      },
      {
        id: "w2",
        from: "b",
        to: "a",
        line: "read",
        points: [
          [200, 45],
          [100, 45],
        ],
      },
    ],
  };
  // 実行
  const items = legendFor(definition, { jumps: false, terms: false });
  // 検証
  const labels = items.map((item) => item.label);
  expect(labels).toContain("処理の流れ");
  expect(labels).toContain("読む");
  expect(
    labels.filter((label) => /処理の流れ|読む|書く|返す|戻る/.test(label)),
  ).toHaveLength(2);
  expect(labels.some((label) => label.includes("システムの枠"))).toBe(false);
  expect(labels.some((label) => label.includes("交差"))).toBe(false);
  expect(labels.some((label) => label.includes("（枠の外）"))).toBe(false);
});

// 入力・処理・出力を 3 行に出す（正常系）
test("test_render_diagram_tip", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "io",
    label: "分類",
    io: { in: "本文", do: "種類を選ぶ", out: "返信の種類" },
  });
  // 検証
  expect(
    inOrder(html, ["入力", "本文", "処理", "種類を選ぶ", "出力", "返信の種類"]),
  ).toBe(true);
  expect(html).toContain('role="tooltip"');
  expect(html).toMatch(/\bhidden\b/);
});
