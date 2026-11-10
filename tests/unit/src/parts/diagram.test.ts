import { expect, test } from "vitest";
import type {
  MdmarkChartDefinition,
  MdmarkErDefinition,
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
  INQUIRY_GROUPS_TEXT,
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  JUDGEMENT_TEXT,
  LINKED_TEXT,
  parsed,
  REPLY_TIME_TEXT,
  SINGLE_KINDS_TEXT,
} from "../../helpers/diagrams.ts";
import { shopEr } from "../../helpers/er.ts";
import { findTag, matches, outerHtml, plainText } from "../../helpers/html.ts";

/** 図の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagram = () => import("../../../../src/parts/diagram.ts");

/** グラフの部品を読み込む（`renderChart` はモジュール構成『図』で `src/parts/chart.ts` に配置する） */
const loadChart = () => import("../../../../src/parts/chart.ts");

/** 図の枠を描くときの本体 */
const BODY = {
  html: '<svg class="mdmark-diagram-wires"></svg>',
  width: 1100,
  height: 560,
  tips: "",
};

/** `html` の中で `needles` が記載した順に現れるか */
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

/** `data-wire` を持つ線のパスの最初の点の y を、現れた順に返却する（`loop` の線を除く） */
function wireStartYs(html: string): number[] {
  return matches(html, /<path[^>]*class="mdmark-diagram-wire"[^>]*>/g)
    .filter((tag) => !tag.includes('data-line="loop"'))
    .map((tag) => {
      const d = /\sd="([^"]*)"/.exec(tag)?.[1] ?? "";
      const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      return numbers[1] ?? Number.NaN;
    });
}

/** 塗りの模様 `id` の `pattern` 要素の中身を返却する（無ければ空） */
function patternOf(html: string, id: string): string {
  const pattern = new RegExp(
    `<pattern[^>]*id="${id}"[^>]*>([\\s\\S]*?)</pattern>`,
  );
  return pattern.exec(html)?.[1] ?? "";
}

/** 軸の目盛りの文字のうち数だけを、現れた順に返却する */
function axisNumbers(html: string): number[] {
  return matches(
    html,
    /<text[^>]*class="mdmark-diagram-axis-text"[^>]*>-?\d+(?:\.\d+)?<\/text>/g,
  ).map((text) => Number(plainText(text)));
}

/** ノード `id` の `left` を返却する */
function leftOf(html: string, id: string): number {
  const tag = findTag(html, `data-node="${id}"`);
  return Number(/left:\s*(-?\d+(?:\.\d+)?)px/.exec(tag)?.[1] ?? Number.NaN);
}

// タイトル・ボタンの帯・凡例をこの順に出す（正常系）
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

// モーダルでは閉じるボタンを配置し、全画面で開くボタンを配置しない（正常系）
test("test_render_diagram_frame_when_modal", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "タイトル",
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

// 枠・層・ノード・線・ツールチップを出す（正常系）
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

// 判定フローチャートのノードを種類ごとの構造と余白で描く（正常系）
test("test_render_flow_when_judgement", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(JUDGEMENT_TEXT);
  // 実行
  const { html } = renderFlow(definition, "d1", true);
  // 検証
  const counts = ["start", "question", "action", "result"].map(
    (kind) =>
      matches(
        html,
        new RegExp(
          `<div[^>]*class="mdmark-diagram-node[ "][^>]*data-kind="${kind}"`,
          "g",
        ),
      ).length,
  );
  expect(counts).toEqual([1, 2, 1, 2]);
  const diamonds = matches(
    html,
    /<svg[^>]*viewBox="0 0 280 136"[^>]*>[\s\S]*?<\/svg>/g,
  );
  expect(diamonds).toHaveLength(2);
  for (const diamond of diamonds) {
    expect(diamond).toContain('aria-hidden="true"');
    expect(diamond).toContain('points="140,0 280,68 140,136 0,68"');
  }
  expect(findTag(html, 'data-node="q0"')).toContain("padding:34px 70px");
  expect(findTag(html, 'data-node="start"')).toContain("padding:14.6px");
  expect(findTag(html, 'data-node="a1"')).not.toContain("padding:");
  expect(html).toContain(">YES<");
  expect(html).toContain(">NO<");
});

// 定義の文字の HTML を文字にする（異常系）
test("test_render_flow_when_text_escaped", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  const first = definition.nodes[0];
  if (first === undefined) {
    throw new Error("見本のノードが無い");
  }
  first.name = "<img src=x onerror=alert(1)>";
  // 実行
  const { html } = renderFlow(definition, "d1", true);
  // 検証
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
});

// 相手とメッセージを順に配置する（正常系）
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

// 系列ごとに線と点を描き、スクリーンリーダーに値を記載する（正常系）
test("test_render_chart", async () => {
  // 準備
  const { renderChart } = await loadChart();
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
  expect(matches(tips, /role="tooltip"/g)).toHaveLength(10);
});

// 出るものだけを記載する（正常系）
test("test_legend_for", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const definition: MdmarkFlowDefinition = {
    title: "小さな図",
    scope: "確認",
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
  const items = legendFor(definition);
  // 検証
  const labels = items.map((item) => item.label);
  expect(labels).toContain("処理の流れ");
  expect(labels).toContain("読み込む");
  expect(
    labels.filter((label) =>
      /処理の流れ|読み込む|書き込む|返却する|戻る/.test(label),
    ),
  ).toHaveLength(2);
  expect(labels.some((label) => label.includes("システムの枠"))).toBe(false);
  expect(labels.some((label) => label.includes("交差"))).toBe(false);
  expect(labels.some((label) => label.includes("（枠の外）"))).toBe(false);
});

// 判定フローチャートは追加した種類だけを凡例に出す（正常系）
test("test_legend_for_when_judgement", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(JUDGEMENT_TEXT);
  // 実行
  const items = legendFor(definition);
  // 検証
  const labels = items.map((item) => item.label);
  const kinds = ["開始", "質問", "アクション", "結果"];
  expect(labels.filter((label) => kinds.includes(label))).toEqual(kinds);
  expect(labels).not.toContain("意思決定モデル");
  expect(labels).not.toContain("データ（下の角が丸いノード）");
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

// 戻すのボタンを配置せず、倍率をボタンにする（正常系）
test("test_render_diagram_frame_when_zoom_button", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "タイトル",
    scope: "範囲",
    updated: "2026-10-17",
    legend: [],
    zoom: 0.6875,
    fit: 0.55,
    id: "d1",
  };
  const zoomName = "倍率 125%。全体が収まる倍率に戻す";
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  const names = matches(
    html,
    /aria-label="(?:縮小|倍率 125%。全体が収まる倍率に戻す|拡大|全画面で開く)"/g,
  ).map((attribute) => attribute.slice('aria-label="'.length, -1));
  expect(names).toEqual(["縮小", zoomName, "拡大", "全画面で開く"]);
  const zoomButton = outerHtml(html, `aria-label="${zoomName}"`);
  expect(zoomButton.startsWith("<button")).toBe(true);
  expect(plainText(zoomButton)).toBe("125%");
  expect(html).not.toContain(iconSvg("rotate-ccw"));
});

// 棒を系列ごとの塗りの模様で描き、縦の軸をデータから切る（正常系）
test("test_render_chart_when_bar", async () => {
  // 準備
  const { renderChart } = await loadChart();
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

// 扇形の外に合計 100 の整数の割合を配置し、凡例に名前と値を出す（正常系）
test("test_render_chart_when_pie", async () => {
  // 準備
  const { renderChart } = await loadChart();
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
  expect(html).toContain("よくある質問で回答した: 186 件");
});

// 横と縦を数値の軸にして系列ごとの構造の点を配置する（正常系）
test("test_render_chart_when_scatter", async () => {
  // 準備
  const { renderChart } = await loadChart();
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

// hint だけを持つノードにもマーカーを配置し、hints がオフならマーカーもツールチップも配置しない（正常系）
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

// 組み合わせ・バブル・ドーナツの凡例を出す（正常系）
test("test_legend_for_when_chart_types_added", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const base = { title: "タイトル", scope: "範囲", updated: "2026-11-03" };
  const combo = {
    ...base,
    type: "combo",
    x: { label: "月", ticks: ["1", "2"] },
    y: { label: "件" },
    y2: { label: "%" },
    series: [
      { name: "件数", points: [1, 2], as: "bar" },
      { name: "割合", points: [3, 4], as: "line", axis: "y2" },
    ],
  } as MdmarkChartDefinition;
  const bubble = {
    ...base,
    type: "bubble",
    x: { label: "横" },
    y: { label: "縦" },
    size: { label: "件数" },
    series: [{ name: "問い合わせ", points: [[1, 2, 3]] }],
  } as MdmarkChartDefinition;
  const donut = {
    ...base,
    type: "donut",
    unit: " 件",
    items: [
      { name: "回答した", value: 186 },
      { name: "回した", value: 92 },
    ],
  } as MdmarkChartDefinition;
  // 実行
  const comboLabels = legendFor(combo).map((item) => item.label);
  const bubbleLabels = legendFor(bubble).map((item) => item.label);
  const donutLabels = legendFor(donut).map((item) => item.label);
  // 検証
  expect(comboLabels).toContain("件数（左の軸）");
  expect(comboLabels).toContain("割合（右の軸）");
  expect(bubbleLabels).toContain("円の面積: 件数");
  expect(donutLabels).toContain("回答した: 186 件");
  expect(donutLabels).toContain("回した: 92 件");
});

// テーブル・関係の線・多重度・ラベルを描く（正常系）
test("test_render_er", async () => {
  // 準備
  const { renderEr } = await loadDiagram();
  const definition = shopEr();
  // 実行
  const { html, tips, width, height } = renderEr(definition, "d1", true);
  // 検証
  expect(matches(html, /class="mdmark-diagram-er-table/g)).toHaveLength(
    definition.tables.length,
  );
  expect(matches(html, /<path[^>]*data-line="er"/g)).toHaveLength(
    definition.relations.length,
  );
  expect(
    matches(html, /class="mdmark-diagram-er-end"/g).length,
  ).toBeGreaterThanOrEqual(definition.relations.length * 2);
  for (const relation of definition.relations) {
    expect(plainText(html)).toContain(relation.label ?? "");
  }
  expect(matches(html, /data-er-from="/g)).toHaveLength(
    definition.relations.length,
  );
  expect(width).toBe(definition.width);
  expect(height).toBeGreaterThan(0);
  expect(plainText(tips)).toContain("注文（orders）");
});

// hints がオフなら説明のボタンとツールチップを配置しない（正常系）
test("test_render_er_when_hints_off", async () => {
  // 準備
  const { renderEr } = await loadDiagram();
  // 実行
  const { html, tips } = renderEr(shopEr(), "d1", false);
  // 検証
  expect(html).not.toContain("mdmark-diagram-info");
  expect(tips).toBe("");
});

// ER 図は図にある種類・マーカー・多重度だけを凡例に出す（正常系）
test("test_legend_for_when_er", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const definition: MdmarkErDefinition = {
    title: "マスターだけ",
    scope: "確認",
    updated: "2026-11-03",
    width: 600,
    tables: [
      {
        id: "a",
        name: "a",
        label: "親",
        kind: "master",
        desc: "説明",
        x: 0,
        y: 0,
        w: 200,
        columns: [{ name: "id", type: "bigint", pk: true, nn: true }],
      },
      {
        id: "b",
        name: "b",
        label: "子",
        kind: "master",
        x: 300,
        y: 0,
        w: 200,
        columns: [{ name: "a_id", type: "bigint", nn: true }],
      },
    ],
    relations: [
      {
        from: "a",
        fromColumn: "id",
        fromCard: "1",
        to: "b",
        toColumn: "a_id",
        toCard: "0..n",
      },
    ],
  };
  // 実行
  const items = legendFor(definition);
  // 検証
  expect(items.map((item) => item.label)).toEqual([
    "マスターのテーブル",
    "主キー",
    "NOT NULL",
    "1 つ",
    "0 以上",
  ]);
});

// テーブルの概要と列の説明を出す（正常系）
test("test_render_diagram_tip_when_table", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "table",
    label: "注文",
    table: {
      id: "orders",
      name: "orders",
      label: "注文",
      desc: "1 回の注文",
      x: 0,
      y: 0,
      w: 200,
      columns: [
        { name: "id", type: "bigint", pk: true },
        { name: "status", type: "text", desc: "状態" },
        { name: "total", type: "integer", desc: "合計" },
      ],
    },
  });
  // 検証
  const text = plainText(html);
  expect(text).toContain("注文（orders）");
  expect(text.indexOf("1 回の注文")).toBeLessThan(text.indexOf("status"));
  expect(text.indexOf("status")).toBeLessThan(text.indexOf("状態"));
  expect(text.indexOf("状態")).toBeLessThan(text.indexOf("total"));
  expect(html).not.toMatch(/<code>id<\/code>/);
  expect(html).toContain('role="tooltip"');
  expect(html).toMatch(/\bhidden\b/);
});

// 定義の文字の {{単語}} を用語の下線にする（正常系）
test("test_render_er_when_terms", async () => {
  // 準備
  const { renderEr } = await loadDiagram();
  const definition = shopEr();
  const customers = definition.tables.find((t) => t.id === "customers");
  if (customers) {
    customers.label = "{{顧客}}";
    customers.columns.push({ name: "rank", type: "text" });
  }
  definition.relations = definition.relations.map((r) =>
    r.label === "注文する" ? { ...r, label: "{{注文}}する" } : r,
  );
  const meanings: Record<string, string> = {
    顧客: "注文する人",
    注文: "1 回の買い物",
  };
  // 実行
  const { html, tips, terms } = renderEr(
    definition,
    "d1",
    true,
    (word) => meanings[word],
  );
  // 検証
  expect(matches(html, /class="mdmark-term"/g)).toHaveLength(2);
  expect(plainText(html)).not.toContain("{{");
  expect(plainText(html)).not.toContain("}}");
  expect(plainText(tips)).toContain("注文する人");
  expect(plainText(tips)).not.toContain("{{");
  expect(terms).toBe(true);
  expect(html).toContain('aria-label="「顧客」の説明"');
  expect(html).toContain('aria-label="「顧客」の主キーと外部キー以外の列"');
});

// href を持つノードをリンクにし、マーカーをリンクの外に配置する（正常系）
test("test_render_flow_when_node_link", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(LINKED_TEXT);
  // 実行
  const { html } = renderFlow(definition, "d1", true);
  // 検証
  const links = matches(
    html,
    /<a class="mdmark-diagram-node-link" href="([^"]*)" aria-label="([^"]*)"><\/a>/g,
  );
  expect(links).toEqual([
    '<a class="mdmark-diagram-node-link" href="https://example.com/spec" aria-label="問い合わせを受け取る"></a>',
    '<a class="mdmark-diagram-node-link" href="./other.md" aria-label="分類する"></a>',
  ]);
  expect(
    matches(html, /class="mdmark-diagram-node[^"]*\bhas-link\b[^"]*"/g),
  ).toHaveLength(2);
  const classify = html.slice(html.indexOf('data-node="classify"'));
  const linkAt = classify.indexOf("mdmark-diagram-node-link");
  const tipAt = classify.indexOf("aria-describedby");
  expect(linkAt).toBeGreaterThan(-1);
  expect(tipAt).toBeGreaterThan(linkAt);
  const store = html.slice(
    html.indexOf('data-node="store"'),
    html.indexOf("</div>", html.indexOf('data-node="store"')),
  );
  expect(store).not.toContain("<a ");
});

// リサイズハンドルを配置し、モーダルと `resizable: false` では配置しない（正常系）
test("test_render_diagram_frame_when_resizable", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const base = {
    kind: "flow" as const,
    title: "問い合わせの流れ",
    scope: "範囲",
    updated: "2026-11-05",
    legend: [],
    id: "d1",
  };
  // 実行
  const omitted = renderDiagramFrame(base, BODY);
  const off = renderDiagramFrame({ ...base, resizable: false }, BODY);
  const modal = renderDiagramFrame({ ...base, modal: true }, BODY);
  // 検証
  const handle = findTag(omitted, 'class="mdmark-diagram-resize"');
  expect(handle).toContain('role="separator"');
  expect(handle).toContain('aria-orientation="horizontal"');
  expect(handle).toContain('tabindex="0"');
  expect(handle).toContain('aria-label="「問い合わせの流れ」の表示の高さ"');
  expect(outerHtml(omitted, 'class="mdmark-diagram-resize"')).toContain(
    iconSvg("grip-horizontal"),
  );
  expect(off).not.toContain("mdmark-diagram-resize");
  expect(modal).not.toContain("mdmark-diagram-resize");
});

// 凡例の項目が空なら凡例を隠し、タイトルを留めない図にマーカーを付ける（正常系）
test("test_render_diagram_frame_when_no_legend", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "タイトル",
    scope: "範囲",
    updated: "2026-11-05",
    legend: [],
    stickyTitles: false,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  expect(findTag(html, 'aria-label="凡例"')).toMatch(/\bhidden\b/);
  expect(findTag(html, "<figure")).toContain('data-sticky-titles="off"');
});

// 種類 mermaid は範囲と更新日を出さず、倍率の下限を付ける（正常系）
test("test_render_diagram_frame_when_mermaid", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "mermaid" as const,
    title: "問い合わせの受付",
    legend: [],
    fitMin: 0.75,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  const figure = findTag(html, "<figure");
  expect(figure).toContain('data-diagram="mermaid"');
  expect(figure).toContain('data-fit-min="0.75"');
  const caption =
    /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(html)?.[1] ?? "";
  expect(plainText(caption).trim()).toBe("問い合わせの受付");
  expect(caption).not.toContain("<time");
});

// 種類 map の枠（正常系）
test("test_render_diagram_frame_when_map", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const tools = ["back", "expandAll", "collapseAll", "reset"].map((name) => ({
    name,
    label: name,
    disabled: name === "back",
  }));
  const frame = {
    kind: "map" as const,
    title: "全体の構成",
    legend: [],
    wide: true,
    tools,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  const caption =
    /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(html)?.[1] ?? "";
  expect(plainText(caption).trim()).toBe("全体の構成");
  expect(html).not.toContain("<time");
  expect(findTag(html, "<figure")).toContain('data-wide="true"');
  const toolbar =
    /<div[^>]*class="mdmark-diagram-tools"[^>]*>([\s\S]*)/.exec(html)?.[1] ??
    "";
  const names = matches(toolbar, /aria-label="([^"]+)"/g)
    .slice(0, 4)
    .map((item) => item.replace(/^aria-label="|"$/g, ""));
  expect(names).toEqual(["back", "expandAll", "collapseAll", "reset"]);
});

// リサイズハンドルの帯（正常系）
test("test_render_diagram_frame_when_resize_strip", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "flow" as const,
    title: "図",
    legend: [],
    resizable: true,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  const handle =
    /<div[^>]*class="mdmark-diagram-resize"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  expect(handle).not.toBeNull();
  expect(html.indexOf("mdmark-diagram-resize")).toBeGreaterThan(
    html.indexOf("mdmark-diagram-viewport"),
  );
  expect(handle?.[1]).toContain(iconSvg("equal"));
});

// 枠と層の hint のマーカーと留める範囲を配置する（正常系）
test("test_render_flow_when_group_hint", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_GROUPS_TEXT);
  const frame = definition.frame;
  const lanes = definition.lanes ?? [];
  if (frame === undefined) {
    throw new Error("見本の定義に枠が無い");
  }
  const llm = lanes.find((lane) => lane.kind === "llm");
  const others = lanes.filter((lane) => lane.kind !== "llm");
  // 実行
  const on = renderFlow(definition, "d1", true);
  const off = renderFlow(definition, "d1", false);
  // 検証
  expect(on.html).toContain(`aria-label="「${frame.title}」の説明"`);
  expect(on.html).toContain(`aria-label="「${llm?.label}」の説明"`);
  for (const lane of others) {
    expect(on.html).not.toContain(`aria-label="「${lane.label}」の説明"`);
  }
  const title = findTag(on.html, "mdmark-diagram-frame-title");
  expect(title).toContain(`data-sticky-top="${frame.y}"`);
  expect(title).toContain(`data-sticky-bottom="${frame.y + frame.h}"`);
  expect(on.tips).toContain("メールの受け取りから返信までを受け持つ範囲");
  expect(off.html).not.toContain("mdmark-diagram-group-info");
});

// 1 種類だけのノードと線を記載しない（正常系）
test("test_legend_for_when_single_kinds", async () => {
  // 準備
  const { legendFor } = await loadDiagram();
  const single = parsed<MdmarkFlowDefinition>(SINGLE_KINDS_TEXT);
  const twoKinds = parsed<MdmarkFlowDefinition>(SINGLE_KINDS_TEXT);
  const last = twoKinds.nodes[2];
  if (last === undefined) {
    throw new Error("見本の 3 つ目のノードが無い");
  }
  Object.assign(last, { kind: "data" });
  // 実行
  const none = legendFor(single);
  const items = legendFor(twoKinds);
  // 検証
  expect(none).toEqual([]);
  const labels = items.map((item) => item.label);
  expect(labels).toHaveLength(2);
  expect(
    labels.some((label) => /処理の流れ|枠|層|交差|出る|下線/.test(label)),
  ).toBe(false);
});

// グラフの項目の名前と値を出す（正常系）
test("test_render_diagram_tip_when_item", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "item",
    label: "担当者",
    value: "2月: 38",
  });
  // 検証
  expect(inOrder(html, ["担当者", "2月: 38"])).toBe(true);
  expect(html).toContain('role="tooltip"');
  expect(html).toMatch(/\bhidden\b/);
});
