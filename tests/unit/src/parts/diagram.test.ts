import { expect, test } from "vitest";
import type {
  MdmarkChartDefinition,
  MdmarkFlowDefinition,
  MdmarkSequenceDefinition,
} from "../../../../src/diagram/definition.ts";
import { iconSvg } from "../../../../src/parts/icons.ts";
import {
  INQUIRY_COUNT_TEXT,
  INQUIRY_HINT_TEXT,
  LENGTH_TIME_TEXT,
  REPLY_KIND_TEXT,
} from "../../helpers/charts.ts";
import {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  parsed,
  REPLY_TIME_TEXT,
} from "../../helpers/diagrams.ts";
import { findTag, matches, outerHtml, plainText } from "../../helpers/html.ts";

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

/** 塗りの模様 `id` の `pattern` 要素の中身を返す（無ければ空） */
function patternOf(html: string, id: string): string {
  const pattern = new RegExp(
    `<pattern[^>]*id="${id}"[^>]*>([\\s\\S]*?)</pattern>`,
  );
  return pattern.exec(html)?.[1] ?? "";
}

/** 軸の目盛りの文字のうち数だけを、現れた順に返す */
function axisNumbers(html: string): number[] {
  return matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  ).map((text) => Number(plainText(text)));
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
  const { html, tips } = renderFlow(definition, "d1", true);
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
  const { html } = renderFlow(definition, "d1", true);
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
  const { html, tips } = renderChart(definition, "d1");
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

// hint だけを文として出す（正常系）
test("test_render_diagram_tip_when_hint", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "hint",
    label: "分類",
    hint: "<b>太字</b>",
  });
  // 検証
  expect(html).not.toContain("mdmark-term-tip-heading");
  expect(html).not.toContain("mdmark-diagram-tip-io");
  expect(html).toContain("&lt;b&gt;太字&lt;/b&gt;");
  expect(html).not.toContain("<b>");
  expect(html).toContain('role="tooltip"');
  expect(html).toMatch(/\bhidden\b/);
});

// 戻すのボタンを置かず、倍率をボタンにする（正常系）
test("test_render_diagram_frame_when_zoom_button", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "題",
    scope: "範囲",
    updated: "2026-10-17",
    legend: [],
    zoom: 0.55,
    id: "d1",
  };
  const zoomName = "倍率 55%。全体が収まる倍率に戻す";
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  const names = matches(
    html,
    /aria-label="(?:縮小|倍率 55%。全体が収まる倍率に戻す|拡大|全画面で開く)"/g,
  ).map((attribute) => attribute.slice('aria-label="'.length, -1));
  expect(names).toEqual(["縮小", zoomName, "拡大", "全画面で開く"]);
  const zoomButton = outerHtml(html, `aria-label="${zoomName}"`);
  expect(zoomButton.startsWith("<button")).toBe(true);
  expect(plainText(zoomButton)).toBe("55%");
  expect(html).not.toContain(iconSvg("rotate-ccw"));
});

// 棒を系列ごとの塗りの模様で描き、縦の軸をデータから切る（正常系）
test("test_render_chart_when_bar", async () => {
  // 準備
  const { renderChart } = await loadDiagram();
  const definition = parsed<MdmarkChartDefinition>(INQUIRY_COUNT_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<rect[^>]*class="mdmark-diagram-bar"/g)).toHaveLength(
    8,
  );
  const second = /<g data-series="2">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  expect(matches(second, /fill="url\(#d1-fill-2\)"/g)).toHaveLength(4);
  expect(patternOf(html, "d1-fill-1")).not.toContain("<path");
  expect(patternOf(html, "d1-fill-2")).toContain("<path");
  expect(axisNumbers(html)).toEqual([0, 50, 100, 150]);
});

// 扇形の外に合計 100 の整数の割合を置き、凡例に名前と値を出す（正常系）
test("test_render_chart_when_pie", async () => {
  // 準備
  const { renderChart } = await loadDiagram();
  const definition = parsed<MdmarkChartDefinition>(REPLY_KIND_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  expect(matches(html, /<path[^>]*class="mdmark-diagram-slice"/g)).toHaveLength(
    3,
  );
  const percents = matches(
    html,
    /<text[^>]*class="mdmark-diagram-value-text"[^>]*>[^<]*<\/text>/g,
  ).map((text) => plainText(text));
  expect(percents).toEqual(["62%", "31%", "7%"]);
  expect(html).toContain("よくある質問で答えた: 186 件");
});

// 横と縦を数値の軸にして系列ごとの形の点を置く（正常系）
test("test_render_chart_when_scatter", async () => {
  // 準備
  const { renderChart } = await loadDiagram();
  const definition = parsed<MdmarkChartDefinition>(LENGTH_TIME_TEXT);
  // 実行
  const { html } = renderChart(definition, "d1");
  // 検証
  const first = /<g data-series="1">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  const second = /<g data-series="2">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? "";
  expect(
    matches(first, /<circle[^>]*class="mdmark-diagram-point"/g),
  ).toHaveLength(6);
  expect(
    matches(second, /<rect[^>]*class="mdmark-diagram-point"/g),
  ).toHaveLength(6);
  // 縦の軸の目盛りに加え、横の軸（中央揃えの文字）も数値の目盛りを持つ
  const horizontal = matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*text-anchor="middle"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  );
  expect(horizontal.length).toBeGreaterThanOrEqual(2);
  expect(axisNumbers(html).length).toBeGreaterThan(horizontal.length);
});

// hint だけを持つ箱にも印を置き、hints がオフなら印もツールチップも置かない（正常系）
test("test_render_flow_when_hint", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_HINT_TEXT);
  const label = definition.wires.find((wire) => wire.label)?.label ?? "";
  const mark = 'aria-label="「窓口の MCP」の説明"';
  // 実行
  const on = renderFlow(definition, "d1", true);
  const off = renderFlow(definition, "d1", false);
  // 検証
  expect(on.html).toContain(mark);
  expect(on.tips).toContain("保存と送信のツールだけを持つ MCP サーバー");
  expect(off.html).not.toContain(mark);
  expect(off.html).not.toContain("mdmark-diagram-info");
  expect(off.tips).not.toContain('role="tooltip"');
  expect(off.html).not.toContain("aria-describedby");
  expect(off.html).toContain("窓口の MCP");
  expect(label).not.toBe("");
  expect(off.html).toContain(label);
});
