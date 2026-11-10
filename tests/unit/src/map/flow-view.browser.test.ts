import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { CONFIG, DATA, FLOW, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** 構成図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFlowView = () => import("../../../../src/map/flow-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** sessionStorage に保った 1 つ目の図の状態 */
const saved = () => JSON.parse(sessionStorage.getItem(`mdmark-map:${location.pathname}#1`) ?? "{}");

/** 構成図を描いて付ける */
async function setUp(search = "") {
  history.replaceState(null, "", `${location.pathname}${search}`);
  const { attachMapFlow } = await loadFlowView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(renderDoc(mapRange({ mermaid: FLOW, data: DATA })).html);
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  const handle = attachMapFlow(range, resolveConfig({ config: { map: CONFIG } }), parseMapArgs("").args);
  handles.push(handle);
  return root;
}

// グループを閉じる（正常系）
test("test_attach_map_flow_when_toggle", async () => {
  // 準備
  const root = await setUp();
  // 実行
  root.querySelector<HTMLButtonElement>('button[aria-label="データを閉じる"]')?.click();
  // 検証
  expect(root.querySelector('[data-group="store"]')?.classList.contains("map-closed-group")).toBe(true);
  expect(saved().collapsed).toEqual(["store"]);
});

// 線を押す（正常系）
test("test_attach_map_flow_when_select_wire", async () => {
  // 準備
  const root = await setUp();
  const wire = root.querySelector<SVGElement>('.map-wire-hit[data-wire="mount->marker"]') as SVGElement;
  const press = () => {
    const box = wire.getBoundingClientRect();
    const point = { bubbles: true, pointerId: 1, button: 0, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    wire.dispatchEvent(new PointerEvent("pointerdown", point));
    window.dispatchEvent(new PointerEvent("pointerup", point));
  };
  // 実行
  press();
  // 検証
  expect(saved().selected).toEqual(["mount", "marker"]);
  press();
  expect(saved().selected).toEqual([]);
});

// Esc（正常系）
test("test_attach_map_flow_when_escape", async () => {
  // 準備
  const root = await setUp("?map-1=read");
  const figure = root.querySelector("figure") as HTMLElement;
  // 実行
  figure.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  // 検証
  expect(saved().entered).toBe("lib");
  expect(location.search).toBe("?map-1=lib");
});
