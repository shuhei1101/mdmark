import { afterEach, expect, test } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { ER, ER_DATA, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** ER 図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadErView = () => import("../../../../src/map/er-view.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");
const loadParts = () => import("../../../../src/parts/map.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
});

/** ER 図を描いて付ける */
async function setUp() {
  const { attachMapEr } = await loadErView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: ER, data: ER_DATA })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(attachMapEr(range, resolveConfig({}), parseMapArgs("").args));
  return root;
}

/** テーブルのノード */
const tableOf = (root: HTMLElement, name: string) =>
  root.querySelector<HTMLElement>(`[data-node="${name}"]`) as HTMLElement;

/** テーブルの種類の行を押して選ぶ（4px 未満の動きで離す） */
const select = (root: HTMLElement, name: string) => {
  const head = tableOf(root, name).querySelector<HTMLElement>(
    ".mdmark-diagram-node-kind",
  ) as HTMLElement;
  const box = head.getBoundingClientRect();
  const point = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.x + 8,
    clientY: box.y + box.height / 2,
  };
  head.dispatchEvent(new PointerEvent("pointerdown", point));
  window.dispatchEvent(new PointerEvent("pointerup", point));
};

// 列の行と関連の端（正常系）
test("test_attach_map_er", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  const order = tableOf(root, "注文");
  expect(order.querySelectorAll(".map-er-column")).toHaveLength(8);
  const { MAP_ER } = await loadParts();
  const rows = [...order.querySelectorAll<HTMLElement>(".map-er-column")];
  const index = rows.findIndex((row) => row.dataset.column === "顧客ID");
  // 列の行の位置は部品の寸法で決まる（単体テストの環境では map の CSS が当たらないため、DOM の位置で比べない）
  const rowMiddle =
    Number.parseFloat(order.style.top) +
    MAP_ER.head +
    index * MAP_ER.row +
    MAP_ER.row / 2;
  const path = root.querySelector<SVGPathElement>(
    'path.mdmark-diagram-wire[data-wire="r1"]',
  );
  const points =
    (path?.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const lastY = points.at(-1) ?? Number.NaN;
  expect(Math.abs(lastY - rowMiddle)).toBeLessThan(2);
  expect(
    root.querySelectorAll(".map-er-cardinality").length,
  ).toBeGreaterThanOrEqual(10);
});

// 2 つのテーブルの経路（正常系）
test("test_attach_map_er_when_path_selected", async () => {
  // 準備
  const root = await setUp();
  // 実行
  select(root, "顧客");
  select(root, "明細");
  // 検証
  expect(root.querySelectorAll("button.map-er-fanout")).toHaveLength(3);
  expect(tableOf(root, "支払い").classList.contains("map-dim")).toBe(true);
});

// 列を閉じる（正常系）
test("test_attach_map_er_when_columns_collapsed", async () => {
  // 準備
  const root = await setUp();
  // 実行
  tableOf(root, "注文")
    .querySelector<HTMLButtonElement>("button.map-er-toggle")
    ?.click();
  // 検証
  const order = tableOf(root, "注文");
  expect(order.querySelectorAll(".map-er-column")).toHaveLength(0);
  const toggle = order.querySelector<HTMLButtonElement>("button.map-er-toggle");
  expect(toggle?.textContent).toContain("列 8");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  const middle =
    Number.parseFloat(order.style.top) +
    Number.parseFloat(order.style.height) / 2;
  const path = root.querySelector<SVGPathElement>(
    'path.mdmark-diagram-wire[data-wire="r1"]',
  );
  const points =
    (path?.getAttribute("d") ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const lastY = points.at(-1) ?? Number.NaN;
  expect(Math.abs(lastY - middle)).toBeLessThan(2);
});

// 配置し直した後の列の説明のツールチップ（正常系）
test("test_attach_map_er_when_relayout_column_tip", async () => {
  // 準備
  const root = await setUp();
  const toggleOf = () =>
    tableOf(root, "注文").querySelector<HTMLButtonElement>(
      "button.map-er-toggle",
    );
  toggleOf()?.click();
  toggleOf()?.click();
  // 実行
  const note = tableOf(root, "注文").querySelector<HTMLButtonElement>(
    '[data-column="状態"] button.map-er-note',
  ) as HTMLButtonElement;
  note.focus();
  // 検証
  const tip = root.querySelector<HTMLElement>(
    `#${CSS.escape(note.getAttribute("aria-describedby") ?? "")}`,
  );
  expect(tip?.getAttribute("role")).toBe("tooltip");
  expect(tip?.hidden).toBe(false);
});
