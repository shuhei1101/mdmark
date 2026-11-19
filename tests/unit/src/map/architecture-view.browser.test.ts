import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { ARCH, ARCH_DATA, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** アーキテクチャ図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadArchView = () => import("../../../../src/map/architecture-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** アーキテクチャ図を描いて付ける */
async function setUp() {
  const { attachMapArchitecture } = await loadArchView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: ARCH, data: ARCH_DATA })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapArchitecture(range, resolveConfig({}), {
      args: parseMapArgs("").args,
    }),
  );
  return root;
}

/** 要素の配置の矩形（style の left・top・width・height） */
const rectOf = (element: HTMLElement | null) => {
  const [x, y, w, h] = ["left", "top", "width", "height"].map((key) =>
    Number.parseFloat(element?.style.getPropertyValue(key) ?? ""),
  ) as [number, number, number, number];
  return { x, y, w, h };
};

/** 線の始点と終点 */
const endsOf = (root: HTMLElement, wire: string) => {
  const numbers =
    root
      .querySelector(`path.mdmark-diagram-wire[data-wire="${wire}"]`)
      ?.getAttribute("d")
      ?.match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? [];
  return {
    start: [numbers[0], numbers[1]] as [number, number],
    end: [numbers.at(-2), numbers.at(-1)] as [number, number],
  };
};

/** 点が矩形の辺の中ほどにあるか */
const atMiddleOf = (
  point: [number, number],
  rect: { x: number; y: number; w: number; h: number },
  side: "top" | "right" | "bottom" | "left",
) => {
  const expected = {
    top: [rect.x + rect.w / 2, rect.y],
    right: [rect.x + rect.w, rect.y + rect.h / 2],
    bottom: [rect.x + rect.w / 2, rect.y + rect.h],
    left: [rect.x, rect.y + rect.h / 2],
  }[side] as [number, number];
  return (
    Math.abs(point[0] - expected[0]) < 2 && Math.abs(point[1] - expected[1]) < 2
  );
};

/** 要素を押して選ぶ（4px 未満の動きで離す） */
const press = (target: HTMLElement | null) => {
  if (!target) return;
  const box = target.getBoundingClientRect();
  const point = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  };
  target.dispatchEvent(new PointerEvent("pointerdown", point));
  window.dispatchEvent(new PointerEvent("pointerup", point));
};

// アイコンと辺（正常系）
test("test_attach_map_architecture", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  const node = (id: string) =>
    root.querySelector<HTMLElement>(`[data-node="${id}"]`);
  expect(
    node("db")?.querySelector(
      '.mdmark-diagram-node-kind svg, [data-icon="database"]',
    ),
  ).not.toBeNull();
  expect(
    root.querySelector(
      '.map-group[data-group="app"] .map-group-head svg:not(.mdmark-diagram-icon)',
    ),
  ).not.toBeNull();
  expect(node("hub")?.getAttribute("data-shape")).toBe("junction");
  const r3 = endsOf(root, "r3");
  expect(atMiddleOf(r3.start, rectOf(node("api")), "bottom")).toBe(true);
  expect(atMiddleOf(r3.end, rectOf(node("worker")), "top")).toBe(true);
  expect(atMiddleOf(endsOf(root, "r2").end, rectOf(node("api")), "top")).toBe(
    true,
  );
});

// group の辺から出る線（正常系）
test("test_attach_map_architecture_when_group_end", async () => {
  // 準備
  const root = await setUp();
  // 実行
  root
    .querySelector<HTMLButtonElement>('button[data-group-toggle="app"]')
    ?.click();
  // 検証
  const closed = root.querySelector<HTMLElement>(
    '.map-closed-group[data-group="app"]',
  );
  expect(closed?.textContent).toContain("service 2 件");
  expect(
    atMiddleOf(endsOf(root, "app->hub").start, rectOf(closed), "right"),
  ).toBe(true);
});

// junction は選ばない（正常系）
test("test_attach_map_architecture_when_junction_pressed", async () => {
  // 準備
  const root = await setUp();
  // 実行
  press(root.querySelector<HTMLElement>('[data-node="hub"]'));
  // 検証
  expect(root.querySelectorAll("[data-node][data-selected]")).toHaveLength(0);
  expect(root.querySelectorAll("[data-node].map-dim")).toHaveLength(0);
});
