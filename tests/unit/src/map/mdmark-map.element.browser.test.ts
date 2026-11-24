import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** map の図のカスタム要素を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElement = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/map/mdmark-map.element.ts")>(
      "../../../../src/map/mdmark-map.element.ts",
    ),
  );

/** 部品のモジュールを読み込む処理を読み込む */
const loadPartModules = () => import("../../../../src/part-modules.ts");

/** map の部品のモジュールを読み込む */
const loadMap = () => import("../../../../src/map/index.ts");

const elements: HTMLElement[] = [];

beforeAll(async () => {
  addStyles();
  const { defineMapElement } = await loadElement().catch(() => ({
    defineMapElement: undefined,
  }));
  defineMapElement?.(customElements);
});

beforeEach(async () => {
  const { partModules, partModuleLoaders, setPartModuleLoader } =
    await loadPartModules();
  partModules.clear();
  partModuleLoaders.clear();
  setPartModuleLoader("map", loadMap);
});

afterEach(() => {
  for (const element of elements.splice(0)) {
    element.remove();
  }
  sessionStorage.clear();
});

/** ノード 3 つ・線 2 本の構成図 */
const SOURCE = "flowchart LR\n  ui[画面] --> api[API]\n  api --> db[(DB)]\n";

/** 型 MdmarkMapElement のプロパティを持つ要素 */
type MapElement = HTMLElement & {
  source?: unknown;
  data?: unknown;
  options?: unknown;
};

/** ページに配置した <mdmark-map> */
function createMap(): MapElement {
  const element = document.createElement("mdmark-map") as MapElement;
  document.body.append(element);
  elements.push(element);
  return element;
}

/** 描き終えるまで待つ（部品のモジュールの読み込みを含む） */
async function settled(element: HTMLElement): Promise<void> {
  await vi.waitFor(() =>
    expect(
      element.querySelector('figure.mdmark-diagram[data-diagram="map"]') ??
        element.querySelector(".mdmark-notice"),
    ).not.toBeNull(),
  );
}

/** 要素の中央をポインターで押す */
function press(target: Element): void {
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
  target.dispatchEvent(new MouseEvent("click", point));
}

/** 図の外に描かれた本文（図の枠と通知ブロックのほかの段落） */
function strayParagraphs(element: HTMLElement): Element[] {
  return [...element.querySelectorAll("p")].filter(
    (paragraph) =>
      !paragraph.closest("figure.mdmark-diagram") &&
      !paragraph.closest(".mdmark-notice"),
  );
}

// Mermaid と補足から構成図を描き、ノードの押下を送信する（正常系）
test("test_render_now", async () => {
  // 準備
  await loadElement();
  const element = createMap();
  const clicks = vi.fn();
  element.addEventListener("mdmark-node-click", (event) =>
    clicks((event as CustomEvent).detail),
  );
  element.source = SOURCE;
  element.data = { version: 1, notes: { api: { text: "認証を受け持つ" } } };
  element.options = { title: "全体の構成" };
  await settled(element);
  const node = element.querySelector('.mdmark-diagram-node[data-node="api"]');
  // 実行
  if (node) {
    press(node);
  }
  // 検証
  expect(
    element.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
  ).toHaveLength(1);
  expect(clicks).toHaveBeenCalledTimes(1);
  expect(clicks).toHaveBeenCalledWith({ id: "api" });
});

// 誤った指定は通知ブロックを描く（異常系）
test("test_render_now_when_invalid", async () => {
  // 準備
  await loadElement();
  const element = createMap();
  // 実行
  const assign = () => {
    element.source = SOURCE;
    element.options = { collapse: { open: false } };
  };
  expect(assign).not.toThrow();
  await settled(element);
  // 検証
  const notice = element.querySelector(".mdmark-notice");
  expect(notice?.innerHTML).toContain("この図を表示できません");
  expect(notice?.innerHTML).toContain("<code>options.collapse</code>");
});

// `-->` を持つ補足の文字でも、map の範囲を閉じずに図を描く（正常系）
test("test_render_now_when_data_has_comment_end", async () => {
  // 準備
  await loadElement();
  const element = createMap();
  // 実行
  element.source = SOURCE;
  element.data = {
    version: 1,
    notes: { api: { text: "API --> DB の順に呼ぶ" } },
  };
  await settled(element);
  // 検証
  expect(
    element.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
  ).toHaveLength(1);
  expect(element.querySelector(".mdmark-notice")).toBeNull();
  expect(strayParagraphs(element)).toEqual([]);
  const data = JSON.parse(
    element.querySelector(".mdmark-map-data")?.textContent ?? "{}",
  ) as { notes?: Record<string, { text?: string }> };
  expect(data.notes?.api?.text).toBe("API --> DB の順に呼ぶ");
});

// ``` の行を持つ source でも、コードブロックを途中で閉じずに図を描く（正常系）
test("test_render_now_when_source_has_fence", async () => {
  // 準備
  await loadElement();
  const element = createMap();
  // 実行
  element.source =
    "flowchart LR\n  ui[画面] --> api[API]\n%% ```\n  api --> db[(DB)]\n";
  await settled(element);
  // 検証
  expect(
    element.querySelectorAll('figure.mdmark-diagram[data-diagram="map"]'),
  ).toHaveLength(1);
  expect(element.querySelector(".mdmark-notice")).toBeNull();
  expect(strayParagraphs(element)).toEqual([]);
  expect(
    element.querySelector('.mdmark-diagram-node[data-node="db"]'),
  ).not.toBeNull();
});

// 未登録なら登録し、登録済みなら何もしない（正常系）
test("test_define_map_element", async () => {
  // 準備
  const { defineMapElement, MdmarkMapElement } = await loadElement();
  const define = vi.fn();
  const registered: Array<CustomElementConstructor | undefined> = [
    undefined,
    class extends HTMLElement {},
  ];
  const registry = {
    get: vi.fn(() => registered.shift()),
    define,
  } as unknown as CustomElementRegistry;
  // 実行
  defineMapElement(registry);
  defineMapElement(registry);
  // 検証
  expect(define).toHaveBeenCalledTimes(1);
  expect(define).toHaveBeenCalledWith("mdmark-map", MdmarkMapElement);
});
