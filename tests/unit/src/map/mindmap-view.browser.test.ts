import { afterEach, expect, test } from "vitest";
import {
  addStyles,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import {
  MINDMAP,
  MINDMAP_DATA,
  MINDMAP_LAYOUT_DATA,
  MINDMAP_WALK_DATA,
  mapRange,
} from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

/** マインドマップを付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMindmapView = () => import("../../../../src/map/mindmap-view.ts");
const loadMindmap = () => import("../../../../src/map/mindmap.ts");
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
const saved = () =>
  JSON.parse(
    sessionStorage.getItem(`mdmark-map:${location.pathname}#1`) ?? "{}",
  );

/** マインドマップを描いて付ける。`width` を指定すると、その幅の置き場所に描く */
async function setUp(data = MINDMAP_DATA, width?: number) {
  const { attachMapMindmap } = await loadMindmapView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: MINDMAP, data })).html,
  );
  if (width !== undefined) root.style.width = `${width}px`;
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapMindmap(range, resolveConfig({}), parseMapArgs("").args),
  );
  return root;
}

/** 項目の要素 */
const itemOf = (root: HTMLElement, key: string) =>
  root.querySelector<HTMLElement>(
    `.map-mindmap-item[data-node="${CSS.escape(key)}"]`,
  );

/** 項目の押せる要素 */
const hitOf = (root: HTMLElement, key: string) =>
  itemOf(root, key)?.querySelector<HTMLElement>(".mdmark-diagram-node-hit") ??
  null;

/** 項目の持ち手のボタン */
const gripButton = (root: HTMLElement, key: string, kind: "toggle" | "enter") =>
  root.querySelector<HTMLButtonElement>(
    `[data-mindmap-${kind}="${CSS.escape(key)}"]`,
  );

/** 図の枠の中のキー操作 */
const pressKey = (target: Element | null, key: string) =>
  target?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

// 木の配置で描く（正常系）
test("test_attach_map_mindmap", async () => {
  // 準備・実行
  const root = await setUp();
  // 検証
  expect(
    root.querySelectorAll(
      'figure.mdmark-diagram[data-diagram="map"] .map-mindmap-item',
    ),
  ).toHaveLength(14);
  expect(
    itemOf(root, "a1")?.querySelector(".mdmark-diagram-info"),
  ).not.toBeNull();
  expect(
    itemOf(root, "人手が足りない")?.querySelector(".mdmark-diagram-info"),
  ).not.toBeNull();
  expect(
    root.querySelector<HTMLButtonElement>('[data-tool="reset"]')?.disabled,
  ).toBe(true);
  expect(
    root.querySelector<HTMLButtonElement>('[data-tool="back"]')?.disabled,
  ).toBe(true);
});

// 枝を閉じる（正常系）
test("test_attach_map_mindmap_when_toggled", async () => {
  // 準備
  const root = await setUp();
  // 実行
  gripButton(root, "体制", "toggle")?.click();
  // 検証
  expect(saved().collapsed).toEqual(["体制"]);
  expect(itemOf(root, "人手が足りない")).toBeNull();
  expect(document.activeElement).toBe(gripButton(root, "体制", "toggle"));
});

// 枝の中へ入って戻る（正常系）
test("test_attach_map_mindmap_when_entered", async () => {
  // 準備
  const root = await setUp();
  // 実行
  gripButton(root, "体制", "enter")?.click();
  // 検証
  expect(saved().entered).toBe("体制");
  expect(root.querySelectorAll(".map-mindmap-item")).toHaveLength(4);
  expect(
    root.querySelector(".map-mindmap-trail")?.textContent?.replace(/\s+/g, " "),
  ).toContain("企画の論点 › 体制");
  // 実行・検証: Esc で 1 つ外へ戻る
  pressKey(root.querySelector("figure"), "Escape");
  expect(saved().entered).toBeUndefined();
  expect(root.querySelectorAll(".map-mindmap-item")).toHaveLength(14);
});

// 項目を選ぶ（正常系）
test("test_attach_map_mindmap_when_selected", async () => {
  // 準備
  const root = await setUp();
  // 実行・検証: 押せる要素で選ぶ
  hitOf(root, "体制")?.click();
  expect(saved().selected).toEqual(["体制"]);
  expect(
    root.querySelector<HTMLButtonElement>('[data-tool="reset"]')?.disabled,
  ).toBe(false);
  // 実行・検証: 名前の文字では変わらない
  itemOf(root, "体制")
    ?.querySelector<HTMLElement>(".mdmark-diagram-node-name")
    ?.click();
  expect(saved().selected).toEqual(["体制"]);
  // 実行・検証: Enter で選ぶ
  const hit = hitOf(root, "利用者を増やす");
  hit?.focus();
  pressKey(hit, "Enter");
  expect(saved().selected).toEqual(["利用者を増やす"]);
  // 実行・検証: Esc で選択を解除する
  pressKey(hitOf(root, "利用者を増やす"), "Escape");
  expect(saved().selected).toEqual([]);
});

// 補足の layout と同じ文字のキー（正常系）
test("test_attach_map_mindmap_when_layout", async () => {
  // 準備
  const data = JSON.parse(MINDMAP_LAYOUT_DATA);
  data.notes.課題 = { text: "どちらの課題か決まらない" };
  // 実行
  const root = await setUp(JSON.stringify(data));
  const { parseMindmap } = await loadMindmap();
  const issues = parseMindmap(MINDMAP).items.filter(
    (item) => item.label === "課題",
  );
  // 検証
  const purpose = itemOf(root, "a1");
  expect(purpose?.style.getPropertyValue("--map-mindmap-color")).toContain(
    "purple",
  );
  expect(purpose?.classList.contains("map-mindmap-filled")).toBe(true);
  expect(
    gripButton(root, "予算", "toggle")?.getAttribute("aria-expanded"),
  ).toBe("false");
  for (const item of issues) {
    expect(
      itemOf(root, item.stateKey)?.querySelector(".mdmark-diagram-info"),
    ).toBeNull();
  }
});

// 同じ文字の項目の状態のキー（正常系）
test("test_attach_map_mindmap_when_same_label_collapsed", async () => {
  // 準備
  const root = await setUp();
  const { parseMindmap } = await loadMindmap();
  const [first, second] = parseMindmap(MINDMAP).items.filter(
    (item) => item.label === "課題",
  );
  // 実行
  gripButton(root, first?.stateKey ?? "", "toggle")?.click();
  // 検証
  expect(saved().collapsed).toEqual([first?.stateKey]);
  expect(
    gripButton(root, second?.stateKey ?? "", "toggle")?.getAttribute(
      "aria-expanded",
    ),
  ).toBe("true");
});

// 案内（正常系）
test("test_attach_map_mindmap_when_walked", async () => {
  // 準備
  const root = await setUp(MINDMAP_WALK_DATA);
  const { parseMindmap } = await loadMindmap();
  const issue = parseMindmap(MINDMAP).items.find(
    (item) => item.label === "課題",
  );
  // 実行
  for (let i = 0; i < 2; i += 1)
    root.querySelector<HTMLButtonElement>('[data-band="next"]')?.click();
  // 検証
  const items = [...root.querySelectorAll<HTMLElement>(".map-mindmap-item")];
  expect(items).toHaveLength(4);
  const kept = new Set(["体制", issue?.stateKey, "人手が足りない"]);
  for (const item of items) {
    expect(item.classList.contains("map-dim")).toBe(
      !kept.has(item.dataset.node),
    );
  }
});

// 最初に根を中央へスクロールする（正常系）
test("test_attach_map_mindmap_when_initial_scroll", async () => {
  // 準備
  addStyles();
  // 実行
  const root = await setUp(MINDMAP_DATA, 390);
  // 検証
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const rootItem = itemOf(root, "root") as HTMLElement;
  expect(viewport.scrollLeft).toBeGreaterThan(0);
  const box = viewport.getBoundingClientRect();
  const item = rootItem.getBoundingClientRect();
  const center = (rect: DOMRect) => rect.left + rect.width / 2;
  expect(Math.abs(center(item) - center(box))).toBeLessThan(2);
  expect(root.querySelector("figure")?.dataset.fitMin).toBe("1");
});
