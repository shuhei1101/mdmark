import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { CLASS, CLASS_DATA, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** クラス図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadClassView = () => import("../../../../src/map/class-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** クラス図を描いて付ける */
async function setUp(mermaid = CLASS, data = CLASS_DATA) {
  const { attachMapClass } = await loadClassView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(renderDoc(mapRange({ mermaid, data })).html);
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(attachMapClass(range, resolveConfig({}), parseMapArgs("").args));
  return root;
}

/** クラスのノード */
const nodeOf = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-node="${id}"]`) as HTMLElement;

/** 線の点の並び */
const pointsOf = (root: HTMLElement, wire: string) => {
  const numbers =
    root
      .querySelector(`path.mdmark-diagram-wire[data-wire="${wire}"]`)
      ?.getAttribute("d")
      ?.match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? [];
  const points: Array<[number, number]> = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push([numbers[index] as number, numbers[index + 1] as number]);
  }
  return points;
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

// メンバーと関係の端（正常系）
test("test_attach_map_class", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  const base = nodeOf(root, "基本図形");
  const lists = base.querySelectorAll('.map-class-members[role="list"]');
  expect(lists).toHaveLength(2);
  expect(lists[0]?.querySelectorAll('[role="listitem"]')).toHaveLength(2);
  expect(lists[1]?.querySelectorAll('[role="listitem"]')).toHaveLength(1);
  const draw = [
    ...base.querySelectorAll<HTMLElement>(".map-class-member"),
  ].find((row) => row.textContent?.includes("描く"));
  expect(draw?.classList.contains("is-abstract")).toBe(true);
  expect(draw?.querySelector("button.map-class-note")).not.toBeNull();
  const triangle = root.querySelector(
    'svg.map-class-ends [data-wire-mark="r1"][data-end-shape="triangle"]',
  );
  expect(triangle).not.toBeNull();
  const cards = [
    ...root.querySelectorAll('svg.map-class-ends text[data-wire-mark="r7"]'),
  ].map((text) => text.textContent);
  expect(cards).toEqual(expect.arrayContaining(["1", "*"]));
});

// メンバーを閉じる（正常系）
test("test_attach_map_class_when_members_collapsed", async () => {
  // 準備
  const root = await setUp();
  // 実行
  nodeOf(root, "基本図形")
    .querySelector<HTMLButtonElement>("button.map-class-toggle")
    ?.click();
  // 検証
  const base = nodeOf(root, "基本図形");
  expect(base.querySelectorAll(".map-class-member")).toHaveLength(0);
  const toggle = base.querySelector<HTMLButtonElement>(
    "button.map-class-toggle",
  );
  expect(toggle?.textContent).toContain("メンバー 3");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
});

// 同じ点から出る端（正常系）
test("test_attach_map_class_when_shared_ends", async () => {
  // 準備: 「基本図形」から 3 本の線が同じ下の辺へ入るよう、相手を下に並べる
  const source =
    "classDiagram\n  class 親\n  class 甲\n  class 乙\n  class 丙\n  親 <|-- 甲\n  親 <|-- 乙\n  親 <|-- 丙\n";
  const data = JSON.stringify({
    version: 1,
    layout: {
      r1: { ends: { from: { side: "bottom" } } },
      r2: { ends: { from: { side: "bottom" } } },
      r3: { ends: { from: { side: "bottom" } } },
    },
  });
  // 実行
  const root = await setUp(source, data);
  // 検証
  const starts = ["r1", "r2", "r3"].map((wire) => pointsOf(root, wire)[0]);
  const xs = starts
    .map((point) => point?.[0] ?? Number.NaN)
    .sort((a, b) => a - b);
  expect(Math.round((xs[1] as number) - (xs[0] as number))).toBe(16);
  expect(Math.round((xs[2] as number) - (xs[1] as number))).toBe(16);
  for (const wire of ["r1", "r2", "r3"]) {
    const [first, second] = pointsOf(root, wire);
    expect(first?.[0]).toBeCloseTo(second?.[0] ?? Number.NaN, 0);
  }
});

// ノートは選ばない（正常系）
test("test_attach_map_class_when_note_pressed", async () => {
  // 準備
  const root = await setUp();
  // 実行
  press(nodeOf(root, "note_1"));
  // 検証
  expect(root.querySelectorAll("[data-node][data-selected]")).toHaveLength(0);
  expect(root.querySelectorAll("[data-node].map-dim")).toHaveLength(0);
});

// click・link の行のクラスをリンクにする（正常系）
test("test_attach_map_class_when_linked", async () => {
  // 準備
  const source = [
    "classDiagram",
    "  class 受付",
    "  class 台帳 {",
    "    +番号 int",
    "  }",
    "  class 危険",
    "  class 予約",
    '  click 受付 href "./doc-2"',
    '  link 台帳 "./doc-3"',
    '  click 危険 href "javascript:alert(1)"',
    "",
  ].join("\n");
  // 実行
  const root = await setUp(source, JSON.stringify({ version: 1 }));
  // 検証
  const linkOf = (id: string) =>
    nodeOf(root, id).querySelector("a.mdmark-diagram-node-link");
  expect(nodeOf(root, "受付").classList.contains("has-link")).toBe(true);
  expect(linkOf("受付")?.getAttribute("href")).toBe("./doc-2");
  expect(nodeOf(root, "台帳").classList.contains("has-link")).toBe(true);
  expect(linkOf("台帳")?.getAttribute("href")).toBe("./doc-3");
  for (const id of ["危険", "予約"]) {
    expect(nodeOf(root, id).classList.contains("has-link")).toBe(false);
    expect(nodeOf(root, id).querySelector("a")).toBeNull();
  }
});
