import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";
import { CONFIG, DATA, FLOW, mapRange } from "../../helpers/map.ts";
import { renderDoc } from "../../helpers/render.ts";

// 配置と並べる処理の呼び出しを数えられるようにする（既定は実際の処理を呼ぶ）
vi.mock("../../../../src/map/layout.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../src/map/layout.ts")>();
  const separate = (actual as Record<string, unknown>).separateWires as
    | ((layout: unknown) => unknown)
    | undefined;
  return {
    ...actual,
    layoutMap: vi.fn(actual.layoutMap),
    separateWires: vi.fn((layout: { wires: unknown[] }) =>
      separate ? separate(layout) : { wires: layout.wires, crowded: 0 },
    ),
  };
});

/** 構成図を付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFlowView = () => import("../../../../src/map/flow-view.ts");
const loadLayout = () => import("../../../../src/map/layout.ts");
const loadSpec = () => import("../../../../src/map/spec.ts");
const loadConfig = () => import("../../../../src/config.ts");

const handles: Array<{ destroy: () => void }> = [];

afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  removeRoots();
  sessionStorage.clear();
  history.replaceState(null, "", location.pathname);
  vi.restoreAllMocks();
});

/** sessionStorage に保った 1 つ目の図の状態 */
const saved = () =>
  JSON.parse(
    sessionStorage.getItem(`mdmark-map:${location.pathname}#1`) ?? "{}",
  );

/** 構成図を描いて付ける */
async function setUp(search = "", mermaid = FLOW) {
  history.replaceState(null, "", `${location.pathname}${search}`);
  const { attachMapFlow } = await loadFlowView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid, data: DATA })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  const handle = attachMapFlow(
    range,
    resolveConfig({ config: { map: CONFIG } }),
    { args: parseMapArgs("").args },
  );
  handles.push(handle);
  return root;
}

// グループを閉じる（正常系）
test("test_attach_map_flow_when_toggle", async () => {
  // 準備
  const root = await setUp();
  // 実行
  root
    .querySelector<HTMLButtonElement>('button[aria-label="データを閉じる"]')
    ?.click();
  // 検証
  expect(
    root
      .querySelector('[data-group="store"]')
      ?.classList.contains("map-closed-group"),
  ).toBe(true);
  expect(saved().collapsed).toEqual(["store"]);
});

// 線を押す（正常系）
test("test_attach_map_flow_when_select_wire", async () => {
  // 準備
  const root = await setUp();
  const wire = root.querySelector<SVGElement>(
    '.map-wire-hit[data-wire="mount->marker"]',
  ) as SVGElement;
  const press = () => {
    const box = wire.getBoundingClientRect();
    const point = {
      bubbles: true,
      pointerId: 1,
      button: 0,
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
    };
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
  figure.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  // 検証
  expect(saved().entered).toBe("lib");
  expect(location.search).toBe("?map-1=lib");
});

// 選んだ線と指した線の印（正常系）
test("test_attach_map_flow_when_packets", async () => {
  // 準備
  const root = await setUp();
  const packetsOn = (wire: string) =>
    root.querySelectorAll(`.map-packet[data-wire="${wire}"]`).length;
  const node = root.querySelector<HTMLElement>(
    '.mdmark-diagram-node[data-node="mount"] .mdmark-diagram-node-kind',
  ) as HTMLElement;
  const press = (target: Element) => {
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
  // 実行・検証: 選ぶ
  press(node);
  expect(packetsOn("mount->marker")).toBeGreaterThan(0);
  // 選択を解く
  press(
    root.querySelector<HTMLElement>(
      '.mdmark-diagram-node[data-node="mount"] .mdmark-diagram-node-kind',
    ) as HTMLElement,
  );
  expect(root.querySelectorAll(".map-packet")).toHaveLength(0);
  // 線を指す
  const hit = root.querySelector<SVGElement>(
    '.map-wire-hit[data-wire="marker->data"]',
  ) as SVGElement;
  hit.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  expect(packetsOn("marker->data")).toBeGreaterThan(0);
  expect(
    [...root.querySelectorAll(".map-packet")].every(
      (item) => item.getAttribute("data-wire") === "marker->data",
    ),
  ).toBe(true);
  hit.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  expect(root.querySelectorAll(".map-packet")).toHaveLength(0);
});

// 中へ入る手順の後の手順（正常系）
test("test_attach_map_flow_when_walk_leaves_group", async () => {
  // 準備
  const root = await setUp();
  const press = (action: string) =>
    root.querySelector<HTMLButtonElement>(`[data-band="${action}"]`)?.click();
  // 実行
  for (let i = 0; i < 3; i += 1) press("next");
  // 検証
  expect(root.querySelector(".map-group-title.is-current")?.textContent).toBe(
    "配置",
  );
  // 実行・検証: 前へで手順 2 に戻ると、案内を始めた全体の図に戻る
  press("prev");
  expect(root.querySelector(".map-band-count")?.textContent).toBe("2/4");
  expect(root.querySelector(".map-group-title.is-current")).toBeNull();
});

// 外からスクロールする（正常系）
test("test_attach_map_flow_when_follow", async () => {
  // 準備
  const root = await setUp();
  const handle = handles.at(-1) as unknown as {
    follow: (nodes: string[]) => void;
    resumeFollow: () => void;
  };
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});
  // 実行
  handle.follow(["mount", "marker"]);
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  handle.follow(["mount", "marker"]);
  handle.resumeFollow();
  handle.follow(["mount", "marker"]);
  // 検証
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

// 指のドラッグを pointercancel で止めたとき、動かす前の配置を保ち、受け取りを残さない（正常系）
test("test_attach_map_flow_when_drag_cancelled", async () => {
  // 準備
  const root = await setUp();
  const node = root.querySelector<HTMLElement>(
    '[data-node="mount"]',
  ) as HTMLElement;
  const before = node.style.cssText;
  const box = node.getBoundingClientRect();
  const point = (dy: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType: "touch",
    clientX: box.x + 4,
    clientY: box.y + 4 + dy,
  });
  // 実行: 下へ 40px 動かしてから pointercancel、続けてさらに下へ 40px
  node.dispatchEvent(new PointerEvent("pointerdown", point(0)));
  window.dispatchEvent(new PointerEvent("pointermove", point(40)));
  window.dispatchEvent(new PointerEvent("pointercancel", point(40)));
  const afterCancel = root.querySelector<HTMLElement>('[data-node="mount"]')
    ?.style.cssText;
  window.dispatchEvent(new PointerEvent("pointermove", point(80)));
  // 検証
  expect(saved().positions?.mount).toBeUndefined();
  expect(afterCancel).toBe(before);
  expect(
    root.querySelector<HTMLElement>('[data-node="mount"]')?.style.cssText,
  ).toBe(before);
});

// リンク先を持つノードを動かしたときは開かず、動かさずに押すと開く（正常系）
test("test_attach_map_flow_when_node_link", async () => {
  // 準備
  const root = await setUp(
    "",
    `${FLOW}  click mount "https://example.com/spec"\n`,
  );
  // document まで届いた click と図が止めたかを記録し、記録した後はテストのページを移らないようにする
  const prevented: boolean[] = [];
  const check = (event: MouseEvent) => {
    prevented.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener("click", check);
  const node = () =>
    root.querySelector<HTMLElement>('[data-node="mount"]') as HTMLElement;
  const kind = () =>
    node().querySelector<HTMLElement>(
      ".mdmark-diagram-node-kind",
    ) as HTMLElement;
  const before = node().style.cssText;
  const box = kind().getBoundingClientRect();
  const point = (dx: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
    clientX: box.x + 4 + dx,
    clientY: box.y + 4,
  });
  try {
    // 実行: 種類の行を 40px ドラッグして離し、続けて動かさずに押す
    kind().dispatchEvent(new PointerEvent("pointerdown", point(0)));
    window.dispatchEvent(new PointerEvent("pointermove", point(40)));
    window.dispatchEvent(new PointerEvent("pointerup", point(40)));
    const dragged = new MouseEvent("click", {
      ...point(40),
      cancelable: true,
    });
    kind().dispatchEvent(dragged);
    const moved = node().style.cssText;
    kind().dispatchEvent(new PointerEvent("pointerdown", point(40)));
    window.dispatchEvent(new PointerEvent("pointerup", point(40)));
    // 押すとノードを選んで描き直すため、描き直した後のリンクを押す
    const link = node().querySelector<HTMLAnchorElement>(
      "a.mdmark-diagram-node-link",
    ) as HTMLAnchorElement;
    link.dispatchEvent(
      new MouseEvent("click", { ...point(40), cancelable: true }),
    );
    // 検証
    expect(moved).not.toBe(before);
    expect(dragged.defaultPrevented).toBe(true);
    expect(prevented).toEqual([false]);
    expect(link.getAttribute("href")).toBe("https://example.com/spec");
  } finally {
    document.removeEventListener("click", check);
  }
});

// リンク先を持たないノードは、ノードを覆う押せる要素でキー操作を受ける（正常系）
test("test_attach_map_flow_when_node_hit_keys", async () => {
  // 準備
  const root = await setUp();
  const node = () =>
    root.querySelector<HTMLElement>('[data-node="data"]') as HTMLElement;
  const hit = () =>
    node().querySelector<HTMLElement>(
      ":scope > .mdmark-diagram-node-hit",
    ) as HTMLElement;
  const left = () => Number.parseFloat(node().style.left);
  const before = left();
  // 実行: 押せる要素にフォーカスして Enter、続けて Alt + →
  hit().focus();
  hit().dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  const selected = node().hasAttribute("data-selected");
  const label = hit().getAttribute("aria-label");
  hit().dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      altKey: true,
      bubbles: true,
    }),
  );
  // 検証
  expect(selected).toBe(true);
  expect(label?.endsWith("（選択中）")).toBe(true);
  expect(left()).toBe(before + 8);
  expect(document.activeElement).toBe(hit());
  // 説明のマーカーは押せる要素とは別の要素で、フォーカスするとツールチップが開く
  const info = node().querySelector<HTMLButtonElement>(
    "button.mdmark-diagram-info",
  ) as HTMLButtonElement;
  expect(hit().contains(info)).toBe(false);
  info.focus();
  const tip = root.querySelector<HTMLElement>(
    `#${CSS.escape(info.getAttribute("aria-describedby") ?? "")}`,
  );
  expect(tip?.hidden).toBe(false);
});

// 並べた線が矩形に入るときは間を広げて配置し直す（正常系）
test("test_attach_map_flow_when_crowded", async () => {
  // 準備
  const layout = await loadLayout();
  const layoutMap = vi.mocked(layout.layoutMap);
  const separateWires = vi.mocked(
    (
      layout as unknown as {
        separateWires: (value: { wires: Array<{ id: string }> }) => unknown;
      }
    ).separateWires,
  );
  layoutMap.mockClear();
  separateWires.mockClear();
  const marked: Array<[number, number]> = [
    [3, 3],
    [3, 7],
  ];
  separateWires
    .mockImplementationOnce((value) => ({ wires: value.wires, crowded: 16 }))
    .mockImplementationOnce((value) => ({
      wires: value.wires.map((wire, index) =>
        index === 0 ? { ...wire, points: marked } : wire,
      ),
      crowded: 0,
    }));
  // 実行
  const root = await setUp();
  // 検証
  expect(layoutMap.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(
    (layoutMap.mock.calls[1]?.[2] as { spread?: number } | undefined)?.spread,
  ).toBe(16);
  const first = (
    layoutMap.mock.results[1]?.value as {
      wires: Array<{ id: string }>;
    }
  )?.wires[0]?.id;
  const hit = root.querySelector(
    `.map-wire-hit[data-wire="${CSS.escape(first ?? "")}"]`,
  );
  expect(hit?.getAttribute("d")).toBe("M3 3L3 7");
});

// 閉じたグループの中身を測る（正常系）
test("test_attach_map_flow_when_closed_group_measured", async () => {
  // 準備（store を閉じた状態を保ち、閉じたグループの中身を 10px あふれさせる）
  const layout = await loadLayout();
  const layoutMap = vi.mocked(layout.layoutMap);
  layoutMap.mockClear();
  sessionStorage.setItem(
    `mdmark-map:${location.pathname}#1`,
    JSON.stringify({ collapsed: ["store"] }),
  );
  const original = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight",
  ) as PropertyDescriptor;
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(
    function (this: Element) {
      const height = original.get?.call(this) as number;
      return this.classList.contains("map-closed-group")
        ? (this as HTMLElement).clientHeight + 10
        : height;
    },
  );
  // 実行
  await setUp();
  // 検証
  const firstStore = (
    layoutMap.mock.results[0]?.value as
      | { groups: Array<{ id: string; h: number }> }
      | undefined
  )?.groups.find((group) => group.id === "store");
  const second = layoutMap.mock.calls[1]?.[2] as
    | { overrides: Record<string, { size?: { h: number } }> }
    | undefined;
  expect(firstStore).toBeDefined();
  expect(second?.overrides.store?.size?.h).toBe((firstStore?.h ?? 0) + 10);
});
