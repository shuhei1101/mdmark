import { expect, test } from "vitest";
import {
  findTag,
  findTags,
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";
import { CONFIG, FLOW, SEQUENCE } from "../../helpers/map.ts";

/** map の部品の HTML を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParts = () => import("../../../../src/map/map.part.ts");
const loadLayout = () => import("../../../../src/map/layout.ts");
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");
const loadSequence = () => import("../../../../src/map/sequence.ts");
const loadRows = () => import("../../../../src/map/sequence-rows.ts");

/** 部品『mapの構成図』の Default の引数 */
async function flowArgs(entered?: string) {
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const chart = parseFlowchart(FLOW);
  const layout = layoutMap(
    chart,
    { collapsed: [], entered },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  return {
    layout,
    kinds: CONFIG.kinds,
    lines: CONFIG.lines,
    collapsed: [],
    entered,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
  };
}

// グループとノード（正常系）
test("test_render_map_flow", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const { html } = renderMapFlow(await flowArgs());
  // 検証
  expect(matches(html, /data-group="[^"]+"/g)).toHaveLength(4);
  expect(new Set(matches(html, /data-node="[^"]+"/g)).size).toBe(10);
  expect(html).not.toContain("mdmark-diagram-legend");
});

// キーで操作する場所（正常系）
test("test_render_map_flow_when_keyboard", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const args = await flowArgs("read");
  const { html } = renderMapFlow(args);
  // 検証
  const nodes = matches(html, /<div class="[^"]*map-kinded[^"]*"[^>]*>/g);
  expect(nodes).toHaveLength(args.layout.nodes.length);
  for (const node of nodes) {
    expect(node).not.toContain("tabindex");
    expect(node).not.toContain("role=");
  }
  const nodeHits = matches(
    html,
    /<div class="[^"]*map-kinded[^"]*"[^>]*><span class="mdmark-diagram-node-hit"[^>]*>/g,
  );
  expect(nodeHits).toHaveLength(args.layout.nodes.length);
  for (const hit of nodeHits) {
    expect(hit).toContain('tabindex="0"');
    expect(hit).toContain('role="button"');
  }
  const hits = matches(html, /<path class="map-wire-hit"[^>]*>/g);
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) expect(hit).toContain('tabindex="0"');
  expect(html).not.toMatch(/data-group="read"[^>]*><div class="map-group-bar"/);
  expect(renderMapFlow(await flowArgs()).html).toMatch(
    /data-group="read"[^>]*><div class="map-group-bar"/,
  );
});

// 説明と用語を持つノードの中に、フォーカスできる要素を入れ子にしない（正常系）
test("test_render_map_flow_when_note_node", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const { html } = renderMapFlow({
    ...(await flowArgs()),
    layout,
    notes: { data: "検査した補足" },
    terms: { 補足: "意味" },
  });
  // 検証
  const node = outerHtml(html, 'data-node="data"');
  const div = findTag(node, 'data-node="data"');
  expect(div).not.toContain("tabindex");
  expect(div).not.toContain("role=");
  expect(node).toMatch(
    /^<div[^>]*data-node="data"[^>]*><span class="mdmark-diagram-node-hit"[^>]*><\/span>/,
  );
  const hit = findTag(node, "mdmark-diagram-node-hit");
  expect(hit).toContain('role="button"');
  expect(hit).toContain('tabindex="0"');
  expect(hit).toContain('aria-roledescription="ノード"');
  expect(hit).toMatch(/aria-label="[^"]+"/);
  expect(node).toContain('<button class="mdmark-diagram-info');
  expect(node).toMatch(/<span class="mdmark-term"[^>]*>補足<\/span>/);
  // 押せる要素は空で、中にボタン・リンク・フォーカスできる要素を持たない
  for (const each of matches(
    html,
    /<span class="mdmark-diagram-node-hit"[^>]*>[\s\S]*?<\/span>/g,
  ))
    expect(each).toMatch(
      /^<span class="mdmark-diagram-node-hit"[^>]*><\/span>$/,
    );
});

// 中へ入った（正常系）
test("test_render_map_flow_when_entered", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const { html } = renderMapFlow(await flowArgs("read"));
  // 検証
  expect(html).toMatch(
    /data-node="mount"[^>]*class="[^"]*map-faded|class="[^"]*map-faded[^"]*"[^>]*data-node="mount"/,
  );
  expect(html).not.toMatch(/<button[^>]*data-group-enter="read"/);
});

// 全ての記法（正常系）
test("test_render_map_sequence", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const view = {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  };
  const rows = sequenceRows(sequence, view);
  // 実行
  const { html } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
  });
  // 検証
  expect(matches(html, /class="map-seq-fragment-tab"/g)).toHaveLength(3);
  expect(matches(html, /aria-expanded="true"/g).length).toBeGreaterThanOrEqual(
    3,
  );
});

// ライフラインの判定の線（正常系）
test("test_render_map_sequence_when_lifeline_hits", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const view = {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  };
  const rows = sequenceRows(sequence, view);
  // 実行
  const { html } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
  });
  // 検証
  const attribute = (tag: string, name: string) =>
    new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
  const coordinates = (tag: string) =>
    ["x1", "y1", "x2", "y2"].map((name) => attribute(tag, name));
  const lifelines = findTags(html, 'class="mdmark-diagram-lifeline');
  const hits = findTags(html, 'class="map-lifeline-hit"');
  expect(hits).toHaveLength(sequence.participants.length);
  for (const lifeline of lifelines) {
    const name = attribute(lifeline, "data-lifeline");
    const hit = hits.find((tag) => attribute(tag, "data-lifeline") === name);
    expect(hit?.startsWith("<line")).toBe(true);
    expect(coordinates(hit ?? "")).toEqual(coordinates(lifeline));
  }
  const firstMessageHit = html.search(/class="map-wire-hit" data-message=/);
  const lastLifelineHit = html.lastIndexOf('class="map-lifeline-hit"');
  expect(firstMessageHit).toBeGreaterThan(-1);
  expect(lastLifelineHit).toBeLessThan(firstMessageHit);
});

// 始める前（正常系）
test("test_render_map_band", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "walkthrough",
    total: 4,
    index: undefined,
    titles: [],
    title: "",
    text: "",
    playing: false,
    fill: 0,
    label: "全体の構成の案内",
  });
  // 検証
  expect(html).toMatch(/class="map-band[^"]*\bis-idle\b/);
  expect(matches(html, /class="map-band-seg[^"]*"/g)).toHaveLength(4);
  expect(html).toMatch(/role="slider"[^>]*aria-valuenow="0"/);
  expect(html).toMatch(/aria-valuetext="始める前"/);
  expect(html).toMatch(/<button[^>]*data-dir="-1"[^>]*aria-label="前の手順"/);
  expect(html).toMatch(/<button[^>]*data-dir="1"[^>]*aria-label="次の手順"/);
  expect(html).toMatch(/class="map-band-title"[^>]*hidden/);
  expect(html).toMatch(/class="map-band-text"[^>]*hidden/);
});

// 繰り返している途中（正常系）
test("test_render_map_band_when_playing", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "walkthrough",
    total: 4,
    index: 1,
    titles: ["全体を見る", "記法を読む", "配置する", "描く"],
    title: "記法を読む",
    text: "",
    playing: true,
    fill: 0.5,
    label: "全体の構成の案内",
  });
  // 検証
  const segments = matches(html, /class="map-band-seg[^"]*"/g);
  expect(segments[0]).toContain("is-done");
  expect(segments[1]).toContain("is-current");
  expect(segments[1]).toContain("is-playing");
  expect(html).toMatch(/class="map-band-fill" style="width: ?50%/);
  expect(html).toContain('aria-valuetext="手順 2/4 記法を読む"');
  expect(html).not.toMatch(/class="map-band[^"-]*\bis-idle\b/);
});

// 再生（正常系）
test("test_render_map_band_when_playback", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "playback",
    total: 7,
    index: 2,
    titles: [],
    title: "mount を呼ぶ",
    text: "",
    playing: true,
    fill: 0,
    label: "文書を描くまでの再生",
  });
  // 検証
  expect(html).toMatch(/role="slider"[^>]*aria-label="メッセージ"/);
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) =>
    item.replace(/^aria-label="|"$/g, ""),
  );
  expect(labels).toEqual(
    expect.arrayContaining(["前のメッセージ", "次のメッセージ"]),
  );
});

/** 描いた HTML の、data-wire が wire（属性の中は > をエスケープする）の印の要素の開始タグと中身 */
const packetsOf = (html: string, wire: string): string[] =>
  matches(
    html,
    new RegExp(
      `<(circle|rect|polygon)[^>]*class="map-packet"[^>]*data-wire="${wire.replace(/>/g, "&gt;")}"[^>]*>[\\s\\S]*?</\\1>`,
      "g",
    ),
  );

// データの印（正常系）
test("test_render_map_flow_when_packets", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const args = await flowArgs();
  // 実行
  const { html } = renderMapFlow({
    ...args,
    packets: [
      {
        wire: "mount->marker",
        direction: "both",
        color: "orange",
        shape: "square",
      },
      {
        wire: "marker->data",
        direction: "forward",
        color: undefined,
        shape: "circle",
      },
    ],
  });
  // 検証
  const both = packetsOf(html, "mount->marker");
  expect(both.length).toBeGreaterThanOrEqual(2);
  for (const item of both) {
    expect(item).toMatch(/^<rect/);
    expect(item).toContain("var(--mdmark-color-accent-orange-text)");
    expect(item).toContain('repeatCount="indefinite"');
  }
  expect(both.some((item) => item.includes('keyPoints="1;0"'))).toBe(true);
  expect(both.some((item) => !item.includes('keyPoints="1;0"'))).toBe(true);
  const forward = packetsOf(html, "marker->data");
  expect(forward.length).toBeGreaterThanOrEqual(1);
  for (const item of forward) {
    expect(item).toMatch(/^<circle/);
    expect(item).toContain("var(--mdmark-color-diagram-line)");
    expect(item).not.toContain('keyPoints="1;0"');
  }
});

// 知らない色の名前（異常系）
test("test_render_map_flow_when_unknown_color", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const args = await flowArgs();
  // 実行
  const { html } = renderMapFlow({
    ...args,
    colors: { read: "blue;x" },
    packets: [
      {
        wire: "mount->marker",
        direction: "forward",
        color: "red;x:y",
        shape: "circle",
      },
    ],
  });
  // 検証
  const items = packetsOf(html, "mount->marker");
  expect(items.length).toBeGreaterThanOrEqual(1);
  expect(items[0]).toContain("var(--mdmark-color-diagram-line)");
  expect(html).not.toContain(";x:y");
  expect(html).not.toContain(";x");
});

// 用語の下線（正常系）
test("test_render_map_flow_when_terms", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const chart = parseFlowchart(
    FLOW.replace('data["補足の検査"]', 'data["<b>補足</b>の検査"]'),
  );
  const layout = layoutMap(
    chart,
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const { html, tips } = renderMapFlow({
    ...(await flowArgs()),
    layout,
    notes: { layout: "内側から配置する" },
    terms: { 補足: "map の範囲の上書きと説明" },
  });
  // 検証
  const name =
    html.match(
      /data-node="data"[^>]*>[\s\S]*?<span class="mdmark-diagram-node-name">([\s\S]*?)<\/span><\/div>/,
    )?.[1] ?? "";
  expect(
    matches(name, /<span class="mdmark-term"[^>]*>補足<\/span>/g),
  ).toHaveLength(1);
  expect(name).toContain("&lt;b&gt;");
  expect(name).not.toContain("<b>");
  expect(tips).toContain("map の範囲の上書きと説明");
  expect(tips).toContain("内側から配置する");
  const titles = matches(
    html,
    /<button class="map-group-title"[^>]*>[^<]*<\/button>/g,
  );
  expect(titles.length).toBeGreaterThan(0);
  for (const title of titles) expect(title).not.toContain("mdmark-term");
});

// 用語の下線（正常系）
test("test_render_map_sequence_when_terms", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(
    SEQUENCE.replace(
      "mount->>marker: map の範囲",
      "mount->>marker: 補足を読む",
    ),
  );
  const rows = sequenceRows(sequence, {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  });
  // 実行
  const { html, tips } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    terms: { 補足: "map の範囲の上書きと説明" },
  });
  // 検証
  const label =
    html.match(
      /<span class="mdmark-diagram-label[^"]*" data-message="1"[^>]*>([\s\S]*?)<\/span><span/,
    )?.[1] ?? "";
  expect(label).toContain('<span class="mdmark-term"');
  expect(label).toContain(">補足</span>を読む");
  expect(tips).toContain("map の範囲の上書きと説明");
});

// 自分へのメッセージのラベル（正常系）
test("test_render_map_sequence_when_self_message", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(`sequenceDiagram
  participant node as 動画作成ノード
  participant am as aituber の MCP
  node->>am: request_job
  node->>node: 完了ファイルを待つ
  node->>am: get（ジョブ）`);
  const rows = sequenceRows(sequence, {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  });
  // 実行
  const { html } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    notes: { "2": "待つ上限の時間は、進め方の文書で決定する" },
  });
  // 検証
  /** メッセージの線の d と、ラベルの札の中心の left・top */
  const wireOf = (message: number) =>
    html.match(
      new RegExp(
        `<path class="mdmark-diagram-wire[^"]*"[^>]* data-message="${message}" d="([^"]+)"`,
      ),
    )?.[1] ?? "";
  const labelOf = (message: number) => {
    const style =
      html.match(
        new RegExp(
          `<span class="mdmark-diagram-label[^"]*" data-message="${message}" style="left:([-\\d.]+)px;top:([-\\d.]+)px"`,
        ),
      ) ?? [];
    return { left: Number(style[1]), top: Number(style[2]) };
  };
  const self = wireOf(1).match(
    /^M([\d.]+) ([\d.]+)H([\d.]+)V([\d.]+)H([\d.]+)$/,
  );
  expect(self).not.toBeNull();
  const [, startX, loopTop, rightX] = (self ?? []).map(Number);
  const selfLabel = labelOf(1);
  // 札の中心の左右は折り返しの左右の中央
  expect(selfLabel.left).toBe(((startX ?? 0) + (rightX ?? 0)) / 2);
  // 札（高さ 20px、中心で配置）の下端は折り返しの上の辺の 6px 上
  expect(selfLabel.top + 10).toBe((loopTop ?? 0) - 6);
  // ほかの参加者へのメッセージのラベルは線の中点の 14px 上のまま
  const other = wireOf(0).match(/^M([\d.]+) ([\d.]+)H([\d.]+)$/);
  const [, fromX, lineY, toX] = (other ?? []).map(Number);
  const otherLabel = labelOf(0);
  expect(otherLabel.top).toBe((lineY ?? 0) - 14);
  expect(
    Math.abs(otherLabel.left - ((fromX ?? 0) + (toX ?? 0)) / 2),
  ).toBeLessThanOrEqual(1);
  // 説明を持つ自分へのメッセージの線の押せる帯は、ツールチップの持ち主になる
  expect(html).toMatch(
    /<path class="map-wire-hit" data-message="1"[^>]*data-tip-owner="message:1"/,
  );
});

// 説明の中の用語（正常系）
test("test_render_map_flow_when_note_terms", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const { tips } = renderMapFlow({
    ...(await flowArgs()),
    notes: { layout: "補足を当てる", "mount->marker": "補足を当てる" },
    terms: { 補足: "意味" },
  });
  // 検証
  const noteTips = matches(
    tips,
    /<(?:span|div) class="mdmark-diagram-tip[^"]*"[^>]*data-tip-for="(?:node:layout|mount-&gt;marker)"[^>]*>[\s\S]*?<\/(?:span|div)><\/(?:span|div)>(?=<|$)/g,
  );
  expect(noteTips).toHaveLength(2);
  for (const tip of noteTips) {
    expect(tip).toContain('<span class="mdmark-term">補足</span>を当てる');
    expect(tip).toContain("補足</span>：意味");
    expect(tip).not.toMatch(/mdmark-term"[^>]*tabindex/);
  }
});

// メッセージの説明（正常系）
test("test_render_map_sequence_when_notes", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const rows = sequenceRows(sequence, {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  });
  // 実行
  const { html, tips } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    notes: { "2": "補足を渡す" },
    terms: { 補足: "意味" },
  });
  // 検証
  const owners = matches(html, /<path class="map-wire-hit"[^>]*>/g).filter(
    (hit) => hit.includes("data-tip-owner"),
  );
  expect(owners).toHaveLength(1);
  expect(owners[0]).toContain('data-message="1"');
  const owner = owners[0]?.match(/data-tip-owner="([^"]+)"/)?.[1] ?? "";
  const tip =
    tips.match(
      new RegExp(
        `<div class="mdmark-diagram-tip"[^>]*data-tip-for="${owner}"[\\s\\S]*?</div>`,
      ),
    )?.[0] ?? "";
  expect(tip).toContain('<span class="mdmark-term">補足</span>を渡す');
  expect(tip).toContain("補足</span>：意味");
  expect(tip).not.toMatch(/mdmark-term"[^>]*tabindex/);
});

// 参加者の箱の名前の用語を、押せる要素の中に入れない（正常系）
test("test_render_map_sequence_when_participant_hit", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const rows = sequenceRows(sequence, {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  });
  // 実行
  const { html } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: ["mount"],
    focus: undefined,
    terms: { mount: "意味" },
  });
  // 検証
  const needle = 'data-node="mount" data-participant="mount"';
  const head = outerHtml(html, needle);
  const div = findTag(head, needle);
  expect(div).toContain("map-participant");
  expect(div).not.toContain("tabindex");
  expect(div).not.toContain("role=");
  expect(div).not.toContain("aria-keyshortcuts");
  expect(div).not.toContain("aria-label");
  expect(div).toContain("data-selected");
  expect(head).toMatch(
    /^<div[^>]*><span class="mdmark-diagram-node-hit"[^>]*><\/span>/,
  );
  const hit = findTag(head, "mdmark-diagram-node-hit");
  expect(hit).toContain('role="button"');
  expect(hit).toContain('tabindex="0"');
  expect(hit).toContain(
    'aria-keyshortcuts="Enter Space Alt+ArrowLeft Alt+ArrowRight"',
  );
  expect(hit).toContain('aria-label="mount（選択中）"');
  expect(head).toMatch(/<span class="mdmark-term"[^>]*>mount<\/span>/);
  // 押せる要素は空で、中に用語を持たない
  const hits = matches(
    head,
    /<span class="mdmark-diagram-node-hit"[^>]*>[\s\S]*?<\/span>/g,
  );
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatch(
    /^<span class="mdmark-diagram-node-hit"[^>]*><\/span>$/,
  );
});

// ヒントがオフならメッセージの説明と注記のツールチップを作らず、注記の持ち主の id だけを残す（正常系）
test("test_render_map_sequence_when_hints_off", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const rows = sequenceRows(sequence, {
    order: sequence.participants.map((item) => item.id),
    collapsed: [],
    entered: undefined,
  });
  // 実行
  const { html, tips } = renderMapSequence({
    sequence,
    rows: rows.rows,
    participants: rows.participants,
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    id: "map-1",
    notes: { "2": "補足を渡す" },
    annotations: { "3": [{ number: 1, html: "注記の本文" }] },
    hints: false,
  });
  // 検証
  for (const hit of matches(html, /<path class="map-wire-hit"[^>]*>/g)) {
    expect(hit).not.toContain("data-tip-owner");
  }
  expect(tips).not.toContain('role="tooltip"');
  const owner = findTag(html, 'id="mdmark-note-owner-1-3"');
  expect(owner).toContain("map-wire-hit");
  expect(owner).toContain('tabindex="0"');
});

// 閉じたグループのノードの数（正常系）
test("test_render_map_flow_when_collapsed_count", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: ["read"], entered: undefined },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const { html } = renderMapFlow({
    ...(await flowArgs()),
    layout,
    collapsed: ["read"],
  });
  // 検証
  const closed =
    html.match(
      /<div class="mdmark-diagram-node map-closed-group[^"]*" data-group="read"[\s\S]*?<span class="map-closed-count">[^<]*<\/span>/,
    )?.[0] ?? "";
  expect(closed).toContain("ノード 3 件");
});

// 注記だけを持つ線と、説明と注記を持つノードに持ち主とツールチップの注記の区分を付ける（正常系）
test("test_render_map_flow_when_annotations", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const annotation = {
    number: 1,
    html: "条件を満たさないときは次の工程へ進む。",
  };
  // 実行
  const { html, tips } = renderMapFlow({
    ...(await flowArgs()),
    id: "map-1",
    notes: { mount: "文書を描く公開関数" },
    annotations: { mount: [annotation], "mount->marker": [annotation] },
  });
  // 検証
  const nodeMark = findTag(html, 'id="mdmark-note-owner-1-mount"');
  expect(nodeMark).toContain("mdmark-diagram-info");
  expect(nodeMark).toContain('aria-label="「mount」の説明と注記"');
  const wireHit = findTag(html, 'id="mdmark-note-owner-1-mount-&gt;marker"');
  expect(wireHit).toContain("map-wire-hit");
  expect(wireHit).toContain("data-tip-owner");
  for (const owner of ["node:mount", "mount-&gt;marker"]) {
    const tip =
      tips
        .split('<span class="mdmark-diagram-tip')
        .find((part) => part.includes(`data-tip-for="${owner}"`)) ?? "";
    expect(tip).toContain("mdmark-note-tip-heading");
    expect(plainText(tip)).toContain("注記 1");
    expect(plainText(tip)).toContain("条件を満たさないときは次の工程へ進む。");
  }
});

// まとめた線の説明（正常系）
test("test_render_map_flow_when_merged_notes", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: ["read"], entered: undefined },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  const args = { ...(await flowArgs()), layout, collapsed: ["read"] };
  // 実行
  const noted = renderMapFlow({
    ...args,
    notes: { "data->layout": "上書きを当てる" },
  });
  const plain = renderMapFlow(args);
  // 検証
  const tip =
    noted.tips.match(
      /<div class="mdmark-diagram-tip"[^>]*data-tip-for="read-&gt;layout"[\s\S]*?<\/div>/,
    )?.[0] ?? "";
  expect(tip).toContain(
    "補足の検査 → 入れ子のグループの自動配置：上書きを当てる",
  );
  expect(tip).not.toContain("Mermaid の記法の読み取り");
  expect(plain.html).not.toMatch(
    /class="map-wire-hit" data-wire="read-&gt;layout" data-tip-owner/,
  );
});

// 状態遷移図の再生（正常系）
test("test_render_map_band_when_transition", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "playback",
    unit: "transition",
    total: 13,
    index: 5,
    titles: [],
    title: "判定 → 差し戻しの理由を確認する：差し戻し",
    text: "",
    playing: true,
    fill: 0,
    label: "作業の状態の再生",
  });
  // 検証
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) =>
    item.replace(/^aria-label="|"$/g, ""),
  );
  expect(labels).toEqual(expect.arrayContaining(["前の遷移", "次の遷移"]));
  expect(labels).not.toContain("前のメッセージ");
});

// C4Dynamic の関係の再生（正常系）
test("test_render_map_band_when_relation", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "playback",
    unit: "relation",
    total: 5,
    index: 1,
    titles: [],
    title: "2: 注文の画面 → 注文の API：注文を送る",
    text: "画面の入力を JSON にして API へ送る",
    playing: true,
    fill: 0,
    label: "注文の流れの再生",
  });
  // 検証
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) =>
    item.replace(/^aria-label="|"$/g, ""),
  );
  expect(labels).toEqual(
    expect.arrayContaining(["関係", "前の関係", "次の関係"]),
  );
  expect(labels).not.toContain("前のメッセージ");
});

/** 部品『mapのER図』の Default の「注文」 */
async function orderTable(collapsed: boolean) {
  const { parseErDiagram } = await import("../../../../src/map/er.ts");
  const { ER } = await import("../../helpers/map.ts");
  const table = parseErDiagram(ER).tables[1];
  if (!table) throw new Error("テーブルが読めない");
  return {
    name: table.name,
    columns: table.columns,
    notes: { 状態: "下書き・確定・発送済み・取り消し" },
    collapsed,
  };
}

// 列の行（正常系）
test("test_render_map_er", async () => {
  // 準備
  const { renderMapEr } = await loadParts();
  // 実行
  const result = renderMapEr(await orderTable(false));
  // 検証
  expect(matches(result.columns, /class="map-er-column"/g)).toHaveLength(8);
  expect(result.columns).toMatch(
    /data-column="状態"[\s\S]*?<button[^>]*map-er-note/,
  );
  expect(result.toggle).toContain('aria-expanded="true"');
});

// 説明を持たず注記だけを持つ列に、ボタンと注記の区分を出す（正常系）
test("test_render_map_er_when_annotations", async () => {
  // 準備
  const { renderMapEr } = await loadParts();
  // 実行
  const result = renderMapEr({
    ...(await orderTable(false)),
    annotations: { 注文日: [{ number: 1, html: "注文を確定した日" }] },
    ownerPrefix: "mdmark-note-owner-1-",
  });
  // 検証
  const button = findTag(
    result.columns,
    'id="mdmark-note-owner-1-注文.注文日"',
  );
  expect(button).toContain("map-er-note");
  expect(button).toContain('aria-label="注文日の注記"');
  const tipId = /aria-describedby="([^"]+)"/.exec(button)?.[1] ?? "";
  const tip = outerHtml(result.tips, `id="${tipId}"`);
  expect(tip).toContain("mdmark-note-tip-heading");
  expect(plainText(tip)).toContain("注記 1");
  expect(plainText(tip)).toContain("注文を確定した日");
});

// ヒントがオフなら説明のボタンとツールチップを作らず、注記の持ち主の id を列の行に付ける（正常系）
test("test_render_map_er_when_hints_off", async () => {
  // 準備
  const { renderMapEr } = await loadParts();
  // 実行
  const result = renderMapEr({
    ...(await orderTable(false)),
    annotations: { 注文日: [{ number: 1, html: "注文を確定した日" }] },
    ownerPrefix: "mdmark-note-owner-1-",
    hints: false,
  });
  // 検証
  expect(result.columns).not.toContain('class="map-er-note"');
  expect(result.tips).toBe("");
  const row = findTag(result.columns, 'id="mdmark-note-owner-1-注文.注文日"');
  expect(row).toContain("map-er-column");
  expect(row).toContain('tabindex="-1"');
});

// 列を閉じた（正常系）
test("test_render_map_er_when_collapsed", async () => {
  // 準備
  const { renderMapEr } = await loadParts();
  // 実行
  const result = renderMapEr(await orderTable(true));
  // 検証
  expect(result.columns).not.toContain("map-er-column");
  expect(result.toggle).toContain("列 8");
  expect(result.toggle).toContain('aria-expanded="false"');
});

// 同じ状態への遷移（正常系）
test("test_render_map_state", async () => {
  // 準備
  const { renderMapState } = await loadParts();
  // 実行
  const html = renderMapState({
    wire: "t2",
    x: 100,
    y: 50,
    width: 120,
    label: "保存する",
    active: false,
    dim: false,
  });
  // 検証
  const d =
    /<path[^>]*class="map-state-loop"[^>]*d="([^"]+)"/.exec(html)?.[1] ?? "";
  expect(d.startsWith("M220 64")).toBe(true);
  expect(d.endsWith("L160 50")).toBe(true);
  expect(html).toContain("保存する");
  expect(html).toMatch(/class="map-wire-hit"[^>]*aria-label="[^"]+"/);
});

/** ER 図の見本を配置し、関連の線を付け替えた引数 */
async function erArgs(collapsed: string[]) {
  const { parseErDiagram, erToFlowchart, erOverrides, erPartRelations } =
    await import("../../../../src/map/er.ts");
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { rewireMapEr } = await loadParts();
  const { ER } = await import("../../helpers/map.ts");
  const er = parseErDiagram(ER);
  const relations = erPartRelations(er);
  const tables = er.tables.map((table) => ({
    name: table.name,
    columns: table.columns,
    notes: {},
  }));
  const placed = layoutMap(
    erToFlowchart(er, {}),
    { collapsed },
    {
      overrides: erOverrides(er, new Set(collapsed)),
      nodeFit: "height",
      measureText: estimateTextWidth,
    },
  );
  const layout = {
    ...placed,
    wires: rewireMapEr({ layout: placed, tables, relations, collapsed }),
  };
  return { er, relations, tables, layout };
}

// 関連の端を列の行へ付け替える（正常系）
test("test_rewire_map_er", async () => {
  // 準備・実行
  const { MAP_ER } = await loadParts();
  const { er, layout } = await erArgs([]);
  // 検証
  const order = layout.nodes.find((node) => node.id === "注文");
  const index =
    er.tables
      .find((table) => table.name === "注文")
      ?.columns.findIndex((column) => column.name === "顧客ID") ?? -1;
  const last = layout.wires.find((item) => item.id === "r1")?.points.at(-1);
  if (!order || !last) throw new Error("注文の表と r1 の線がありません");
  expect(index).toBeGreaterThanOrEqual(0);
  expect(last[1]).toBe(
    order.y + MAP_ER.head + index * MAP_ER.row + MAP_ER.row / 2,
  );
  expect([order.x, order.x + order.w]).toContain(last[0]);
});

// ER 図の部品（正常系）
test("test_render_map_er_diagram", async () => {
  // 準備
  const { renderMapErDiagram } = await loadParts();
  const { relations, tables, layout } = await erArgs([]);
  // 実行
  const part = renderMapErDiagram({
    layout,
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    id: "er",
    tables: tables.map((table) =>
      table.name === "注文"
        ? { ...table, notes: { 状態: "下書き・確定・発送済み・取り消し" } }
        : table,
    ),
    relations,
    fanouts: [
      { wire: "r1", from: "顧客", to: "注文" },
      { wire: "r2", from: "注文", to: "明細" },
      { wire: "r3", from: "商品", to: "明細" },
    ],
  });
  // 検証
  expect(part.html).toMatch(
    /data-node="注文"[\s\S]*?map-er-toggle[\s\S]*?map-er-columns/,
  );
  expect(matches(part.html, /class="map-er-cardinality"/g)).toHaveLength(
    relations.length * 2,
  );
  expect(matches(part.html, /class="map-er-label"/g)).toHaveLength(
    relations.filter((item) => item.label !== undefined).length,
  );
  const { MAP_ER } = await loadParts();
  const half = MAP_ER.fanoutSize / 2;
  const marks = [
    ...part.html.matchAll(
      /class="map-er-fanout"[^>]*style="left:([-\d.]+)px;top:([-\d.]+)px"/g,
    ),
  ].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  expect(marks).toHaveLength(3);
  // マーカーの矩形は、どのノードの矩形（左右に空ける幅を含む）とも重ならない
  for (const mark of marks)
    for (const node of layout.nodes)
      expect(
        mark.x + half <= node.x - MAP_ER.aside ||
          node.x + node.w + MAP_ER.aside <= mark.x - half ||
          mark.y + half <= node.y ||
          node.y + node.h <= mark.y - half,
      ).toBe(true);
  expect(part.tips).toContain("下書き・確定・発送済み・取り消し");
  expect(part.tips).toContain("行が増える関連");
});

/** 矩形（左・右・上・下） */
type Box = { left: number; right: number; top: number; bottom: number };

/** 2 つの矩形が重ならないか（辺が接するだけは重ならない） */
const apart = (a: Box, b: Box): boolean =>
  a.right <= b.left ||
  b.right <= a.left ||
  a.bottom <= b.top ||
  b.bottom <= a.top;

/** ER 図の単体テストのテーブルのノード（100×40） */
const erNode = (id: string, x: number, y: number) => ({
  id,
  x,
  y,
  w: 100,
  h: 40,
  lines: [id],
  faded: false,
  ancestors: [],
});

/** ER 図の単体テストの関連の線 */
const erWire = (wire: {
  id: string;
  from: string;
  to: string;
  points: Array<[number, number]>;
}) => ({ ...wire, label: undefined, merged: undefined });

/** ER 図の単体テストの関連（多重度 `1`・`0..n`、ラベル「テスト」） */
const erRelation = (id: string, from: string, to: string) => ({
  id,
  from,
  to,
  fromCardinality: "1",
  toCardinality: "0..n",
  label: "テスト",
  fromColumn: undefined,
  toColumn: undefined,
});

/** `renderMapErMarks` の文字の矩形（文字の幅と高さの見積もり） */
async function erTextBoxes(
  svg: string,
): Promise<Array<Box & { name: string }>> {
  const { MAP_ER } = await loadParts();
  return [
    ...svg.matchAll(
      /<text class="(map-er-label|map-er-cardinality)"[^>]*x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)">([^<]*)<\/text>/g,
    ),
  ].map(([, className, x, y, anchor, value]) => {
    const label = className === "map-er-label";
    const width =
      (value ?? "").length *
      (label ? MAP_ER.labelChar : MAP_ER.cardinalityChar);
    const shift = { middle: width / 2, end: width }[anchor ?? ""] ?? 0;
    const left = Number(x) - shift;
    return {
      name: `${className} ${value} (${x}, ${y})`,
      left,
      right: left + width,
      top: Number(y) - (label ? MAP_ER.labelLine : MAP_ER.cardinalityLine),
      bottom: Number(y),
    };
  });
}

// 行が増える関連のマーカーを、ほかの関連のラベルの文字と重ならない場所に置く（正常系）
test("test_render_map_er_fanouts_when_label_nearby", async () => {
  // 準備: r1 のラベルの反対側の中ほど（マーカーの最初の候補）に、r2 のラベルの文字が来る配置
  const { MAP_ER, renderMapErFanouts, renderMapErMarks } = await loadParts();
  const layout = {
    width: 600,
    height: 240,
    nodes: [
      erNode("A", 0, 0),
      erNode("B", 500, 0),
      erNode("C", 0, 200),
      erNode("D", 500, 200),
    ],
    groups: [],
    wires: [
      erWire({
        id: "r1",
        from: "A",
        to: "B",
        points: [
          [100, 20],
          [130, 20],
          [130, 100],
          [470, 100],
          [470, 20],
          [500, 20],
        ],
      }),
      erWire({
        id: "r2",
        from: "C",
        to: "D",
        points: [
          [100, 220],
          [130, 220],
          [130, 140],
          [470, 140],
          [470, 220],
          [500, 220],
        ],
      }),
    ],
  };
  const relations = [erRelation("r1", "A", "B"), erRelation("r2", "C", "D")];
  // 実行
  const part = renderMapErFanouts({
    layout,
    relations,
    fanouts: [{ wire: "r1", from: "A", to: "B" }],
    id: "er",
  });
  // 検証: マーカーの矩形が、ノードの矩形とも、多重度・ラベルの文字の矩形とも重ならない
  const match = part.html.match(
    /class="map-er-fanout"[^>]*style="left:([-\d.]+)px;top:([-\d.]+)px"/,
  );
  expect(match).not.toBeNull();
  const half = MAP_ER.fanoutSize / 2;
  const [x, y] = [Number(match?.[1]), Number(match?.[2])];
  const box = {
    left: x - half,
    right: x + half,
    top: y - half,
    bottom: y + half,
  };
  for (const node of layout.nodes)
    expect(
      apart(box, {
        left: node.x - MAP_ER.aside,
        right: node.x + node.w + MAP_ER.aside,
        top: node.y,
        bottom: node.y + node.h,
      }),
      node.id,
    ).toBe(true);
  const texts = await erTextBoxes(
    renderMapErMarks({ layout, relations, dim: new Set() }),
  );
  expect(texts).toHaveLength(6);
  for (const text of texts) expect(apart(box, text), text.name).toBe(true);
});

// テーブルのノードの列の行とボタンを、押せる要素の中に入れない（正常系）
test("test_render_map_er_diagram_when_node_hit", async () => {
  // 準備
  const { renderMapErDiagram } = await loadParts();
  const { relations, tables, layout } = await erArgs([]);
  // 実行
  const part = renderMapErDiagram({
    layout,
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    id: "er",
    tables: tables.map((table) =>
      table.name === "注文"
        ? { ...table, notes: { 状態: "下書き・確定・発送済み・取り消し" } }
        : table,
    ),
    relations,
    fanouts: [],
  });
  // 検証
  const node = outerHtml(part.html, 'data-node="注文"');
  const div = findTag(node, 'data-node="注文"');
  expect(div).not.toContain("tabindex");
  expect(div).not.toContain("role=");
  const hit = findTag(node, "mdmark-diagram-node-hit");
  expect(hit).toContain('role="button"');
  expect(hit).toContain('tabindex="0"');
  expect(node).toMatch(/<span class="mdmark-diagram-node-hit"[^>]*><\/span>/);
  expect(node).toContain("map-er-toggle");
  expect(node).toContain("map-er-columns");
  expect(node).toContain('class="map-er-note"');
});

// ヒントがオフなら、各テーブルの列の説明のボタンとツールチップを作らない（正常系）
test("test_render_map_er_diagram_when_hints_off", async () => {
  // 準備
  const { renderMapErDiagram } = await loadParts();
  const { relations, tables, layout } = await erArgs([]);
  // 実行
  const part = renderMapErDiagram({
    layout,
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    id: "er",
    hints: false,
    tables: tables.map((table) =>
      table.name === "注文"
        ? { ...table, notes: { 状態: "下書き・確定・発送済み・取り消し" } }
        : table,
    ),
    relations,
    fanouts: [],
  });
  // 検証
  const node = outerHtml(part.html, 'data-node="注文"');
  expect(node).not.toContain('class="map-er-note"');
  expect(node).toContain("map-er-column");
  expect(part.tips).not.toContain("下書き・確定・発送済み・取り消し");
});

// 状態遷移図の部品（正常系）
test("test_render_map_state_diagram", async () => {
  // 準備
  const { parseStateDiagram, stateToFlowchart, statePartInputs } = await import(
    "../../../../src/map/state-diagram.ts"
  );
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { renderMapStateDiagram } = await loadParts();
  const { STATE } = await import("../../helpers/map.ts");
  const { chart, loops: selfLoops } = stateToFlowchart(
    parseStateDiagram(STATE),
  );
  const { shapes, loops, overrides } = statePartInputs(chart, selfLoops);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const part = renderMapStateDiagram({
    layout,
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    shapes,
    loops,
  });
  // 検証
  const start = /<div[^>]*data-node="start_root"[^>]*>/.exec(part.html)?.[0];
  expect(start).toContain('data-shape="start"');
  expect(start).toContain('aria-label="開始"');
  expect(start).not.toContain("tabindex");
  expect(part.html).toMatch(/<div[^>]*data-shape="choice"[^>]*>/);
  expect(part.html).toMatch(
    /data-node="n1"[\s\S]*?mdmark-diagram-node-kind[^>]*>[\s\S]*?ノート/,
  );
  expect(matches(part.html, /<g data-loop=/g)).toHaveLength(loops.length);
});

// リンク先を持つノードをリンクにし、説明のマーカーをリンクの外に配置する（正常系）
test("test_render_map_flow_when_links", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const { html } = renderMapFlow({
    ...(await flowArgs()),
    links: { mount: "https://example.com/spec" },
    notes: { mount: "文書を描く公開関数" },
  });
  // 検証
  const node = outerHtml(html, 'data-node="mount"');
  expect(findTag(node, 'data-node="mount"')).toContain("has-link");
  expect(findTag(node, 'data-node="mount"')).not.toContain("tabindex");
  const link = findTag(node, "mdmark-diagram-node-link");
  expect(link).toContain('aria-roledescription="ノード"');
  expect(link).toContain('aria-label="mount"');
  expect(node).toMatch(
    /<a class="mdmark-diagram-node-link" href="https:\/\/example\.com\/spec"[^>]*><\/a>[\s\S]*<button class="mdmark-diagram-info/,
  );
  expect(matches(html, /class="mdmark-diagram-node-link"/g)).toHaveLength(1);
});

// 説明を持つグループのタイトルの右にマーカーを配置する（正常系）
test("test_render_map_flow_when_group_note", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const notes = { read: "記法を読み取る部分" };
  const opened = { ...(await flowArgs()), notes };
  const closed = {
    ...opened,
    layout: layoutMap(
      parseFlowchart(FLOW),
      { collapsed: ["read"], entered: undefined },
      { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
    ),
    collapsed: ["read"],
  };
  // 実行
  const results = [renderMapFlow(opened), renderMapFlow(closed)];
  // 検証
  for (const { html, tips } of results) {
    const markers = matches(
      html,
      /<button class="mdmark-diagram-info mdmark-diagram-group-info"[^>]*>/g,
    );
    expect(markers).toHaveLength(1);
    const [marker = ""] = markers;
    expect(marker).toContain('aria-label="「記法の読み取り」の説明"');
    const id = /aria-describedby="([^"]+)"/.exec(marker)?.[1] ?? "";
    expect(plainText(outerHtml(tips, `id="${id}"`))).toContain(
      "記法を読み取る部分",
    );
    const head = outerHtml(
      outerHtml(html, 'data-group="read"'),
      'class="map-group-head"',
    );
    expect(head).toContain("mdmark-diagram-group-info");
    expect(head).not.toMatch(
      /<button class="map-group-title"[^>]*>[^<]*<button/,
    );
  }
});

// ヒントがオフなら説明と注記のマーカーとツールチップを作らず、注記の持ち主の id を要素そのものに付ける（正常系）
test("test_render_map_flow_when_hints_off", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const annotation = {
    number: 1,
    html: "条件を満たさないときは次の工程へ進む。",
  };
  // 実行
  const { html, tips } = renderMapFlow({
    ...(await flowArgs()),
    id: "map-1",
    notes: { lib: "記法を読み取る部分", mount: "文書を描く入口" },
    annotations: {
      marker: [annotation],
      lib: [annotation],
      "mount->marker": [annotation],
    },
    hints: false,
  });
  // 検証
  expect(html).not.toContain("mdmark-diagram-info");
  expect(html).not.toContain("mdmark-diagram-group-info");
  for (const hit of matches(html, /<path class="map-wire-hit"[^>]*>/g)) {
    expect(hit).not.toContain("data-tip-owner");
  }
  expect(tips).not.toContain('role="tooltip"');
  const node = findTag(html, 'id="mdmark-note-owner-1-marker"');
  expect(node).toContain("mdmark-diagram-node-hit");
  const group = findTag(html, 'id="mdmark-note-owner-1-lib"');
  expect(group).toContain("map-group-title");
  const wire = findTag(html, 'id="mdmark-note-owner-1-mount-&gt;marker"');
  expect(wire).toContain("map-wire-hit");
  expect(plainText(html)).toContain("map のマーカーの読み取り");
  expect(plainText(html)).toContain("mdmark");
  expect(plainText(html)).toContain("設定と Markdown");
});

/** クラス図を配置した部品の引数（`hints` だけ変えられる） */
async function classArgs(hints?: boolean) {
  const { parseClassDiagram, classToFlowchart, classPartInputs } = await import(
    "../../../../src/map/class-diagram.ts"
  );
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { spreadMapEnds } = await loadParts();
  const { CLASS } = await import("../../helpers/map.ts");
  const diagram = parseClassDiagram(CLASS);
  const chart = classToFlowchart(diagram);
  const { classes, ends, overrides } = classPartInputs(diagram, {
    collapsed: new Set(),
    widths: {},
    maxWidth: 220,
    measureText: estimateTextWidth,
  });
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height", measureText: estimateTextWidth },
  );
  return {
    layout: { ...layout, wires: spreadMapEnds(layout) },
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    notes: { "基本図形.描く": "子のクラスで描き方を決める" },
    hints,
    classes,
    ends,
  };
}

// クラス図の部品（正常系）
test("test_render_map_class_diagram", async () => {
  // 準備
  const { renderMapClassDiagram } = await loadParts();
  const args = await classArgs();
  // 実行
  const part = renderMapClassDiagram(args);
  // 検証
  expect(part.html).toMatch(
    /data-node="図形"[\s\S]*?mdmark-diagram-node-kind[^>]*>[\s\S]*?«interface»/,
  );
  const base = outerHtml(part.html, 'data-node="基本図形"');
  expect(base).toContain("map-class-toggle");
  expect(matches(base, /class="map-class-members"/g)).toHaveLength(2);
  expect(base).toMatch(/描く[\s\S]*?map-class-note/);
  expect(matches(part.html, /data-end-shape="/g)).toHaveLength(6);
  expect(matches(part.html, /class="map-class-card"/g)).toHaveLength(2);
  expect(
    matches(part.html, /class="map-class-label"[^>]*>描く</g),
  ).toHaveLength(1);
  expect(part.html).toMatch(
    /data-node="note_1"[\s\S]*?mdmark-diagram-node-kind[^>]*>[\s\S]*?ノート/,
  );
  expect(part.tips).toContain("子のクラスで描き方を決める");
});

// ヒントがオフなら、メンバーの説明のボタンとツールチップを作らない（正常系）
test("test_render_map_class_diagram_when_hints_off", async () => {
  // 準備
  const { renderMapClassDiagram } = await loadParts();
  const args = await classArgs(false);
  // 実行
  const part = renderMapClassDiagram(args);
  // 検証
  expect(part.html).not.toContain("map-class-note");
  expect(part.tips).not.toContain("子のクラスで描き方を決める");
  expect(part.html).toMatch(/class="map-class-member[^"]*"[^>]*>[\s\S]*?描く/);
});

// リンク先を持つクラス（正常系）
test("test_render_map_class_diagram_when_linked", async () => {
  // 準備
  const { renderMapClassDiagram } = await loadParts();
  const args = { ...(await classArgs()), links: { 円: "./circle.md" } };
  // 実行
  const part = renderMapClassDiagram(args);
  // 検証
  const circle = outerHtml(part.html, 'data-node="円"');
  expect(circle).toContain("has-link");
  expect(circle).toMatch(
    /<a class="mdmark-diagram-node-link" href="\.\/circle\.md"/,
  );
  expect(circle).toContain('class="map-class-members"');
  expect(
    matches(part.html, /<a class="mdmark-diagram-node-link"/g),
  ).toHaveLength(1);
});

/** モックの「基本図形」 */
const BASE_SHAPE = {
  id: "基本図形",
  annotation: undefined,
  members: [
    {
      visibility: "#",
      name: "色",
      text: "色 string",
      method: false,
      isStatic: false,
      isAbstract: false,
      lines: 1,
    },
    {
      visibility: "+",
      name: "描く",
      text: "描く()",
      method: true,
      isStatic: false,
      isAbstract: true,
      lines: 1,
    },
    {
      visibility: "+",
      name: "数",
      text: "数 int",
      method: false,
      isStatic: true,
      isAbstract: false,
      lines: 1,
    },
  ],
};

// メンバーの区画（正常系）
test("test_render_map_class_members", async () => {
  // 準備
  const { renderMapClassMembers } = await loadParts();
  // 実行
  const part = renderMapClassMembers({
    node: BASE_SHAPE,
    notes: {},
    collapsed: false,
  });
  // 検証
  const lists = part.members.split('role="list"').slice(1);
  expect(lists).toHaveLength(2);
  expect(matches(lists[0] ?? "", /role="listitem"/g)).toHaveLength(2);
  expect(matches(lists[1] ?? "", /role="listitem"/g)).toHaveLength(1);
  expect(part.members).toMatch(
    /class="map-class-member[^"]*is-static[^"]*"[^>]*>[\s\S]*?数/,
  );
  expect(part.members).toMatch(
    /class="map-class-member[^"]*is-abstract[^"]*"[^>]*>[\s\S]*?描く/,
  );
  const toggle = findTag(part.toggle, "<button");
  expect(toggle).toContain('aria-expanded="true"');
  expect(toggle).toContain('aria-label="基本図形のメンバーを閉じる"');
});

// メンバーを閉じた（正常系）
test("test_render_map_class_members_when_collapsed", async () => {
  // 準備
  const { renderMapClassMembers } = await loadParts();
  // 実行
  const part = renderMapClassMembers({
    node: BASE_SHAPE,
    notes: {},
    collapsed: true,
  });
  // 検証
  expect(part.members).not.toContain('role="list"');
  expect(plainText(part.toggle)).toContain("メンバー 3");
});

// 同じ点に入る 3 本（正常系）
test("test_spread_map_ends", async () => {
  // 準備
  const { spreadMapEnds } = await loadParts();
  const node = { id: "親", x: 100, y: 0, w: 120, h: 40 };
  const wire = (id: string, x: number) => ({
    id,
    from: id,
    to: "親",
    label: undefined,
    merged: undefined,
    points: [
      [x, 200],
      [x, 120],
      [160, 120],
      [160, 40],
    ] as Array<[number, number]>,
  });
  const layout = {
    width: 400,
    height: 300,
    nodes: [{ ...node, lines: [], faded: false, ancestors: [] }],
    groups: [],
    wires: [wire("a", 40), wire("b", 160), wire("c", 280)],
  };
  // 実行
  const wires = spreadMapEnds(layout as never);
  // 検証
  const ends = wires.map((item) => item.points.at(-1) as [number, number]);
  const xs = ends.map((point) => point[0]).sort((p, q) => p - q);
  expect(xs).toEqual([144, 160, 176]);
  for (const item of wires) {
    const [last, before] = [item.points.at(-1), item.points.at(-2)];
    expect(last?.[0]).toBe(before?.[0]);
  }
});

/** アーキテクチャ図を配置して引き直した結果 */
async function archLayout() {
  const { parseArchitecture, architectureToFlowchart } = await import(
    "../../../../src/map/architecture.ts"
  );
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { rewireMapArchitecture } = await loadParts();
  const { ARCH } = await import("../../helpers/map.ts");
  const diagram = parseArchitecture(ARCH);
  const { chart, overrides } = architectureToFlowchart(diagram);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height", measureText: estimateTextWidth },
  );
  const wires = rewireMapArchitecture({
    layout,
    edges: diagram.edges,
    collapsed: [],
    ends: { r2: { to: "top" } },
  });
  return { diagram, layout: { ...layout, wires } };
}

/** 点が矩形の辺の中ほどにあるか */
const atSide = (
  point: [number, number] | undefined,
  rect: { x: number; y: number; w: number; h: number } | undefined,
  side: "top" | "right" | "bottom" | "left",
) => {
  if (!point || !rect) return false;
  const expected = {
    top: [rect.x + rect.w / 2, rect.y],
    right: [rect.x + rect.w, rect.y + rect.h / 2],
    bottom: [rect.x + rect.w / 2, rect.y + rect.h],
    left: [rect.x, rect.y + rect.h / 2],
  }[side] as [number, number];
  return (
    Math.abs(point[0] - expected[0]) < 1 && Math.abs(point[1] - expected[1]) < 1
  );
};

/** 線分（前の点から次の点まで）が矩形の中を通るか */
const crossesRect = (
  [point, previous]: [[number, number], [number, number]],
  rect: { x: number; y: number; w: number; h: number },
) => {
  const [left, right] = [
    Math.min(point[0], previous[0]),
    Math.max(point[0], previous[0]),
  ];
  const [top, bottom] = [
    Math.min(point[1], previous[1]),
    Math.max(point[1], previous[1]),
  ];
  return (
    left < rect.x + rect.w &&
    right > rect.x &&
    top < rect.y + rect.h &&
    bottom > rect.y
  );
};

// 辺の指定と group の端（正常系）
test("test_rewire_map_architecture", async () => {
  // 準備・実行
  const { layout } = await archLayout();
  // 検証
  const node = (id: string) => layout.nodes.find((item) => item.id === id);
  const wire = (id: string) => layout.wires.find((item) => item.id === id);
  const r3 = wire("r3")?.points ?? [];
  expect(atSide(r3[0], node("api"), "bottom")).toBe(true);
  expect(atSide(r3.at(-1), node("worker"), "top")).toBe(true);
  for (const item of layout.wires) {
    for (const [index, point] of item.points.slice(1).entries()) {
      const previous = item.points[index] as [number, number];
      expect(point[0] === previous[0] || point[1] === previous[1]).toBe(true);
    }
  }
  const app = layout.groups.find((item) => item.id === "app");
  expect(atSide(wire("r4")?.points[0], app, "right")).toBe(true);
  // 補足の ends で上の辺へ入る r2 は、どの区間も「API サーバー」の矩形の中を通らない
  const r2 = wire("r2")?.points ?? [];
  const api = node("api") as { x: number; y: number; w: number; h: number };
  expect(atSide(r2.at(-1), api, "top")).toBe(true);
  for (const [index, point] of r2.slice(1).entries()) {
    const previous = r2[index] as [number, number];
    expect(
      crossesRect([point, previous], api),
      `r2 の ${index + 1} 本目の区間`,
    ).toBe(false);
  }
});

// アーキテクチャ図の部品（正常系）
test("test_render_map_architecture", async () => {
  // 準備
  const { renderMapArchitecture } = await loadParts();
  const { diagram, layout } = await archLayout();
  // 実行
  const part = renderMapArchitecture({
    layout,
    kinds: {},
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    groupIcons: Object.fromEntries(
      diagram.groups.map((group) => [group.id, group.icon ?? ""]),
    ),
    junctions: ["hub"],
    heads: Object.fromEntries(
      diagram.edges.map((edge) => [edge.id, edge.head]),
    ),
  });
  // 検証
  for (const id of ["cloud", "app"]) {
    // 開閉の山形のほかに、タイトルのアイコンの svg を持つ
    const head = innerHtml(
      outerHtml(part.html, `data-group="${id}"`),
      'class="map-group-head"',
    );
    expect(matches(head, /<svg/g).length).toBeGreaterThanOrEqual(2);
  }
  const hub = /<div[^>]*data-node="hub"[^>]*>/.exec(part.html)?.[0] ?? "";
  expect(hub).toContain('data-shape="junction"');
  expect(hub).toContain('aria-label="分岐点"');
  expect(hub).not.toContain("tabindex");
  expect(part.html).not.toMatch(/data-wire="r3"[^>]*marker-end/);
  expect(part.html).toMatch(
    /data-wire="r1"[^>]*marker-end|marker-end[^>]*data-wire="r1"/,
  );
});

// C4 図の部品（正常系）
test("test_render_map_c4_diagram", async () => {
  // 準備
  const { parseC4, c4ToFlowchart } = await import("../../../../src/map/c4.ts");
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { renderMapC4Diagram, spreadMapEnds } = await loadParts();
  const { C4 } = await import("../../helpers/map.ts");
  const { MAP_C4_KINDS } = await import("../../../../src/map/c4.ts");
  const diagram = parseC4(C4);
  const { chart, overrides, reversed } = c4ToFlowchart(diagram);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const part = renderMapC4Diagram({
    terms: { 支払い: "注文の代金の受け取り" },
    externals: diagram.elements
      .filter((item) => item.external)
      .map((item) => item.id),
    reversed,
    layout: { ...layout, wires: spreadMapEnds(layout) },
    kinds: MAP_C4_KINDS,
    lines: {},
    collapsed: [],
    entered: undefined,
    selected: [],
    focus: undefined,
    packets: [],
    dragging: undefined,
    descriptions: Object.fromEntries(
      diagram.elements.map((item) => [item.id, item.description ?? ""]),
    ),
    boundaries: Object.fromEntries(
      diagram.boundaries.map((item) => [item.id, item.kind]),
    ),
  });
  // 検証
  const store = outerHtml(part.html, 'data-node="store"');
  expect(plainText(innerHtml(store, 'class="map-c4-description"'))).toContain(
    "注文と支払いを受け付ける",
  );
  // 説明の中の用語に下線を付ける
  expect(store).toMatch(
    /class="map-c4-description"[^>]*>[\s\S]*?<span class="mdmark-term[^"]*"[^>]*>支払い</,
  );
  const pay = outerHtml(part.html, 'data-node="pay"');
  expect(plainText(pay)).toContain("[External Software System]");
  // 外部の要素は灰色の面で描く class を持つ
  expect(findTag(part.html, 'data-node="pay"')).toContain("map-c4-external");
  expect(findTag(part.html, 'data-node="store"')).not.toContain(
    "map-c4-external",
  );
  for (const [id, title] of [
    ["company", "自社［Enterprise］"],
    ["shop", "通販［Software System］"],
  ]) {
    const group = outerHtml(part.html, `data-group="${id}"`);
    expect(group).toMatch(/class="map-group[^"]*map-c4-boundary/);
    expect(plainText(group)).toContain(title);
  }
});

// 種類を持たないノードは種類の行を空にする（正常系）
test("test_render_map_flow_when_no_kind", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const chart = parseFlowchart("flowchart LR\n  A[受付]:::step --> B[回答]\n");
  const layout = layoutMap(
    chart,
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height", measureText: estimateTextWidth },
  );
  // 実行
  const { html } = renderMapFlow({
    ...(await flowArgs()),
    layout,
  });
  // 検証
  const kindOf = (id: string): string => {
    const start = html.indexOf(`data-node="${id}"`);
    const rest = html.slice(start);
    return rest.match(/class="mdmark-diagram-node-kind[^"]*"/)?.[0] ?? "";
  };
  expect(kindOf("B")).toContain("is-empty");
  expect(kindOf("A")).not.toContain("is-empty");
});

/** 部品『mapのマインドマップ』の Default の引数（全ての項目の大きさ 100 × 40） */
async function mindmapArgs(
  options: {
    collapsed?: string[];
    entered?: string;
    selected?: string;
    hints?: boolean;
    annotations?: Record<string, Array<{ number: number; html: string }>>;
    terms?: Record<string, string>;
  } = {},
) {
  const { MINDMAP } = await import("../../helpers/map.ts");
  const { parseMindmap } = await import("../../../../src/map/mindmap.ts");
  const { layoutMindmap } = await import(
    "../../../../src/map/mindmap-layout.ts"
  );
  const mindmap = parseMindmap(MINDMAP);
  const collapsed = options.collapsed ?? [];
  const tree = layoutMindmap({
    mindmap,
    top: options.entered,
    collapsed: new Set(collapsed),
    sizes: new Map(
      mindmap.items.map((item) => [item.stateKey, { width: 100, height: 40 }]),
    ),
  });
  return {
    mindmap,
    tree,
    filled: new Set<string>(),
    collapsed,
    entered: options.entered,
    selected: options.selected,
    focus: undefined,
    notes: {
      a1: "利用者の数と、続けて使う割合の 2 つで測る",
      人手が足りない: "開発 2 名・デザイン 0 名",
    },
    annotations: options.annotations ?? {},
    hints: options.hints,
    id: "map-1",
    terms: options.terms,
  };
}

// 項目・持ち手・曲線（正常系）
test("test_render_map_mindmap", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs();
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  const items = matches(
    part.html,
    /<div class="[^"]*map-mindmap-item[^"]*"[^>]*>/g,
  );
  expect(items).toHaveLength(14);
  for (const tag of items) expect(tag).not.toContain("tabindex");
  expect(
    matches(
      part.html,
      /<div class="[^"]*map-mindmap-item[^"]*"[^>]*><span class="mdmark-diagram-node-hit" role="button" tabindex="0" aria-roledescription="項目"/g,
    ),
  ).toHaveLength(14);
  expect(matches(part.html, /class="mdmark-diagram-info/g)).toHaveLength(2);
  expect(part.html).not.toMatch(
    /<span class="mdmark-diagram-node-hit"[^>]*>(?:(?!<\/span>)[\s\S])*mdmark-diagram-info/,
  );
  expect(matches(part.html, /class="map-mindmap-grip"/g)).toHaveLength(6);
  const toggle = findTag(part.html, 'data-mindmap-toggle="体制"');
  expect(toggle).toContain('aria-expanded="true"');
  expect(toggle).toContain('aria-label="体制の子孫を閉じる"');
  expect(findTag(part.html, 'data-mindmap-enter="体制"')).toContain(
    'aria-label="体制の中へ入る"',
  );
  const branches = matches(part.html, /<path class="map-mindmap-branch[^>]*>/g);
  expect(branches).toHaveLength(13);
  for (const tag of branches) expect(tag).toContain('aria-hidden="true"');
});

// 閉じた項目（正常系）
test("test_render_map_mindmap_when_collapsed", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs({ collapsed: ["体制"] });
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  const toggle = outerHtml(part.html, 'data-mindmap-toggle="体制"');
  expect(toggle).toContain('aria-expanded="false"');
  expect(toggle).toContain('aria-label="体制の子孫 3 件を開く"');
  expect(plainText(toggle)).toContain("3");
  expect(part.html).not.toContain('data-node="人手が足りない"');
});

// 枝の中の道筋（正常系）
test("test_render_map_mindmap_when_entered", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs({ entered: "体制" });
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  const trail = outerHtml(part.html, 'class="map-mindmap-trail"');
  expect(trail).toContain('aria-label="根からの道筋"');
  expect(plainText(trail).replace(/\s+/g, " ")).toContain("企画の論点 › 体制");
  expect(trail).toMatch(/<span aria-hidden="true">›<\/span>/);
  expect(part.html).not.toContain('data-mindmap-toggle="体制"');
});

// 選んだ項目の道筋と子孫を残す（正常系）
test("test_render_map_mindmap_when_selected", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs({ selected: "体制" });
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  const item = (key: string) => findTag(part.html, `data-node="${key}"`);
  expect(item("体制")).toContain("data-selected");
  expect(innerHtml(part.html, 'data-node="体制"')).toContain(
    'aria-label="体制（選択中）"',
  );
  expect(item("root")).not.toContain("map-dim");
  expect(item("人手が足りない")).not.toContain("map-dim");
  expect(item("a1")).toContain("map-dim");
  expect(findTag(part.html, 'data-branch="root-&gt;a1"')).toContain("map-dim");
});

// ヒントがオフなら説明のマーカーを作らず、注記の持ち主の id だけを残す（正常系）
test("test_render_map_mindmap_when_hints_off", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs({
    hints: false,
    annotations: { a1: [{ number: 1, html: "注記の本文" }] },
  });
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  expect(part.html).not.toContain("mdmark-diagram-info");
  expect(part.tips).not.toContain('role="tooltip"');
  expect(innerHtml(part.html, 'data-node="a1"')).toMatch(
    /<span class="mdmark-diagram-node-hit"[^>]*id="mdmark-note-owner-1-a1"/,
  );
});

// 名前の用語を押せる要素の中に入れない（正常系）
test("test_render_map_mindmap_when_terms", async () => {
  // 準備
  const { renderMapMindmap } = await loadParts();
  const args = await mindmapArgs({ terms: { 体制: "意味" } });
  // 実行
  const part = renderMapMindmap(args);
  // 検証
  const inner = innerHtml(part.html, 'data-node="体制"');
  expect(inner).toMatch(
    /class="mdmark-diagram-node-name"[^>]*>[\s\S]*?class="mdmark-term"/,
  );
  expect(inner).not.toMatch(
    /<span class="mdmark-diagram-node-hit"[^>]*>[^<]*<span class="mdmark-term"/,
  );
});

/** 部品『mapの軸と格子の配置の図』の引数 */
async function axisGridArgs(
  options: {
    kind?: "gantt" | "timeline" | "gitGraph" | "journey" | "block";
    collapsed?: string[];
    entered?: string;
    selected?: { kind: "item" | "branch" | "actor"; key: string };
  } = {},
) {
  const samples = await import("../../helpers/map.ts");
  const { parseAxisGrid } = await import("../../../../src/map/axis-grid.ts");
  const { layoutAxisGrid } = await import(
    "../../../../src/map/axis-grid-layout.ts"
  );
  const kind = options.kind ?? "gantt";
  const sources = {
    gantt: samples.GANTT,
    timeline: samples.TIMELINE,
    gitGraph: samples.GIT_GRAPH,
    journey: samples.JOURNEY,
    block: samples.BLOCK,
  };
  const grid = parseAxisGrid({ kind, source: sources[kind] });
  const collapsed = options.collapsed ?? [];
  const layout = layoutAxisGrid({
    grid,
    entered: options.entered,
    collapsed: new Set(collapsed),
    today: "2026-11-12",
    selected: options.selected,
  });
  return {
    grid,
    layout,
    filled: new Set<string>(),
    colors: {},
    collapsed,
    entered: options.entered,
    selected: options.selected,
    focus: undefined,
    notes: {},
    annotations: {},
    hints: undefined,
    id: "map-1",
    terms: undefined,
  };
}

/** 項目の開始タグ */
const axisItems = (html: string) =>
  matches(html, /<div class="[^"]*map-axis-item[^"]*"[^>]*>/g);

// 5 種類の項目と押せる要素（正常系）
test("test_render_map_axis_grid", async () => {
  // 準備
  const { renderMapAxisGrid } = await loadParts();
  const kinds = ["gantt", "timeline", "gitGraph", "journey", "block"] as const;
  // 実行
  const parts = await Promise.all(
    kinds.map(async (kind) => renderMapAxisGrid(await axisGridArgs({ kind }))),
  );
  // 検証
  expect(parts.map((part) => axisItems(part.html).length)).toEqual([
    8, 15, 10, 7, 7,
  ]);
  for (const part of parts) {
    expect(part.html).toMatch(
      /<div class="[^"]*map-axis-item[^"]*"[^>]*><span class="mdmark-diagram-node-hit" role="button" tabindex="0"/,
    );
  }
  const git = parts[2]?.html ?? "";
  const branches = matches(git, /<button[^>]*data-map-branch="[^"]*"[^>]*>/g);
  expect(branches).toHaveLength(3);
  for (const tag of branches) expect(tag).toContain('aria-pressed="false"');
  expect(findTag(parts[0]?.html ?? "", 'class="map-axis-today"')).toContain(
    'aria-hidden="true"',
  );
});

// 閉じた section（正常系）
test("test_render_map_axis_grid_when_collapsed", async () => {
  // 準備
  const { renderMapAxisGrid } = await loadParts();
  // 実行
  const gantt = renderMapAxisGrid(await axisGridArgs({ collapsed: ["開発"] }));
  const block = renderMapAxisGrid(
    await axisGridArgs({ kind: "block", collapsed: ["core"] }),
  );
  // 検証
  expect(plainText(gantt.html)).toContain("開発（タスク 2 件）");
  expect(plainText(block.html).replace(/\s+/g, "")).toContain(
    "core（ブロック2件）",
  );
  expect(findTag(gantt.html, 'data-map-section-toggle="開発"')).toContain(
    'aria-expanded="false"',
  );
  expect(findTag(block.html, 'data-map-section-toggle="core"')).toContain(
    'aria-expanded="false"',
  );
});

// 中へ入ったときの道筋（正常系）
test("test_render_map_axis_grid_when_entered", async () => {
  // 準備
  const { renderMapAxisGrid } = await loadParts();
  // 実行
  const part = renderMapAxisGrid(await axisGridArgs({ entered: "s3" }));
  // 検証
  const trail = outerHtml(part.html, 'class="map-axis-trail"');
  expect(trail).toContain('aria-label="全体からの道筋"');
  expect(plainText(trail).replace(/\s+/g, " ")).toContain("全体 › 準備");
});

// 選んだもののつながりを残す（正常系）
test("test_render_map_axis_grid_when_selected", async () => {
  // 準備
  const { renderMapAxisGrid } = await loadParts();
  const kept = (html: string) =>
    axisItems(html).filter((tag) => !tag.includes("map-dim")).length;
  // 実行
  const gantt = renderMapAxisGrid(
    await axisGridArgs({ selected: { kind: "item", key: "des" } }),
  );
  const git = renderMapAxisGrid(
    await axisGridArgs({
      kind: "gitGraph",
      selected: { kind: "branch", key: "feat" },
    }),
  );
  const journey = renderMapAxisGrid(
    await axisGridArgs({
      kind: "journey",
      selected: { kind: "actor", key: "AI" },
    }),
  );
  // 検証
  expect(kept(gantt.html)).toBe(3);
  for (const key of ["req", "des", "imp"]) {
    expect(findTag(gantt.html, `data-node="${key}"`)).not.toContain("map-dim");
  }
  expect(kept(git.html)).toBe(2);
  expect(kept(journey.html)).toBe(3);
  expect(innerHtml(gantt.html, 'data-node="des"')).toContain(
    'aria-label="設計する（選択中）"',
  );
});

// 全角と半角（正常系）
test("test_map_class_text_width", async () => {
  // 準備
  const { mapClassTextWidth, MAP_CLASS } = await loadParts();
  // 実行
  const width = mapClassTextWidth("検索(a)");
  // 検証
  expect(width).toBeCloseTo(MAP_CLASS.charWide * 2 + MAP_CLASS.charNarrow * 3);
});

// 収まる行と折り返す行（正常系）
test("test_map_class_member_lines", async () => {
  // 準備
  const { mapClassMemberLines } = await loadParts();
  // 実行
  const short = mapClassMemberLines({ text: "数: int", width: 220 });
  const long = mapClassMemberLines({
    text: "検索(絞り込み条件, 期間, 件数, 詳細度, 件数のみ) dict",
    width: 220,
  });
  // 検証
  expect(short).toBe(1);
  expect(long).toBeGreaterThanOrEqual(2);
});

// 折り返した行の高さ（正常系）
test("test_map_class_node_size", async () => {
  // 準備
  const { mapClassNodeSize, MAP_CLASS } = await loadParts();
  // 実行
  const wrapped = mapClassNodeSize({
    width: 220,
    lines: [1, 3],
    collapsed: false,
  });
  const plain = mapClassNodeSize({
    width: 220,
    lines: [1, 1],
    collapsed: false,
  });
  const closed = mapClassNodeSize({
    width: 220,
    lines: [1, 3],
    collapsed: true,
  });
  // 検証
  expect(plain.h).toBe(
    MAP_CLASS.head + MAP_CLASS.row * 2 + MAP_CLASS.divider * 2 + MAP_CLASS.foot,
  );
  expect(wrapped.h - plain.h).toBe(MAP_CLASS.line * 2);
  expect(wrapped.w).toBe(220);
  expect(plain.w).toBe(220);
  expect(closed.h).toBe(MAP_CLASS.head);
});

/** 矩形どうしが重なるか */
const overlapsRect = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ラベルがノードとタイトルを避ける（正常系）
test("test_render_map_class_ends_when_label_near_nodes", async () => {
  // 準備
  const { renderMapClassEnds, MAP_ER } = await loadParts();
  const { MAP_LAYOUT } = await loadLayout();
  const node = (
    id: string,
    rect: { x: number; y: number; w: number; h: number },
  ) => ({
    id,
    ...rect,
    lines: [id],
    faded: false,
    ancestors: [],
  });
  // 縦の区間（x=132、y=100〜300）の左にクラス、右上にノート、中ほどの高さにグループのタイトルの行
  const nodes = [
    node("左", { x: 0, y: 0, w: 128, h: 400 }),
    node("note_1", { x: 136, y: 60, w: 200, h: 120 }),
    node("右", { x: 164, y: 280, w: 120, h: 60 }),
  ];
  const groups = [
    {
      id: "変換",
      title: "変換",
      ancestors: [],
      collapsed: false,
      faded: false,
      x: 136,
      y: 196,
      w: 300,
      h: 200,
    },
  ];
  const layout = {
    width: 500,
    height: 420,
    nodes,
    groups,
    wires: [
      {
        id: "r1",
        from: "左",
        to: "右",
        label: "応答の変換",
        merged: undefined,
        points: [
          [128, 100],
          [132, 100],
          [132, 300],
          [164, 300],
        ] as Array<[number, number]>,
      },
    ],
  };
  // 実行
  const svg = renderMapClassEnds({
    layout,
    ends: [],
    labels: { r1: "応答の変換" },
    dim: new Set(),
  });
  // 検証
  const text =
    /<text class="map-class-label"[^>]*x="([\d.-]+)" y="([\d.-]+)" text-anchor="(\w+)"/.exec(
      svg,
    );
  expect(text).not.toBeNull();
  const x = Number(text?.[1]);
  const y = Number(text?.[2]);
  const anchor = text?.[3];
  const w = "応答の変換".length * MAP_ER.labelChar;
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  const rect = { x: left, y: y - MAP_ER.labelLine + 4, w, h: MAP_ER.labelLine };
  for (const item of nodes) expect(overlapsRect(rect, item)).toBe(false);
  const title = { x: 136, y: 196, w: 300, h: MAP_LAYOUT.groupTitle };
  expect(overlapsRect(rect, title)).toBe(false);
  // 線のいずれかの区間の周り（区間から 1 文字の幅と 1 行の高さの内側）にある
  const near = Math.abs(left - 132) <= w + MAP_ER.labelChar;
  expect(near).toBe(true);
});

/** 縦横の折れ線のどれかの区間が、矩形の内側（辺を除く）を通るか（区間を 20 等分した点で確かめる） */
const polylineEntersRect = (
  points: Array<[number, number]>,
  rect: { x: number; y: number; w: number; h: number },
): boolean => {
  const inside = (x: number, y: number) =>
    x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
  return points.slice(1).some((point, k) => {
    const previous = points[k] as [number, number];
    for (let step = 0; step <= 20; step += 1) {
      const x = previous[0] + ((point[0] - previous[0]) * step) / 20;
      const y = previous[1] + ((point[1] - previous[1]) * step) / 20;
      if (inside(x, y)) return true;
    }
    return false;
  });
};

// 経路の辺のまま付け替え、ほかのテーブルを横切らない（正常系）
test("test_rewire_map_er_when_near_side", async () => {
  // 準備
  const { parseErDiagram, erToFlowchart, erOverrides, erPartRelations } =
    await import("../../../../src/map/er.ts");
  const { layoutMap, estimateTextWidth } = await loadLayout();
  const { rewireMapEr } = await loadParts();
  const { ER, ER_DATA } = await import("../../helpers/map.ts");
  const er = parseErDiagram(ER);
  const groups = JSON.parse(ER_DATA).groups;
  const tables = er.tables.map((table) => ({
    name: table.name,
    columns: table.columns,
  }));
  // 実行
  const placed = layoutMap(
    erToFlowchart(er, groups),
    { collapsed: [] },
    {
      overrides: erOverrides(er, new Set()),
      nodeFit: "height",
      measureText: estimateTextWidth,
    },
  );
  const wires = rewireMapEr({
    layout: placed,
    tables,
    relations: erPartRelations(er),
    collapsed: [],
  });
  // 検証（「注文」→「明細」の端の辺）
  const nodeOf = (id: string) => {
    const node = placed.nodes.find((item) => item.id === id);
    if (!node) throw new Error(`${id} の表がありません`);
    return node;
  };
  const order = nodeOf("注文");
  const detail = nodeOf("明細");
  const wire = wires.find((item) => item.from === "注文" && item.to === "明細");
  const first = wire?.points[0];
  const last = wire?.points.at(-1);
  expect(first?.[0]).toBe(order.x);
  expect(last?.[0]).toBe(detail.x + detail.w);
  // 検証（どの線の区間も両端以外のテーブルの矩形に入らない）
  for (const item of wires) {
    for (const node of placed.nodes) {
      if (node.id === item.from || node.id === item.to) continue;
      expect(
        polylineEntersRect(item.points, node),
        `${item.id} が ${node.id} を横切る`,
      ).toBe(false);
    }
  }
});

// 計画した変更（正常系）
test("test_render_map_flow_when_changes", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const { html } = renderMapFlow({
    ...(await flowArgs()),
    changes: {
      user: "added",
      "user->mount": "added",
      mount: "changed",
      frame: "removed",
      "mount->marker": "removed",
    },
  });
  // 検証
  const user = outerHtml(html, 'data-node="user"');
  expect(findTag(user, 'data-node="user"')).toContain("map-change-added");
  const badge = findTag(user, "mdmark-map-change");
  expect(badge).toContain('data-change="added"');
  expect(badge).toContain('aria-hidden="true"');
  expect(plainText(innerHtml(user, "mdmark-map-change"))).toBe("追加");
  expect(findTag(user, "mdmark-diagram-node-hit")).toMatch(
    /aria-label="利用側のページ、追加"/,
  );
  expect(findTag(outerHtml(html, 'data-node="mount"'), 'data-node="mount"')).toContain(
    "map-change-changed",
  );
  expect(findTag(outerHtml(html, 'data-node="frame"'), 'data-node="frame"')).toContain(
    "map-change-removed",
  );
  const wires = findTags(html, 'class="mdmark-diagram-wire').filter((tag) =>
    tag.includes('data-wire="mount-&gt;marker"'),
  );
  expect(wires.length).toBeGreaterThan(0);
  for (const wire of wires) expect(wire).toContain("map-change-removed");
  expect(outerHtml(html, 'data-node="data"')).not.toContain("mdmark-map-change");
});
