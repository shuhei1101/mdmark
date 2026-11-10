import { expect, test } from "vitest";
import { CONFIG, FLOW, SEQUENCE } from "../../helpers/map.ts";
import { matches } from "../../helpers/html.ts";

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
  return { layout, kinds: CONFIG.kinds, lines: CONFIG.lines, collapsed: [], entered, selected: [], focus: undefined, packets: [], dragging: undefined };
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

// 中へ入った（正常系）
test("test_render_map_flow_when_entered", async () => {
  // 準備
  const { renderMapFlow } = await loadParts();
  // 実行
  const html = renderMapFlow(await flowArgs("read"));
  // 検証
  expect(html).toMatch(/data-node="user"[^>]*class="[^"]*map-faded|class="[^"]*map-faded[^"]*"[^>]*data-node="user"/);
  expect(html).not.toMatch(/<button[^>]*data-group-enter="read"/);
});

// 全ての記法（正常系）
test("test_render_map_sequence", async () => {
  // 準備
  const { renderMapSequence } = await loadParts();
  const { parseSequence } = await loadSequence();
  const { sequenceRows } = await loadRows();
  const sequence = parseSequence(SEQUENCE);
  const view = { order: sequence.participants.map((item) => item.id), collapsed: [], entered: undefined };
  const rows = sequenceRows(sequence, view);
  // 実行
  const html = renderMapSequence({ sequence, rows: rows.rows, participants: rows.participants, collapsed: [], entered: undefined, selected: [], focus: undefined });
  // 検証
  expect(matches(html, /class="map-seq-fragment-tab"/g)).toHaveLength(3);
  expect(matches(html, /aria-expanded="true"/g).length).toBeGreaterThanOrEqual(3);
});

// 始める前（正常系）
test("test_render_map_band", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({ mode: "walkthrough", total: 4, index: undefined, title: "", text: "", auto: false, label: "全体の構成の案内" });
  // 検証
  expect(html).toContain("–/4");
  expect(html).toMatch(/<button[^>]*aria-label="案内をやめる"[^>]*disabled/);
});

// 再生（正常系）
test("test_render_map_band_when_playback", async () => {
  // 準備
  const { renderMapBand } = await loadParts();
  // 実行
  const html = renderMapBand({ mode: "playback", total: 7, index: 2, title: "mount を呼ぶ", text: "", auto: false, label: "文書を描くまでの再生" });
  // 検証
  const labels = matches(html, /aria-label="([^"]+)"/g).map((item) => item.replace(/^aria-label="|"$/g, ""));
  expect(labels).toEqual(expect.arrayContaining(["前のメッセージ", "再生をやめる", "自動で進める", "次のメッセージ"]));
});
