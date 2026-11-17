import { expect, test } from "vitest";
import {
  findTag,
  innerHtml,
  matches,
  outerHtml,
  plainText,
} from "../../helpers/html.ts";
import { CONFIG, FLOW, SEQUENCE } from "../../helpers/map.ts";

/** map の部品の HTML を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParts = () => import("../../../../src/parts/map.ts");
const loadLayout = () => import("../../../../src/map/layout.ts");
const loadFlowchart = () => import("../../../../src/map/flowchart.ts");
const loadSequence = () => import("../../../../src/map/sequence.ts");
const loadRows = () => import("../../../../src/map/sequence-rows.ts");

/** 部品『mapの構成図』の Default の引数 */
async function flowArgs(entered?: string) {
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap } = await loadLayout();
  const chart = parseFlowchart(FLOW);
  const layout = layoutMap(
    chart,
    { collapsed: [], entered },
    { overrides: {}, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height" },
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

// 始める前（正常系）
test("test_render_map_band", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({
    mode: "walkthrough",
    total: 4,
    index: undefined,
    title: "",
    text: "",
    auto: false,
    label: "全体の構成の案内",
  });
  // 検証
  expect(html).toContain("–/4");
  expect(html).toMatch(/<button[^>]*aria-label="案内をやめる"[^>]*disabled/);
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
    title: "mount を呼ぶ",
    text: "",
    auto: false,
    label: "文書を描くまでの再生",
  });
  // 検証
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) =>
    item.replace(/^aria-label="|"$/g, ""),
  );
  expect(labels).toEqual(
    expect.arrayContaining([
      "前のメッセージ",
      "再生をやめる",
      "自動で進める",
      "次のメッセージ",
    ]),
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
  const { layoutMap } = await loadLayout();
  const chart = parseFlowchart(
    FLOW.replace('data["補足の検査"]', 'data["<b>補足</b>の検査"]'),
  );
  const layout = layoutMap(
    chart,
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: ["read"], entered: undefined },
    { overrides: {}, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: ["read"], entered: undefined },
    { overrides: {}, nodeFit: "height" },
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
    title: "判定 → 差し戻しの理由を確認する：差し戻し",
    text: "",
    auto: false,
    label: "作業の状態の再生",
  });
  // 検証
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) =>
    item.replace(/^aria-label="|"$/g, ""),
  );
  expect(labels).toEqual(
    expect.arrayContaining([
      "前の遷移",
      "再生をやめる",
      "自動で進める",
      "次の遷移",
    ]),
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
  const { layoutMap } = await loadLayout();
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
    { overrides: erOverrides(er, new Set(collapsed)), nodeFit: "height" },
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
  const wire = layout.wires.find((item) => item.id === "r1");
  const last = wire?.points.at(-1);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(last?.[1]).toBe(
    (order?.y ?? 0) + MAP_ER.head + index * MAP_ER.row + MAP_ER.row / 2,
  );
  expect([order?.x, (order?.x ?? 0) + (order?.w ?? 0)]).toContain(last?.[0]);
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
  const { layoutMap } = await loadLayout();
  const { renderMapStateDiagram } = await loadParts();
  const { STATE } = await import("../../helpers/map.ts");
  const { chart, loops: selfLoops } = stateToFlowchart(
    parseStateDiagram(STATE),
  );
  const { shapes, loops, overrides } = statePartInputs(chart, selfLoops);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const notes = { read: "記法を読み取る部分" };
  const opened = { ...(await flowArgs()), notes };
  const closed = {
    ...opened,
    layout: layoutMap(
      parseFlowchart(FLOW),
      { collapsed: ["read"], entered: undefined },
      { overrides: {}, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const { spreadMapEnds } = await loadParts();
  const { CLASS } = await import("../../helpers/map.ts");
  const diagram = parseClassDiagram(CLASS);
  const chart = classToFlowchart(diagram);
  const { classes, ends, overrides } = classPartInputs(diagram, new Set());
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height" },
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
    },
    {
      visibility: "+",
      name: "描く",
      text: "描く()",
      method: true,
      isStatic: false,
      isAbstract: true,
    },
    {
      visibility: "+",
      name: "数",
      text: "数 int",
      method: false,
      isStatic: true,
      isAbstract: false,
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
  const { layoutMap } = await loadLayout();
  const { rewireMapArchitecture } = await loadParts();
  const { ARCH } = await import("../../helpers/map.ts");
  const diagram = parseArchitecture(ARCH);
  const { chart, overrides } = architectureToFlowchart(diagram);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height" },
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
    const [left, right] = [
      Math.min(point[0], previous[0]),
      Math.max(point[0], previous[0]),
    ];
    const [top, bottom] = [
      Math.min(point[1], previous[1]),
      Math.max(point[1], previous[1]),
    ];
    const inside =
      left < api.x + api.w &&
      right > api.x &&
      top < api.y + api.h &&
      bottom > api.y;
    expect(inside, `r2 の ${index + 1} 本目の区間`).toBe(false);
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
  const { parseC4Context, c4ToFlowchart } = await import(
    "../../../../src/map/c4.ts"
  );
  const { layoutMap } = await loadLayout();
  const { renderMapC4Diagram, spreadMapEnds } = await loadParts();
  const { C4 } = await import("../../helpers/map.ts");
  const { MAP_C4_KINDS } = await import("../../../../src/map/c4.ts");
  const diagram = parseC4Context(C4);
  const { chart, overrides, reversed } = c4ToFlowchart(diagram);
  const layout = layoutMap(
    chart,
    { collapsed: [] },
    { overrides, nodeFit: "height" },
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
  const { layoutMap } = await loadLayout();
  const chart = parseFlowchart("flowchart LR\n  A[受付]:::step --> B[回答]\n");
  const layout = layoutMap(
    chart,
    { collapsed: [], entered: undefined },
    { overrides: {}, nodeFit: "height" },
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
