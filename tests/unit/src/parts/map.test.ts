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
  const layout = layoutMap(chart, { collapsed: [], entered }, {}, "height");
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
    {},
    "height",
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
    {},
    "height",
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

// まとめた線の説明（正常系）
test("test_render_map_flow_when_merged_notes", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  const { parseFlowchart } = await loadFlowchart();
  const { layoutMap } = await loadLayout();
  const layout = layoutMap(
    parseFlowchart(FLOW),
    { collapsed: ["read"], entered: undefined },
    {},
    "height",
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
      {},
      "height",
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
