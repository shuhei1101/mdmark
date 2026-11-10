import { expect, test } from "vitest";
import { matches } from "../../helpers/html.ts";
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
  const html = renderMapFlow(await flowArgs());
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
  const html = renderMapFlow(args);
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
  expect(renderMapFlow(await flowArgs())).toMatch(
    /data-group="read"[^>]*><div class="map-group-bar"/,
  );
});

// 中へ入った（正常系）
test("test_render_map_flow_when_entered", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const html = renderMapFlow(await flowArgs("read"));
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
  const html = renderMapSequence({
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
  const html = renderMapFlow({
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
  const html = renderMapFlow({
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
