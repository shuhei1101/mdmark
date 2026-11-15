import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { C4, C4_DATA, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** C4 図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadC4View = () => import("../../../../src/map/c4-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** C4 図を描いて付ける */
async function setUp(args?: string, mermaid = C4) {
  const { attachMapC4 } = await loadC4View();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ args, mermaid, data: C4_DATA })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapC4(range, resolveConfig({}), parseMapArgs(args ?? "").args),
  );
  return root;
}

/** 図の枠のタイトル */
const titleOf = (root: HTMLElement) =>
  root.querySelector(".mdmark-diagram-title")?.textContent ?? "";

// 要素と境界（正常系）
test("test_attach_map_c4", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  expect(titleOf(root)).toContain("注文のシステムの全体");
  const node = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node="${id}"]`);
  expect(
    node("support")?.querySelector(".mdmark-diagram-node-kind")?.textContent,
  ).toContain("[External Person]");
  const groupTitle = (id: string) =>
    root.querySelector(`.map-group[data-group="${id}"] .map-group-title`)
      ?.textContent ?? "";
  expect(groupTitle("shop")).toContain("通販［Software System］");
  expect(groupTitle("company")).toContain("自社［Enterprise］");
  const top = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("top") ?? "");
  const left = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("left") ?? "");
  expect(top("stock")).toBeCloseTo(top("store"), 0);
  expect(left("stock")).toBeGreaterThan(left("store"));
  expect(
    root.querySelector('.mdmark-diagram-label[data-wire="r1"]')?.textContent,
  ).toBe("注文する [HTTPS]");
});

// マーカーのタイトルを優先する（正常系）
test("test_attach_map_c4_when_title", async () => {
  // 準備・実行
  const root = await setUp('{"title": "全体"}');
  // 検証
  expect(titleOf(root)).toContain("全体");
  expect(titleOf(root)).not.toContain("注文のシステムの全体");
});

// 上向きの関係（正常系）
test("test_attach_map_c4_when_up", async () => {
  // 準備・実行
  const root = await setUp(
    undefined,
    'C4Context\n  System(a, "A")\n  System(b, "B")\n  Rel_U(a, b, "上へ")\n',
  );
  // 検証: b が a より上にあり、線の終点（矢じり）が b の側にある
  const node = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node="${id}"]`);
  const top = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("top") ?? "");
  const height = (id: string) =>
    Number.parseFloat(node(id)?.style.getPropertyValue("height") ?? "");
  expect(top("b")).toBeLessThan(top("a"));
  const numbers =
    root
      .querySelector('path.mdmark-diagram-wire[data-wire="r1"]')
      ?.getAttribute("d")
      ?.match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? [];
  const endY = numbers.at(-1) ?? Number.NaN;
  expect(Math.abs(endY - (top("b") + height("b")))).toBeLessThan(3);
});
