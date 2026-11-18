import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 案内と再生の帯を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBand = () => import("../../../../src/map/band.ts");

afterEach(() => {
  removeRoots();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 手順の数だけの帯の手順 */
const stepsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    title: `手順 ${index + 1}`,
    text: "",
    nodes: [`n${index}`],
    wires: [],
    enter: undefined,
  }));

/** 図の枠を配置して帯を付ける */
async function setUp(options: { count?: number; width?: number } = {}) {
  const { attachBand } = await loadBand();
  const steps = stepsOf(options.count ?? 4);
  const root = createRootFromHtml(
    `<figure class="mdmark-diagram" style="width: ${options.width ?? 1280}px"><div class="mdmark-diagram-box"><div class="mdmark-diagram-viewport" style="height: 200px; overflow: auto"><div class="stage" style="width: 2000px; height: 2000px"><div data-node="n0" style="width: 40px; height: 40px"></div></div></div></div></figure>`,
  );
  const figure = root.querySelector("figure") as HTMLElement;
  const stage = root.querySelector(".stage") as HTMLElement;
  const applied: Array<number | undefined> = [];
  const stepped: number[] = [];
  const handle = attachBand({
    figure,
    mode: "walkthrough",
    steps,
    apply: (step) =>
      applied.push(
        step === undefined
          ? undefined
          : steps.indexOf(step as (typeof steps)[number]),
      ),
    onStep: (_step, index) => stepped.push(index),
  });
  const segment = (index: number) =>
    root.querySelectorAll<HTMLElement>(".map-band-seg")[index] as HTMLElement;
  const arrow = (dir: -1 | 1) =>
    root.querySelector<HTMLButtonElement>(
      `button[data-band="step"][data-dir="${dir}"]`,
    ) as HTMLButtonElement;
  const bar = () =>
    root.querySelector<HTMLElement>('[role="slider"]') as HTMLElement;
  const fill = () =>
    Number.parseFloat(
      root.querySelector<HTMLElement>(".map-band-fill")?.style.width ?? "0",
    );
  return {
    root,
    figure,
    stage,
    handle,
    applied,
    stepped,
    segment,
    arrow,
    bar,
    fill,
  };
}

/** 押して離す（離す位置は押した位置から `dx` だけ右） */
function press(target: Element, dx = 0) {
  target.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }),
  );
  target.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      clientX: 10 + dx,
      clientY: 10,
    }),
  );
  (target as HTMLElement).click();
}

/** バーにキーを送る */
function key(target: Element, name: string) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true }),
  );
}

// 区切りで手順へ移る（正常系）
test("test_attach_band_when_segment", async () => {
  // 準備
  const { root, applied, stepped, segment, bar } = await setUp();
  // 実行
  segment(2).click();
  // 検証
  expect(applied).toEqual([2]);
  expect(stepped).toEqual([2]);
  expect(bar().getAttribute("aria-valuenow")).toBe("3");
  expect(root.querySelector(".map-band")?.classList.contains("is-idle")).toBe(
    false,
  );
});

// 手順を繰り返す（正常系）
test("test_attach_band_when_loop", async () => {
  // 準備
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "performance", "Date"],
  });
  const { STEP_MS } = await loadBand();
  const { applied, segment, fill } = await setUp();
  // 実行
  segment(2).click();
  vi.advanceTimersByTime(STEP_MS * 1.5);
  // 検証
  expect(applied).toEqual([2]);
  expect(fill()).toBeCloseTo(50, -1);
});

// 同じ区切りをもう一度押す（正常系）
test("test_attach_band_when_repressed", async () => {
  // 準備
  vi.useFakeTimers({
    toFake: ["requestAnimationFrame", "performance", "Date"],
  });
  const { STEP_MS } = await loadBand();
  const { applied, segment, fill } = await setUp();
  segment(2).click();
  vi.advanceTimersByTime(STEP_MS / 2);
  // 実行
  segment(2).click();
  // 検証
  expect(applied).toEqual([2, 2]);
  expect(fill()).toBe(0);
});

// 左右の矢印のボタン（正常系）
test("test_attach_band_when_arrows", async () => {
  // 準備
  const { applied, arrow } = await setUp();
  // 実行
  arrow(-1).click();
  arrow(1).focus();
  arrow(1).click();
  // 検証
  expect(applied).toEqual([3, 0]);
  expect(document.activeElement).toBe(arrow(1));
});

// バーのキー（正常系）
test("test_attach_band_when_keys", async () => {
  // 準備
  const { applied, bar } = await setUp();
  bar().focus();
  // 実行
  key(bar(), "ArrowRight");
  key(bar(), "ArrowRight");
  key(bar(), "Home");
  key(bar(), "Escape");
  // 検証
  expect(applied).toEqual([0, 1, 0, undefined]);
  expect(document.activeElement).toBe(bar());
});

// バーの外と図の枠の空いた場所で停止する（正常系）
test("test_attach_band_when_stopped_outside", async () => {
  // 準備
  const { root, stage, applied, segment } = await setUp();
  const node = root.querySelector("[data-node]") as HTMLElement;
  const stops = () => applied.filter((value) => value === undefined).length;
  // 実行・検証: 帯のタイトルを押す
  segment(1).click();
  press(root.querySelector(".map-band-title") as HTMLElement);
  expect(stops()).toBe(1);
  // 実行・検証: 図の枠の空いた場所で 2px 動かして離す
  segment(1).click();
  press(stage, 2);
  expect(stops()).toBe(2);
  // 実行・検証: 4px・10px 動かして離す、ノードの上で押して離す
  segment(1).click();
  press(stage, 4);
  press(stage, 10);
  press(node);
  expect(stops()).toBe(2);
});

// 手順の差し替え（正常系）
test("test_attach_band_when_update", async () => {
  // 準備
  const { root, handle, applied, segment, bar } = await setUp();
  segment(1).click();
  // 実行
  handle.update(stepsOf(2));
  // 検証
  expect(root.querySelectorAll(".map-band-seg")).toHaveLength(2);
  expect(bar().getAttribute("aria-valuenow")).toBe("0");
  expect(applied).toEqual([1]);
});

// 細い区切り（正常系）
test("test_attach_band_when_dense", async () => {
  // 準備・実行
  const narrow = await setUp({ count: 40, width: 390 });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const isNarrowDense = narrow.bar().classList.contains("is-dense");
  removeRoots();
  const wide = await setUp({ count: 40, width: 1280 });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // 検証
  expect(isNarrowDense).toBe(true);
  expect(wide.bar().classList.contains("is-dense")).toBe(false);
});

/** 図の枠とノード 2 つを配置して拡大・縮小を付け、矩形へ移す処理を見張る */
async function setUpFollow(reducedMotion: boolean) {
  const { createFollow } = await loadBand();
  const { attachZoom } = await import(
    "../../../../src/shared/zoom.interact.ts"
  );
  const root = createRootFromHtml(
    '<figure class="mdmark-diagram"><div class="mdmark-diagram-box"><div class="mdmark-diagram-viewport" style="height: 200px; overflow: auto"><div class="sizer"><div class="stage" style="position: relative; width: 2000px; height: 2000px"><div data-node="n1" style="position: absolute; left: 100px; top: 50px; width: 40px; height: 40px"></div><div data-node="n2" style="position: absolute; left: 300px; top: 150px; width: 60px; height: 30px"></div></div></div></div></div></figure>',
  );
  const figure = root.querySelector("figure") as HTMLElement;
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const zoom = attachZoom({
    viewport,
    content: root.querySelector(".stage") as HTMLElement,
    size: { width: 2000, height: 2000 },
    tools: figure,
  });
  const focusRect = vi.spyOn(zoom, "focusRect").mockImplementation(() => {});
  const follow = createFollow(figure, reducedMotion);
  return { follow, viewport, focusRect, detach: () => zoom.detach() };
}

// 読者が触る（正常系）
test("test_create_follow_when_touched", async () => {
  // 準備
  const { follow, viewport, focusRect, detach } = await setUpFollow(false);
  // 実行
  follow.reveal(["n1"]);
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  follow.reveal(["n1"]);
  follow.resume();
  follow.reveal(["n1"]);
  follow.destroy();
  detach();
  // 検証
  expect(focusRect).toHaveBeenCalledTimes(2);
});

// 動きを減らす設定（正常系）
test("test_create_follow_when_reduced_motion", async () => {
  // 準備
  const { follow, focusRect, detach } = await setUpFollow(true);
  // 実行
  follow.reveal(["n1", "n2"]);
  detach();
  // 検証
  expect(focusRect).toHaveBeenCalledWith(
    { x: 100, y: 50, width: 260, height: 130 },
    { margin: 32, duration: 0 },
  );
});
