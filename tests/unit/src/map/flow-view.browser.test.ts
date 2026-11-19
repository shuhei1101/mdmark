import { afterEach, expect, onTestFinished, test, vi } from "vitest";
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
  // 実行
  root.querySelectorAll<HTMLElement>(".map-band-seg")[2]?.click();
  // 検証
  expect(root.querySelector(".map-group-title.is-current")?.textContent).toBe(
    "配置",
  );
  // 実行・検証: 左の矢印のボタンで手順 2 に移ると、案内を始めた全体の図に戻る
  root
    .querySelector<HTMLButtonElement>('button[data-band="step"][data-dir="-1"]')
    ?.click();
  expect(
    root.querySelector('[role="slider"]')?.getAttribute("aria-valuenow"),
  ).toBe("2");
  expect(root.querySelector(".map-group-title.is-current")).toBeNull();
});

// 外から図を移す（正常系）
test("test_attach_map_flow_when_follow", async () => {
  // 準備
  const root = await setUp();
  const { zoomControlOf } = await import(
    "../../../../src/shared/zoom.interact.ts"
  );
  const handle = handles.at(-1) as unknown as {
    follow: (nodes: string[]) => void;
    resumeFollow: () => void;
  };
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const zoom = zoomControlOf(viewport);
  if (!zoom) {
    throw new Error("拡大・縮小が付いていない");
  }
  const focusRect = vi.spyOn(zoom, "focusRect").mockImplementation(() => {});
  // 実行
  handle.follow(["mount", "marker"]);
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  handle.follow(["mount", "marker"]);
  handle.resumeFollow();
  handle.follow(["mount", "marker"]);
  // 検証
  expect(focusRect).toHaveBeenCalledTimes(2);
});

// 指の押下ではノードを動かさず、受け取りを残さない（正常系）
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
  // 実行: 指で押して下へ 40px・80px 動かして離す
  node.dispatchEvent(new PointerEvent("pointerdown", point(0)));
  window.dispatchEvent(new PointerEvent("pointermove", point(40)));
  const afterMove = root.querySelector<HTMLElement>('[data-node="mount"]')
    ?.style.cssText;
  window.dispatchEvent(new PointerEvent("pointermove", point(80)));
  window.dispatchEvent(new PointerEvent("pointerup", point(80)));
  // 検証
  expect(saved().positions?.mount).toBeUndefined();
  expect(afterMove).toBe(before);
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
  const original = separateWires.getMockImplementation();
  // 2 回目以降（広げて配置し直した後と、描いた後に測り直したとき）は印の点の線を返す
  separateWires
    .mockImplementation((value) => ({
      wires: value.wires.map((wire, index) =>
        index === 0 ? { ...wire, points: marked } : wire,
      ),
      crowded: 0,
    }))
    .mockImplementationOnce((value) => ({ wires: value.wires, crowded: 16 }));
  onTestFinished(() => {
    if (original) separateWires.mockImplementation(original);
  });
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

/** 絶対配置でない子要素 */
const inFlowChildren = (element: Element): Element[] =>
  [...element.children].filter((child) => {
    const style = getComputedStyle(child);
    return (
      !["absolute", "fixed"].includes(style.position) &&
      style.display !== "none"
    );
  });

/**
 * 選んだノードの中身の上端と下端を、上下の枠線と余白を除いた内側の上端・下端から、指定した量だけ外へずらした位置に描かれたことにする。
 * 最初の子要素のマージンの上端が内側の上端より `above` 上、最後の子要素のマージンの下端が内側の下端より `below` 下になる
 */
const placeContent = (
  selector: string,
  { above, below }: { above: number; below: number },
) => {
  const original = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const rect = original.call(this);
      const node = this.parentElement;
      if (!node?.matches(selector)) return rect;
      const children = inFlowChildren(node);
      const first = children[0] === this;
      const last = children.at(-1) === this;
      if (!first && !last) return rect;
      const box = original.call(node);
      const nodeStyle = getComputedStyle(node);
      const style = getComputedStyle(this);
      const innerTop =
        box.top +
        Number.parseFloat(nodeStyle.borderTopWidth) +
        Number.parseFloat(nodeStyle.paddingTop);
      const innerBottom =
        box.bottom -
        Number.parseFloat(nodeStyle.borderBottomWidth) -
        Number.parseFloat(nodeStyle.paddingBottom);
      // 動かさない側の端は、動かした端を越えない位置に配置する（CSS を読み込まない環境では、子要素がノードの矩形の外に描かれることがある）
      const placedTop = innerTop - above + Number.parseFloat(style.marginTop);
      const placedBottom =
        innerBottom + below - Number.parseFloat(style.marginBottom);
      const top = first ? placedTop : Math.min(rect.top, placedBottom);
      const bottom = last ? placedBottom : Math.max(rect.bottom, placedTop);
      return new DOMRect(rect.left, top, rect.width, bottom - top);
    },
  );
};

type Placed = Array<{ id: string; h: number }>;
type Overrides = Record<string, { size?: { h: number } }>;

/** 1 回目の配置の結果のノードかグループの高さと、2 回目の配置に指定した大きさの上書きの高さ */
const measuredHeights = async (id: string) => {
  const layout = await loadLayout();
  const { results, calls } = vi.mocked(layout.layoutMap).mock;
  const first = (results[0]?.value ?? { nodes: [], groups: [] }) as {
    nodes: Placed;
    groups: Placed;
  };
  const second = (calls[1]?.[2] ?? { overrides: {} }) as {
    overrides: Overrides;
  };
  const placed = [...first.nodes, ...first.groups].find(
    (item) => item.id === id,
  );
  return { before: placed?.h, after: second.overrides[id]?.size?.h };
};

/** 配置の呼び出しの記録を削除する */
const clearLayoutCalls = async () => {
  const layout = await loadLayout();
  vi.mocked(layout.layoutMap).mockClear();
};

// 閉じたグループの中身を測る（正常系）
test("test_attach_map_flow_when_closed_group_measured", async () => {
  // 準備（store を閉じた状態を保ち、閉じたグループの中身が入る高さをノードの高さより 10px 大きくする）
  await clearLayoutCalls();
  sessionStorage.setItem(
    `mdmark-map:${location.pathname}#1`,
    JSON.stringify({ collapsed: ["store"] }),
  );
  placeContent('.map-closed-group[data-group="store"]', {
    above: 0,
    below: 10,
  });
  // 実行
  await setUp();
  // 検証
  const { before, after } = await measuredHeights("store");
  expect(before).toBeDefined();
  expect(after).toBe((before ?? 0) + 10);
});

// 中身が下の余白にかかるノードを高くする（正常系）
test("test_attach_map_flow_when_content_in_bottom_padding", async () => {
  // 準備（mount の名前の下端を下の余白へ 6px 食い込ませ、scrollHeight はあふれていない値にする）
  await clearLayoutCalls();
  placeContent('[data-node="mount"]', { above: 0, below: 6 });
  const original = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight",
  ) as PropertyDescriptor;
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(
    function (this: Element) {
      return this.matches('[data-node="mount"]')
        ? (this as HTMLElement).clientHeight
        : (original.get?.call(this) as number);
    },
  );
  // 実行
  await setUp();
  // 検証
  const { before, after } = await measuredHeights("mount");
  expect(before).toBeDefined();
  expect(after).toBe((before ?? 0) + 6);
});

// 中身が下の余白より上にあるノードは高くしない（正常系）
test("test_attach_map_flow_when_content_above_bottom_padding", async () => {
  // 準備（全てのノードの中身の下端を、内側の下端より 2px 上にする）
  await clearLayoutCalls();
  placeContent(".mdmark-diagram-node", { above: 0, below: -2 });
  // 実行
  await setUp();
  // 検証
  const layout = await loadLayout();
  expect(vi.mocked(layout.layoutMap)).toHaveBeenCalledTimes(1);
});

// 中身を上下の中央に配置するノードを 1 回で高くする（正常系）
test("test_attach_map_flow_when_centered_content_overflows", async () => {
  // 準備（user の名前を、内側の上端と下端からそれぞれ 10px はみ出させる）
  await clearLayoutCalls();
  placeContent('[data-node="user"]', { above: 10, below: 10 });
  // 実行
  await setUp();
  // 検証
  const { before, after } = await measuredHeights("user");
  expect(before).toBeDefined();
  expect(after).toBe((before ?? 0) + 20);
});

// 閉じたグループの中のノードを指す手順（正常系）
test("test_attach_map_flow_when_walk_into_closed_group", async () => {
  // 準備（store を閉じた状態を保ち、store の中の index と、そこから出る線を指す手順だけの案内にする）
  sessionStorage.setItem(
    `mdmark-map:${location.pathname}#1`,
    JSON.stringify({ collapsed: ["store"] }),
  );
  const { attachMapFlow } = await loadFlowView();
  const { parseMapArgs } = await loadSpec();
  const { resolveConfig } = await loadConfig();
  const data = JSON.stringify({
    version: 1,
    walkthroughs: [
      {
        title: "索引を読む",
        text: "",
        nodes: ["index", "data"],
        edges: ["index->data"],
      },
    ],
  });
  const root = createRootFromHtml(
    renderDoc(mapRange({ mermaid: FLOW, data })).html,
  );
  const range = root.querySelector<HTMLElement>(".mdmark-map") as HTMLElement;
  handles.push(
    attachMapFlow(range, resolveConfig({ config: { map: CONFIG } }), {
      args: parseMapArgs("").args,
    }),
  );
  // 実行
  root.querySelectorAll<HTMLElement>(".map-band-seg")[0]?.click();
  // 検証
  expect(
    root
      .querySelector('.map-closed-group[data-group="store"]')
      ?.classList.contains("map-dim"),
  ).toBe(false);
  expect(
    root
      .querySelector('.mdmark-diagram-wire[data-wire="store->data"]')
      ?.classList.contains("map-dim"),
  ).toBe(false);
  expect(
    root.querySelectorAll('.map-packet[data-wire="store->data"]').length,
  ).toBeGreaterThan(0);
});

// 隠した種類の行を中身に数えない（正常系）
test("test_attach_map_flow_when_kind_row_hidden", async () => {
  // 準備（描いた文書の CSS と同じく押せる要素を絶対配置にして種類の行を隠し、表示している中身の下端を内側の下端より 2px 上にする）
  await clearLayoutCalls();
  const style = document.createElement("style");
  style.textContent =
    ".mdmark-diagram-node-hit { position: absolute; } .mdmark-diagram-node-kind { display: none; }";
  document.head.append(style);
  onTestFinished(() => style.remove());
  placeContent(".mdmark-diagram-node", { above: 0, below: -2 });
  // 実行
  await setUp();
  // 検証
  const layout = await loadLayout();
  expect(vi.mocked(layout.layoutMap)).toHaveBeenCalledTimes(1);
});
