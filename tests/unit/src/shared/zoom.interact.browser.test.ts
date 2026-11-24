import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 拡大・縮小・移動の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadZoom = () => import("../../../../src/shared/zoom.interact.ts");

const detachers: Array<() => void> = [];

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 図のパネルと同じ並びの、拡大と縮小のボタン（`data-tool` で見分ける） */
const TOOLS_HTML = [
  '<div class="tools">',
  '<div data-group="zoom">',
  '<button type="button" data-tool="out" aria-label="縮小"></button>',
  '<button type="button" data-tool="fit" aria-label="倍率 100%。全体が収まる倍率に戻す">100%</button>',
  '<button type="button" data-tool="in" aria-label="拡大"></button>',
  "</div>",
  "</div>",
].join("");

/** 幅 600px・高さ 400px の表示する枠に、幅 1100・高さ 300 の中身を配置し、拡大・縮小・移動を付ける */
async function setUp(
  onChange?: (zoom: number, fit: number) => void,
  percentBase?: "fit" | "content",
) {
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    ...(onChange ? { onChange } : {}),
    ...(percentBase ? { percentBase } : {}),
  });
  detachers.push(() => zoom.detach());
  return { root, tools, viewport, zoom };
}

/** スクリーンリーダー向けの名前でボタンを探す */
function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) {
    throw new Error(`ボタンが無い: ${name}`);
  }
  return found;
}

/** 倍率のボタンの文字 */
function zoomText(root: ParentNode): string {
  return root.querySelector('[data-tool="fit"]')?.textContent ?? "";
}

// 収まる倍率で始め、拡大・縮小と戻す（正常系）
test("test_attach_zoom", async () => {
  // 準備
  const onChange = vi.fn();
  const { root, viewport } = await setUp(onChange);
  // 検証: 収まる倍率で始める
  expect(zoomText(root)).toBe("55%");
  expect(button(root, "縮小").disabled).toBe(false);
  // 実行
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe("68%");
  // 実行
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(zoomText(root)).toBe("55%");
  const zooms = onChange.mock.calls.map(([zoom]) => Math.round(zoom * 100));
  expect(zooms).toEqual(expect.arrayContaining([68, 55]));
});

// 全体が収まる倍率を 100% として出す（正常系）
test("test_attach_zoom_when_percent_base_fit", async () => {
  // 準備
  const { root } = await setUp(undefined, "fit");
  // 検証: 収まる倍率を 100% で始める
  expect(zoomText(root)).toBe("100%");
  // 実行
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe("125%");
  expect(
    root.querySelector('[data-tool="fit"]')?.getAttribute("aria-label"),
  ).toBe("倍率 125%。全体が収まる倍率に戻す");
});

// 拡大中は矢印キーとドラッグで動かす（正常系）
test("test_attach_zoom_when_panned", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { root, viewport } = await setUp();
  button(root, "拡大").click();
  button(root, "拡大").click();
  const before = viewport.scrollLeft;
  // 実行: 矢印キー
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(viewport.scrollLeft - before).toBe(80);
  // 実行: 左へ 40px ドラッグ
  const afterKey = viewport.scrollLeft;
  const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
  viewport.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 300 }),
  );
  viewport.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientX: 260 }),
  );
  viewport.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientX: 260 }),
  );
  // 検証
  expect(viewport.scrollLeft - afterKey).toBe(40);
});

// 削除すると操作が有効にならない（正常系）
test("test_attach_zoom_when_detached", async () => {
  // 準備
  const { root, zoom } = await setUp();
  const before = zoomText(root);
  // 実行
  zoom.detach();
  button(root, "拡大").click();
  // 検証
  expect(zoomText(root)).toBe(before);
});

/** 中身の中にリンク先を持つノードのリンクを配置し、拡大を 2 回押した状態にする */
async function setUpWithLink() {
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const view = await setUp();
  const link = document.createElement("a");
  link.className = "mdmark-diagram-node-link";
  link.href = "#node-link";
  link.textContent = "ノード";
  view.root.querySelector(".content")?.append(link);
  button(view.root, "拡大").click();
  button(view.root, "拡大").click();
  return { ...view, link };
}

/** リンクの上で押し、横へ dx 動かして離す */
function dragOnLink(link: HTMLElement, dx: number): void {
  const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
  link.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 300 }),
  );
  link.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientX: 300 - dx }),
  );
  link.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientX: 300 - dx }),
  );
}

// リンクの上から動かした後の click を window で止め、次のタスクで受け取りを解除する（正常系）
test("test_attach_zoom_when_dragged_on_link", async () => {
  // 準備
  const { viewport, link } = await setUpWithLink();
  const reached: Event[] = [];
  const count = (event: Event) => reached.push(event);
  document.addEventListener("click", count, true);
  try {
    const before = viewport.scrollLeft;
    // 実行: 動かした後の click
    dragOnLink(link, 40);
    const first = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(first);
    // 検証
    expect(viewport.scrollLeft - before).toBe(40);
    expect(first.defaultPrevented).toBe(true);
    expect(reached).toHaveLength(0);
    // 実行: 動かした後に click が来ないまま、次のタスクで別の click
    dragOnLink(link, 40);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const later = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(later);
    // 検証
    expect(later.defaultPrevented).toBe(false);
    expect(reached).toHaveLength(1);
  } finally {
    document.removeEventListener("click", count, true);
  }
});

// ノードのリンクの上の押下で、ブラウザのリンクのドラッグを始めない（正常系）
test("test_attach_zoom_when_link_dragstart", async () => {
  // 準備
  const { link } = await setUpWithLink();
  const event = new DragEvent("dragstart", { bubbles: true, cancelable: true });
  // 実行
  link.dispatchEvent(event);
  // 検証
  expect(event.defaultPrevented).toBe(true);
});

// しきい値以下の動きはドラッグにしない（正常系）
test("test_attach_zoom_when_link_pressed", async () => {
  // 準備
  const { viewport, link } = await setUpWithLink();
  const before = viewport.scrollLeft;
  // 実行
  dragOnLink(link, 3);
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(click);
  // 検証
  expect(click.defaultPrevented).toBe(false);
  expect(viewport.scrollLeft).toBe(before);
});

// しきい値までのドラッグでは動かさず、超えたら動かして onPanStart を呼ぶ（正常系）
test("test_attach_zoom_when_drag_threshold", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  let panStarts = 0;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    onPanStart: () => {
      panStarts += 1;
    },
  });
  detachers.push(() => zoom.detach());
  button(root, "拡大").click();
  button(root, "拡大").click();
  viewport.scrollLeft = 200;
  const before = viewport.scrollLeft;
  const point = { bubbles: true, pointerId: 1, button: 0, clientY: 100 };
  // 実行: 2px だけ動かして離す
  content.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 300 }),
  );
  content.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientX: 298 }),
  );
  content.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientX: 298 }),
  );
  // 検証
  expect(viewport.scrollLeft).toBe(before);
  expect(panStarts).toBe(0);
  // 実行: 40px 左へ動かして離す
  content.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientX: 300 }),
  );
  content.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientX: 260 }),
  );
  content.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientX: 260 }),
  );
  // 検証
  expect(viewport.scrollLeft).toBeGreaterThan(before);
  expect(panStarts).toBe(1);
});

// fitHeight の関数が true を返却するようになった後の refit() で、倍率を保ち下限を高さでもう一度求める（正常系）
test("test_attach_zoom_when_refit", async () => {
  // 準備
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 500px; height: 1600px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  let useHeight = false;
  const zooms: number[] = [];
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 500, height: 1600 },
    tools,
    fitHeight: () => useHeight,
    onChange: (value) => {
      zooms.push(value);
    },
  });
  detachers.push(() => zoom.detach());
  const fitBefore = zoom.fit();
  const atFitBefore = viewport.hasAttribute("data-at-fit");
  // 実行
  useHeight = true;
  zoom.refit();
  // 検証
  expect(fitBefore).toBe(1);
  expect(atFitBefore).toBe(false);
  expect(zoom.fit()).toBeCloseTo(viewport.clientHeight / 1600, 5);
  expect(zooms.at(-1) ?? 1).toBe(1);
  expect(viewport.hasAttribute("data-at-fit")).toBe(false);
});

/** 幅 600px・高さ 400px の表示する枠に、幅 1200・高さ 800 の中身を配置して拡大・縮小を付ける */
async function setUpFocus(
  extra: { fitMin?: number; percentBase?: "fit" | "content" } = {},
) {
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1200px; height: 800px"></div></div></div>`,
  );
  const tools = root.querySelector(".tools") as HTMLElement;
  const viewport = root.querySelector(".viewport") as HTMLElement;
  const content = root.querySelector(".content") as HTMLElement;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1200, height: 800 },
    tools,
    ...extra,
  });
  detachers.push(() => zoom.detach());
  const scale = () =>
    Number(/scale\(([^)]+)\)/.exec(content.style.transform)?.[1] ?? "1");
  return { root, viewport, zoom, scale };
}

// 矩形が収まる倍率と位置へ移す（正常系）
test("test_attach_zoom_when_focus_rect", async () => {
  // 準備
  const { viewport, zoom, scale } = await setUpFocus();
  // 実行
  zoom.focusRect(
    { x: 500, y: 300, width: 200, height: 100 },
    { margin: 32, duration: 0 },
  );
  // 検証
  expect(scale()).toBeCloseTo(2.5, 2);
  expect(viewport.scrollLeft + 300).toBeCloseTo(600 * 2.5, -1);
  expect(viewport.scrollTop + 200).toBeCloseTo(350 * 2.5, -1);
});

// 収まる倍率より小さくしない（正常系）
test("test_attach_zoom_when_focus_rect_wide", async () => {
  // 準備
  const { zoom, scale } = await setUpFocus();
  // 実行
  zoom.focusRect(
    { x: 0, y: 0, width: 1200, height: 800 },
    { margin: 32, duration: 0 },
  );
  // 検証
  expect(scale()).toBeCloseTo(zoom.fit(), 3);
});

// 時間をかけて移し、読者の操作で止める（正常系）
test("test_attach_zoom_when_focus_rect_animated", async () => {
  // 準備
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "Date",
    ],
  });
  const { viewport, zoom, scale } = await setUpFocus();
  const start = scale();
  // 実行
  zoom.focusRect(
    { x: 500, y: 300, width: 200, height: 100 },
    { margin: 32, duration: 300 },
  );
  vi.advanceTimersByTime(150);
  const middle = scale();
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  vi.advanceTimersByTime(300);
  vi.useRealTimers();
  // 検証
  expect(middle).toBeGreaterThan(start);
  expect(middle).toBeLessThan(2.5);
  expect(scale()).not.toBeCloseTo(2.5, 2);
});

// ボタンを持つ要素の中のツールでない要素を押しても止めない（正常系）
test("test_attach_zoom_when_focus_rect_other_click", async () => {
  // 準備
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "performance",
      "Date",
    ],
  });
  const { zoom, scale } = await setUpFocus();
  const tools = document.querySelector(".tools") as HTMLElement;
  const other = document.createElement("span");
  tools.append(other);
  // 実行
  zoom.focusRect(
    { x: 500, y: 300, width: 200, height: 100 },
    { margin: 32, duration: 300 },
  );
  vi.advanceTimersByTime(150);
  other.click();
  vi.advanceTimersByTime(300);
  vi.useRealTimers();
  // 検証
  expect(scale()).toBeCloseTo(2.5, 2);
});

// 表示する枠から操作を引く（正常系）
test("test_zoom_control_of", async () => {
  // 準備
  const { zoomControlOf } = await loadZoom();
  const { viewport, zoom } = await setUpFocus();
  // 実行
  const attached = zoomControlOf(viewport);
  zoom.detach();
  const detached = zoomControlOf(viewport);
  // 検証
  expect(attached).toBe(zoom);
  expect(detached).toBeUndefined();
});

// 全体が収まる倍率の 0.25 倍と 5 倍で止める（正常系）
test("test_attach_zoom_when_bounds", async () => {
  // 準備
  const { root } = await setUp(undefined, "fit");
  // 実行
  for (let i = 0; i < 10; i += 1) {
    button(root, "縮小").click();
  }
  // 検証
  expect(zoomText(root)).toBe("25%");
  expect(button(root, "縮小").disabled).toBe(true);
  // 実行
  for (let i = 0; i < 20; i += 1) {
    button(root, "拡大").click();
  }
  // 検証
  expect(zoomText(root)).toBe("500%");
  expect(button(root, "拡大").disabled).toBe(true);
});

// 全体が収まる倍率以下の間だけ data-at-fit を付ける（正常系）
test("test_attach_zoom_when_at_fit", async () => {
  // 準備
  const { root, viewport } = await setUp();
  const opened = viewport.hasAttribute("data-at-fit");
  // 実行
  button(root, "拡大").click();
  const zoomed = viewport.hasAttribute("data-at-fit");
  viewport.focus();
  await userEvent.keyboard("0");
  button(root, "縮小").click();
  // 検証
  expect(opened).toBe(true);
  expect(zoomed).toBe(false);
  expect(viewport.hasAttribute("data-at-fit")).toBe(true);
});

// 全体が収まる倍率でも、中身が枠に縦に収まらなければ data-at-fit を付けない（正常系）
test("test_attach_zoom_when_tall_at_fit", async () => {
  // 準備: 全体が収まる倍率は幅で決める（高さを --mdmark-diagram-max-height で切った枠）
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 300px; overflow: auto"><div class="sizer"><div class="content" style="width: 600px; height: 1200px"></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools") as HTMLElement;
  const viewport = root.querySelector<HTMLElement>(".viewport") as HTMLElement;
  const content = root.querySelector<HTMLElement>(".content") as HTMLElement;
  // 実行
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 600, height: 1200 },
    tools,
    fitHeight: false,
  });
  detachers.push(() => zoom.detach());
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(viewport.hasAttribute("data-at-fit")).toBe(false);
});

/** 表示する枠の上の点に指を置いた Touch を作る */
function touchAt(
  target: Element,
  finger: { id: number; x: number; y: number },
): Touch {
  return new Touch({
    identifier: finger.id,
    target,
    clientX: finger.x,
    clientY: finger.y,
  });
}

/** 中点 `center` を挟んで横に `gap` だけ離した 2 本の指の touch のイベントを発火し、イベントを返却する */
function pinch(
  target: Element,
  type: "touchstart" | "touchmove",
  fingers: { center: { x: number; y: number }; gap: number },
): TouchEvent {
  const { center, gap } = fingers;
  const touches = [
    touchAt(target, { id: 1, x: center.x - gap / 2, y: center.y }),
    touchAt(target, { id: 2, x: center.x + gap / 2, y: center.y }),
  ];
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches,
    targetTouches: touches,
    changedTouches: touches,
  });
  target.dispatchEvent(event);
  return event;
}

// 2 本の指の間隔の変化で、中点を保って倍率を変える（正常系）
test("test_attach_zoom_when_pinched", async () => {
  // 準備
  const { viewport, zoom, scale } = await setUpFocus();
  const rect = viewport.getBoundingClientRect();
  const center = { x: rect.left + 300, y: rect.top + 200 };
  const start = scale();
  const pointBefore = {
    x: (viewport.scrollLeft + 300) / start,
    y: (viewport.scrollTop + 200) / start,
  };
  // 実行
  pinch(viewport, "touchstart", { center, gap: 100 });
  const move = pinch(viewport, "touchmove", { center, gap: 200 });
  // 検証
  expect(scale()).toBeCloseTo(start * 2, 3);
  expect((viewport.scrollLeft + 300) / scale()).toBeCloseTo(pointBefore.x, 0);
  expect((viewport.scrollTop + 200) / scale()).toBeCloseTo(pointBefore.y, 0);
  expect(move.defaultPrevented).toBe(true);
  // 実行
  pinch(viewport, "touchmove", { center, gap: 1 });
  // 検証
  expect(scale()).toBeCloseTo(zoom.fit() * 0.25, 3);
});

// touchPan が native のとき、指のポインターでは動かさない（正常系）
test("test_attach_zoom_when_native_touch", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"></div></div></div>`,
  );
  const tools = root.querySelector(".tools") as HTMLElement;
  const viewport = root.querySelector(".viewport") as HTMLElement;
  const content = root.querySelector(".content") as HTMLElement;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    touchPan: "native",
  });
  detachers.push(() => zoom.detach());
  button(root, "拡大").click();
  button(root, "拡大").click();
  viewport.scrollLeft = 200;
  /** pointerType の指で 40px 左へ動かす */
  const drag = (pointerType: string) => {
    const point = {
      bubbles: true,
      pointerId: 1,
      button: 0,
      clientY: 100,
      pointerType,
    };
    content.dispatchEvent(
      new PointerEvent("pointerdown", { ...point, clientX: 300 }),
    );
    content.dispatchEvent(
      new PointerEvent("pointermove", { ...point, clientX: 260 }),
    );
    content.dispatchEvent(
      new PointerEvent("pointerup", { ...point, clientX: 260 }),
    );
  };
  // 実行
  drag("touch");
  const afterTouch = viewport.scrollLeft;
  drag("mouse");
  // 検証
  expect(afterTouch).toBe(200);
  expect(viewport.scrollLeft - afterTouch).toBe(40);
});

// 拡大して縦にスクロールできる間だけ、ホイールをスクロールする祖先へ渡す（正常系）
test("test_attach_zoom_when_wheel", async () => {
  // 準備
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `<div class="scroller" style="height: 300px; overflow-y: auto"><div style="height: 2000px">${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 200px; overflow: auto"><div class="sizer"><div class="content" style="width: 600px; height: 200px"></div></div></div></div></div>`,
  );
  const scroller = root.querySelector(".scroller") as HTMLElement;
  const tools = root.querySelector(".tools") as HTMLElement;
  const viewport = root.querySelector(".viewport") as HTMLElement;
  const content = root.querySelector(".content") as HTMLElement;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 600, height: 200 },
    tools,
    wheelToScroller: true,
  });
  detachers.push(() => zoom.detach());
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    viewport.dispatchEvent(event);
    return event;
  };
  // 実行: 開いた直後
  const atFit = wheel({ deltaY: 100 });
  // 実行: 拡大を 2 回押した後
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewportTop = viewport.scrollTop;
  const scrollerTop = scroller.scrollTop;
  const zoomed = wheel({ deltaY: 100 });
  const withCtrl = wheel({ deltaY: 100, ctrlKey: true });
  // 検証
  expect(atFit.defaultPrevented).toBe(false);
  expect(zoomed.defaultPrevented).toBe(true);
  expect(viewport.scrollTop).toBe(viewportTop);
  expect(scroller.scrollTop - scrollerTop).toBe(100);
  expect(withCtrl.defaultPrevented).toBe(false);
});

// 拡大中の Shift＋ホイールは、縦の量のまま届いても表示する枠を横に動かす（正常系）
test("test_attach_zoom_when_shift_wheel", async () => {
  // 準備
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `<div class="scroller" style="height: 300px; overflow-y: auto"><div style="height: 2000px">${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 200px; overflow: auto"><div class="sizer"><div class="content" style="width: 600px; height: 200px"></div></div></div></div></div>`,
  );
  const scroller = root.querySelector(".scroller") as HTMLElement;
  const tools = root.querySelector(".tools") as HTMLElement;
  const viewport = root.querySelector(".viewport") as HTMLElement;
  const content = root.querySelector(".content") as HTMLElement;
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 600, height: 200 },
    tools,
    wheelToScroller: true,
  });
  detachers.push(() => zoom.detach());
  const wheel = (init: WheelEventInit) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    viewport.dispatchEvent(event);
    return event;
  };
  button(root, "拡大").click();
  button(root, "拡大").click();
  viewport.scrollLeft = 0;
  const scrollerTop = scroller.scrollTop;
  // 実行: 縦の量のまま届く Shift＋ホイールと、横の量で届く Shift＋ホイール
  const vertical = wheel({ deltaY: 100, shiftKey: true });
  const afterVertical = viewport.scrollLeft;
  const horizontal = wheel({ deltaX: 50, shiftKey: true });
  // 検証
  expect(vertical.defaultPrevented).toBe(true);
  expect(afterVertical).toBe(100);
  expect(horizontal.defaultPrevented).toBe(true);
  expect(viewport.scrollLeft).toBe(150);
  expect(scroller.scrollTop).toBe(scrollerTop);
});

// 単位ごとに px に直す（正常系）
test("test_wheel_delta", async () => {
  // 準備
  const { wheelDelta } = await loadZoom();
  const page = { width: 600, height: 800 };
  // 実行
  const results = [0, 1, 2].map(
    (deltaMode) =>
      wheelDelta({ event: { deltaX: 0, deltaY: 3, deltaMode }, page }).y,
  );
  // 検証
  expect(results).toEqual([3, 48, 2400]);
});

// 縦にスクロールする最も近い祖先を返却する（正常系）
test("test_scroll_parent_of", async () => {
  // 準備
  const { scrollParentOf } = await loadZoom();
  const root = createRootFromHtml(
    '<div class="scroller" style="height: 100px; overflow-y: auto"><div style="height: 500px"><div class="inner"></div></div></div><div class="outer"></div>',
  );
  const inner = root.querySelector(".inner") as HTMLElement;
  const outer = root.querySelector(".outer") as HTMLElement;
  // 実行・検証
  expect(scrollParentOf(inner)).toBe(root.querySelector(".scroller"));
  expect(scrollParentOf(outer)).toBe(document.scrollingElement);
});

/** 余白 32 で幅 536・高さ 336 の矩形へ移し、倍率を 1 にする */
function zoomToOne(zoom: {
  focusRect: (
    rect: { x: number; y: number; width: number; height: number },
    options: { margin: number; duration: number },
  ) => void;
}): void {
  zoom.focusRect(
    { x: 0, y: 0, width: 536, height: 336 },
    { margin: 32, duration: 0 },
  );
}

// 倍率を変えずに矩形を中央へ移す（正常系）
test("test_attach_zoom_when_center_rect", async () => {
  // 準備
  const { viewport, zoom, scale } = await setUpFocus();
  zoomToOne(zoom);
  // 実行
  zoom.centerRect({ x: 550, y: 350, width: 100, height: 100 }, { duration: 0 });
  // 検証
  expect(scale()).toBeCloseTo(1, 3);
  expect(viewport.scrollLeft).toBeCloseTo(600 - viewport.clientWidth / 2, 0);
  expect(viewport.scrollTop).toBeCloseTo(400 - viewport.clientHeight / 2, 0);
});

// 全体が収まる倍率で矩形が見えていれば移さない（正常系）
test("test_attach_zoom_when_center_rect_at_fit", async () => {
  // 準備
  const { viewport, zoom, scale } = await setUpFocus();
  // 実行
  zoom.centerRect({ x: 900, y: 600, width: 100, height: 100 }, { duration: 0 });
  // 検証
  expect(scale()).toBeCloseTo(0.5, 3);
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
});

// 全体が収まらない下限の倍率では、見えていない矩形だけを中央へ移す（正常系）
test("test_attach_zoom_when_center_rect_at_fit_hidden", async () => {
  // 準備
  const { viewport, zoom, scale } = await setUpFocus({ fitMin: 1 });
  // 実行
  zoom.centerRect({ x: 100, y: 100, width: 100, height: 100 }, { duration: 0 });
  const first = { left: viewport.scrollLeft, top: viewport.scrollTop };
  zoom.centerRect({ x: 900, y: 600, width: 100, height: 100 }, { duration: 0 });
  // 検証
  expect(first).toEqual({ left: 0, top: 0 });
  expect(scale()).toBeCloseTo(1, 3);
  expect(viewport.scrollLeft).toBeCloseTo(1200 - viewport.clientWidth, 0);
  expect(viewport.scrollTop).toBeCloseTo(800 - viewport.clientHeight, 0);
});

// 中身の大きさを差し替えても倍率の文字を保つ（正常系）
test("test_attach_zoom_when_resize", async () => {
  // 準備
  const { root, zoom, scale } = await setUpFocus({ percentBase: "fit" });
  zoomToOne(zoom);
  // 実行
  zoom.resize({ width: 600, height: 400 });
  // 検証
  expect(zoom.fit()).toBeCloseTo(1, 1);
  expect(scale() / zoom.fit()).toBeCloseTo(2, 3);
  expect(zoomText(root)).toBe("200%");
});

// 全体が収まる倍率では新しい中身の全体が収まる倍率にする（正常系）
test("test_attach_zoom_when_resize_at_fit", async () => {
  // 準備
  const { root, viewport, zoom, scale } = await setUpFocus({
    percentBase: "fit",
  });
  // 実行
  zoom.resize({ width: 2400, height: 800 });
  // 検証
  expect(scale()).toBeCloseTo(0.25, 3);
  expect(zoomText(root)).toBe("100%");
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
});

// 部品が受け持つ要素の上では動かさない（正常系）
test("test_attach_zoom_when_drag_owner", async () => {
  // 準備: dragOwner を付け、中身に部品が受け持つ要素とその中のノードのリンクを配置して 2 回拡大する
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachZoom } = await loadZoom();
  const root = createRootFromHtml(
    `${TOOLS_HTML}<div class="viewport" tabindex="0" style="width: 600px; height: 400px; overflow: auto"><div class="sizer"><div class="content" style="width: 1100px; height: 300px"><div class="owned" data-drag-owner style="width: 200px; height: 100px"></div><div data-drag-owner><a class="mdmark-diagram-node-link" href="#owned-link">ノード</a></div></div></div></div>`,
  );
  const tools = root.querySelector<HTMLElement>(".tools");
  const viewport = root.querySelector<HTMLElement>(".viewport");
  const content = root.querySelector<HTMLElement>(".content");
  if (!tools || !viewport || !content) {
    throw new Error("枠が無い");
  }
  const onPanStart = vi.fn();
  const zoom = attachZoom({
    viewport,
    content,
    size: { width: 1100, height: 300 },
    tools,
    onPanStart,
    dragOwner: "[data-drag-owner]",
  });
  detachers.push(() => zoom.detach());
  button(root, "拡大").click();
  button(root, "拡大").click();
  const before = viewport.scrollLeft;
  const dragOn = (target: Element) => {
    const point = {
      bubbles: true,
      pointerId: 1,
      button: 0,
      clientY: 50,
      pointerType: "mouse",
    };
    target.dispatchEvent(
      new PointerEvent("pointerdown", { ...point, clientX: 300 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointermove", { ...point, clientX: 260 }),
    );
    target.dispatchEvent(
      new PointerEvent("pointerup", { ...point, clientX: 260 }),
    );
  };
  // 実行
  dragOn(root.querySelector(".owned") as Element);
  dragOn(root.querySelector(".mdmark-diagram-node-link") as Element);
  // 検証
  expect(viewport.scrollLeft).toBe(before);
  expect(onPanStart).not.toHaveBeenCalled();
});

// 全体が収まる倍率に対する比を読み、その比の倍率にする（正常系）
test("test_attach_zoom_when_ratio", async () => {
  // 準備
  const first = await setUp(undefined, "fit");
  button(first.root, "拡大").click();
  button(first.root, "拡大").click();
  const second = await setUp(undefined, "fit");
  // 実行
  const ratio = first.zoom.ratio();
  second.zoom.setRatio(ratio);
  const restored = zoomText(second.root);
  second.zoom.setRatio(100);
  // 検証
  expect(ratio).toBeCloseTo(1.5625);
  expect(restored).toBe("156%");
  expect(zoomText(second.root)).toBe("500%");
});
