import { expect, test } from "vitest";
import type {
  MdmarkChartDefinition,
  MdmarkFlowDefinition,
} from "../../../../src/diagram/definition.ts";
import { iconSvg } from "../../../../src/shared/icons.part.ts";
import { parsed } from "../../helpers/diagrams.ts";
import {
  findTag,
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";
import { CONFIG, DATA, FLOW } from "../../helpers/map.ts";

/** 図の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagram = () => import("../../../../src/diagram/diagram.part.ts");

/** 部品設計『mapの構成図』の Default（`FLOW` と補足 `DATA`）の自動配置の結果から作ったノードと線 */
const defaultFlow = async (): Promise<MdmarkFlowDefinition> => {
  const { parseFlowchart } = await import("../../../../src/map/flowchart.ts");
  const { layoutMap } = await import("../../../../src/map/layout.ts");
  const notes = parsed<{ notes: Record<string, { text: string }> }>(DATA).notes;
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height" },
  );
  const kinds: Record<string, { label?: string; icon?: string }> = CONFIG.kinds;
  return {
    width: layout.width,
    height: layout.height,
    nodes: layout.nodes.map((node) => {
      const kind = (node.classes ?? [])
        .map((name) => kinds[name])
        .find(Boolean);
      const note = notes[node.id]?.text;
      return {
        id: node.id,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        name: node.label ?? node.lines.join(""),
        style: { label: kind?.label, icon: kind?.icon },
        ...(note === undefined ? {} : { hint: note }),
      };
    }),
    wires: layout.wires.map((wire) => ({
      id: wire.id,
      from: wire.from,
      to: wire.to,
      points: wire.points,
      ...(wire.label === undefined ? {} : { label: wire.label }),
      style: {},
    })),
  };
};

/** 名前・`hint`・`href` を指定した 3 つのノードを横に並べ、線でつないだ定義 */
const threeNodes = (
  nodes: Array<{ id: string; name: string; hint?: string; href?: string }>,
): MdmarkFlowDefinition => ({
  width: 720,
  height: 160,
  nodes: nodes.map((node, index) => ({
    ...node,
    x: 24 + index * 240,
    y: 40,
    w: 180,
    h: 72,
    style: { label: "処理", icon: "cog" },
  })),
  wires: nodes.slice(1).map((node, index) => {
    const from = nodes[index]?.id ?? "";
    return {
      id: `${from}->${node.id}`,
      from,
      to: node.id,
      points: [
        [204 + index * 240, 76],
        [264 + index * 240, 76],
      ] as Array<[number, number]>,
      label: `線${index + 1}`,
      style: {},
    };
  }),
});

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

// タイトル・パネル・凡例をこの順に出す（正常系）
test("test_render_diagram_frame", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "chart" as const,
    title: "問い合わせへの自動返信の構成",
    scope: "メールを受け取ってから返信するまで",
    updated: "2026-10-17",
    legend: [
      { sample: "series-1", label: "自動返信" },
      { sample: "series-2", label: "担当者" },
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
  const box = outerHtml(html, 'class="mdmark-diagram-box"');
  expect(box).toContain('role="toolbar"');
  expect(html).not.toContain('data-group="pan"');
  expect(html).not.toContain('aria-label="左へ動かす"');
  const more = findTag(
    html,
    '<button class="mdmark-diagram-tool" type="button" data-tool="more"',
  );
  expect(more).toContain('aria-expanded="false"');
  expect(more).toContain('aria-label="表示の操作を開く"');
  expect(findTag(html, '<div class="mdmark-diagram-tools"')).not.toContain(
    "data-open",
  );
  expect(findTag(html, '<div class="mdmark-diagram-viewport"')).toContain(
    "data-at-fit",
  );
  expect(html).toContain("問い合わせへの自動返信の構成");
  expect(html).toContain("2026-10-17");
});

// モーダルでは閉じるボタンを配置し、全画面で開くボタンを配置しない（正常系）
test("test_render_diagram_frame_when_modal", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "chart" as const,
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

// ノード・線・ツールチップを出す（正常系）
test("test_render_flow", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = await defaultFlow();
  const crossing: MdmarkFlowDefinition = {
    width: 200,
    height: 200,
    nodes: ["a", "b", "c", "d"].map((id, index) => ({
      id,
      name: id,
      x: [0, 160, 80, 80][index] ?? 0,
      y: [80, 80, 0, 160][index] ?? 0,
      w: 40,
      h: 40,
      style: {},
    })),
    wires: [
      {
        id: "a->b",
        from: "a",
        to: "b",
        points: [
          [40, 100],
          [160, 100],
        ],
        style: {},
      },
      {
        id: "c->d",
        from: "c",
        to: "d",
        points: [
          [100, 40],
          [100, 160],
        ],
        style: {},
      },
    ],
  };
  // 実行
  const { html, tips } = renderFlow(definition, "d1", { hints: true });
  const jumped = renderFlow(crossing, "d2", { hints: true });
  // 検証
  expect(matches(html, /class="mdmark-diagram-node[ "]/g)).toHaveLength(
    definition.nodes.length,
  );
  expect(matches(html, /class="mdmark-diagram-wire"/g)).toHaveLength(
    definition.wires.length,
  );
  expect(matches(tips, /role="tooltip"/g)).toHaveLength(
    definition.nodes.filter((node) => node.hint !== undefined).length,
  );
  expect(jumped.html).toMatch(/<path[^>]*data-wire="a-&gt;b"[^>]*d="[^"]* A\d/);
});

// 定義の文字の HTML を文字にする（異常系）
test("test_render_flow_when_text_escaped", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = threeNodes([
    { id: "a", name: "<img src=x onerror=alert(1)>" },
    { id: "b", name: "b" },
    { id: "c", name: "c" },
  ]);
  // 実行
  const { html } = renderFlow(definition, "d1", { hints: true });
  // 検証
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img");
});

// 線の説明を見出しと文で出す（正常系）
test("test_render_diagram_tip", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "wire",
    label: "補足を渡す",
    tip: "検査した補足",
  });
  // 検証
  expect(inOrder(html, ["補足を渡す", "検査した補足"])).toBe(true);
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

// 説明の後ろに注記の区分を追加する（正常系）
test("test_render_diagram_tip_when_annotations", async () => {
  // 準備
  const { renderDiagramTip } = await loadDiagram();
  // 実行
  const html = renderDiagramTip({
    id: "t1",
    kind: "hint",
    label: "判定",
    hint: "入力の値を判定の条件と比べる",
    annotations: [
      { number: 1, html: "条件を満たさないときは<b>次の工程</b>へ進む。" },
    ],
  });
  // 検証
  const sections = html
    .split('<span class="mdmark-term-tip-section">')
    .slice(1);
  expect(sections).toHaveLength(2);
  expect(sections[0]).toContain("入力の値を判定の条件と比べる");
  const heading = findTag(sections[1] ?? "", "mdmark-term-tip-heading");
  expect(heading).toContain("mdmark-note-tip-heading");
  expect(
    plainText(innerHtml(sections[1] ?? "", "mdmark-note-tip-heading")),
  ).toBe("注記 1");
  expect(sections[1]).toContain("<b>次の工程</b>");
  expect(plainText(sections[1] ?? "")).toContain(
    "条件を満たさないときは次の工程へ進む。",
  );
});

// 戻すのボタンを配置せず、倍率をボタンにする（正常系）
test("test_render_diagram_frame_when_zoom_button", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "chart" as const,
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
    /aria-label="(?:縮小|倍率 125%。全体が収まる倍率に戻す|拡大|全画面で開く|表示の操作を開く)"/g,
  ).map((attribute) => attribute.slice('aria-label="'.length, -1));
  expect(names).toEqual([
    "縮小",
    zoomName,
    "拡大",
    "全画面で開く",
    "表示の操作を開く",
  ]);
  const zoomButton = outerHtml(html, `aria-label="${zoomName}"`);
  expect(zoomButton.startsWith("<button")).toBe(true);
  expect(plainText(zoomButton)).toBe("125%");
  expect(html).not.toContain(iconSvg("rotate-ccw"));
});

// hint を持つノードにマーカーを配置し、hints がオフならマーカーもツールチップも配置しない（正常系）
test("test_render_flow_when_hint", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = threeNodes([
    { id: "mcp", name: "窓口の MCP", hint: "保存と送信のツールだけを持つ" },
    { id: "send", name: "送信" },
  ]);
  const mark = 'aria-label="「窓口の MCP」の説明"';
  // 実行
  const on = renderFlow(definition, "d1", { hints: true });
  const off = renderFlow(definition, "d1", { hints: false });
  // 検証
  expect(matches(on.html, /class="mdmark-diagram-info"/g)).toHaveLength(1);
  expect(on.html).toContain(mark);
  expect(on.tips).toContain("保存と送信のツールだけを持つ");
  expect(off.html).not.toContain("mdmark-diagram-info");
  expect(off.tips).not.toContain('role="tooltip"');
  expect(off.html).not.toContain("aria-describedby");
  expect(off.html).toContain("窓口の MCP");
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

// href を持つノードをリンクにし、マーカーをリンクの外に配置する（正常系）
test("test_render_flow_when_node_link", async () => {
  // 準備
  const { renderFlow } = await loadDiagram();
  const definition = threeNodes([
    {
      id: "recv",
      name: "問い合わせを受け取る",
      hint: "1 通ずつ読む",
      href: "https://example.com/spec",
    },
    { id: "classify", name: "分類する", href: "./other.md" },
    { id: "store", name: "記録する" },
  ]);
  // 実行
  const { html } = renderFlow(definition, "d1", { hints: true });
  // 検証
  expect(
    matches(
      html,
      /<a class="mdmark-diagram-node-link" href="[^"]*" aria-label="[^"]*"><\/a>/g,
    ),
  ).toEqual([
    '<a class="mdmark-diagram-node-link" href="https://example.com/spec" aria-label="問い合わせを受け取る"></a>',
    '<a class="mdmark-diagram-node-link" href="./other.md" aria-label="分類する"></a>',
  ]);
  expect(
    matches(html, /class="mdmark-diagram-node[^"]*\bhas-link\b[^"]*"/g),
  ).toHaveLength(2);
  const recv = outerHtml(html, 'data-node="recv"');
  expect(recv).toMatch(
    /<a class="mdmark-diagram-node-link"[^>]*><\/a>[\s\S]*<button class="mdmark-diagram-info"/,
  );
  expect(outerHtml(html, 'data-node="store"')).not.toContain("<a ");
});

// リサイズハンドルを配置し、モーダルと `resizable: false` では配置しない（正常系）
test("test_render_diagram_frame_when_resizable", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const base = {
    kind: "chart" as const,
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
  const low = renderDiagramFrame(base, { ...BODY, height: 80 });
  // 検証
  const handle = findTag(omitted, 'class="mdmark-diagram-resize"');
  expect(handle).toContain('role="separator"');
  expect(handle).toContain('aria-orientation="horizontal"');
  expect(handle).toContain('tabindex="0"');
  expect(handle).toContain('aria-label="「問い合わせの流れ」の表示の高さ"');
  expect(handle).toContain('aria-valuenow="560"');
  expect(handle).toContain('aria-valuemin="120"');
  expect(handle).toContain('aria-valuemax="560"');
  expect(handle).toContain('aria-valuetext="560px"');
  const lowHandle = findTag(low, 'class="mdmark-diagram-resize"');
  expect(lowHandle).toContain('aria-valuenow="120"');
  expect(lowHandle).toContain('aria-valuemax="120"');
  expect(lowHandle).toContain('aria-valuetext="120px"');
  expect(outerHtml(omitted, 'class="mdmark-diagram-resize"')).toContain(
    iconSvg("equal"),
  );
  expect(off).not.toContain("mdmark-diagram-resize");
  expect(modal).not.toContain("mdmark-diagram-resize");
});

// 凡例の項目が空なら凡例を隠す（正常系）
test("test_render_diagram_frame_when_no_legend", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "chart" as const,
    title: "タイトル",
    scope: "範囲",
    updated: "2026-11-05",
    legend: [],
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  expect(findTag(html, 'aria-label="凡例"')).toMatch(/\bhidden\b/);
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
  expect(
    toolbar
      .trimStart()
      .startsWith('<div class="mdmark-diagram-tools-group" data-group="map"'),
  ).toBe(true);
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
    kind: "chart" as const,
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

// パネルを開いた状態で描く（正常系）
test("test_render_diagram_frame_when_panel_open", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  const frame = {
    kind: "chart" as const,
    title: "タイトル",
    scope: "範囲",
    updated: "2026-10-17",
    legend: [],
    panelOpen: true,
    id: "d1",
  };
  // 実行
  const html = renderDiagramFrame(frame, BODY);
  // 検証
  expect(findTag(html, '<div class="mdmark-diagram-tools"')).toContain(
    "data-open",
  );
  const more = findTag(
    html,
    '<button class="mdmark-diagram-tool" type="button" data-tool="more"',
  );
  expect(more).toContain('aria-expanded="true"');
  expect(more).toContain('aria-label="表示の操作を閉じる"');
});

// 下限と上限で端のボタンを押せなくし、全体が収まる倍率より拡大したときだけ data-at-fit を外す（正常系）
test("test_render_diagram_frame_when_bounds", async () => {
  // 準備
  const { renderDiagramFrame } = await loadDiagram();
  /** 倍率 zoom で描いた枠の縮小・拡大の disabled と、表示する枠の data-at-fit */
  const stateAt = (zoom: number) => {
    const html = renderDiagramFrame(
      {
        kind: "chart" as const,
        title: "タイトル",
        legend: [],
        zoom,
        fit: 1,
        id: "d1",
      },
      BODY,
    );
    return {
      out: findTag(html, 'data-tool="out"').includes("disabled"),
      in: findTag(html, 'data-tool="in"').includes("disabled"),
      atFit: findTag(html, '<div class="mdmark-diagram-viewport"').includes(
        "data-at-fit",
      ),
    };
  };
  // 実行・検証
  expect(stateAt(0.25)).toEqual({ out: true, in: false, atFit: true });
  expect(stateAt(1.25)).toEqual({ out: false, in: false, atFit: false });
  expect(stateAt(5)).toEqual({ out: false, in: true, atFit: false });
});
