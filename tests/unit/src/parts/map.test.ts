import { expect, test } from "vitest";
import { findTag, matches, outerHtml, plainText } from "../../helpers/html.ts";
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
    expect(node).toContain('tabindex="0"');
    expect(node).toContain('role="button"');
  }
  const hits = matches(html, /<path class="map-wire-hit"[^>]*>/g);
  expect(hits.length).toBeGreaterThan(0);
  for (const hit of hits) expect(hit).toContain('tabindex="0"');
  expect(html).not.toMatch(/data-group="read"[^>]*><div class="map-group-bar"/);
  expect(renderMapFlow(await flowArgs()).html).toMatch(
    /data-group="read"[^>]*><div class="map-group-bar"/,
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
