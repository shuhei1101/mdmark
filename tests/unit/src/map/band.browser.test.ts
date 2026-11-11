import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 案内と再生の帯を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBand = () => import("../../../../src/map/band.ts");

afterEach(() => {
  removeRoots();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const STEPS = [0, 1, 2, 3].map((index) => ({
  title: `手順 ${index + 1}`,
  text: "",
  nodes: [`n${index}`],
  wires: [],
  enter: undefined,
}));

/** 図の枠を配置して帯を付ける */
async function setUp(
  options: {
    autoplay?: boolean;
    reducedMotion?: boolean;
    follow?: { start: () => void; step: (step: unknown) => void };
  } = {},
) {
  const { attachBand } = await loadBand();
  const root = createRootFromHtml(
    '<figure class="mdmark-diagram"><div class="mdmark-diagram-box"><div class="mdmark-diagram-viewport" style="height: 200px; overflow: auto"><div style="width: 2000px; height: 2000px"></div></div></div></figure>',
  );
  const figure = root.querySelector("figure") as HTMLElement;
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});
  const applied: Array<number | undefined> = [];
  let enter: (() => void) | undefined;
  const handle = attachBand({
    figure,
    mode: "walkthrough",
    steps: STEPS,
    interval: 3,
    autoplay: options.autoplay ?? false,
    reducedMotion: options.reducedMotion ?? false,
    apply: (step) =>
      applied.push(
        step === undefined
          ? undefined
          : STEPS.indexOf(step as (typeof STEPS)[number]),
      ),
    observe: (_target, onEnter) => {
      enter = onEnter;
      return () => {};
    },
    ...(options.follow === undefined ? {} : { follow: options.follow }),
  });
  const button = (label: string) =>
    root.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`,
    ) as HTMLButtonElement;
  return {
    root,
    handle,
    applied,
    scrollTo,
    viewport,
    button,
    enter: () => enter?.(),
  };
}

// 次へ（正常系）
test("test_attach_band_when_next", async () => {
  // 準備
  const { applied, button } = await setUp();
  // 実行
  for (let i = 0; i < 5; i += 1) button("次の手順").click();
  // 検証
  expect(applied).toEqual([0, 1, 2, 3, 0]);
});

// 手順の差し替え（正常系）
test("test_attach_band_when_update", async () => {
  // 準備
  const { root, handle, applied, button } = await setUp();
  button("次の手順").click();
  button("次の手順").click();
  // 実行
  handle.update(STEPS.slice(0, 2));
  // 検証
  expect(root.querySelector(".map-band-count")?.textContent).toBe("–/2");
  expect(applied).toEqual([0, 1]);
});

// 自動で進める（正常系）
test("test_attach_band_when_auto", async () => {
  // 準備
  vi.useFakeTimers();
  const { applied, button, scrollTo } = await setUp();
  // 実行
  button("自動で進める").click();
  vi.advanceTimersByTime(6000);
  // 検証
  expect(applied.slice(0, 2)).toEqual([0, 1]);
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

// 読者が触る（正常系）
test("test_attach_band_when_user_scrolls", async () => {
  // 準備
  vi.useFakeTimers();
  const { button, scrollTo, viewport } = await setUp();
  button("自動で進める").click();
  // 実行
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  scrollTo.mockClear();
  vi.advanceTimersByTime(6000);
  // 検証
  expect(scrollTo).not.toHaveBeenCalled();
});

// 自動で進める間の follow（正常系）
test("test_attach_band_when_follow", async () => {
  // 準備
  vi.useFakeTimers();
  const start = vi.fn();
  const followed: number[] = [];
  const { button } = await setUp({
    follow: {
      start,
      step: (step) =>
        followed.push(STEPS.indexOf(step as (typeof STEPS)[number])),
    },
  });
  // 実行
  button("自動で進める").click();
  vi.advanceTimersByTime(6000);
  button("一時停止").click();
  button("次の手順").click();
  // 検証
  expect(start).toHaveBeenCalledTimes(1);
  expect(followed).toEqual([1, 2]);
});

// 読者が触る（正常系）
test("test_create_follow_when_touched", async () => {
  // 準備
  const { createFollow } = await loadBand();
  const root = createRootFromHtml(
    '<figure class="mdmark-diagram"><div class="mdmark-diagram-box"><div class="mdmark-diagram-viewport" style="height: 200px; overflow: auto"><div style="width: 2000px; height: 2000px"><div data-node="n1" style="margin-left: 1500px; width: 40px; height: 40px"></div></div></div></div></figure>',
  );
  const figure = root.querySelector("figure") as HTMLElement;
  const viewport = root.querySelector(
    ".mdmark-diagram-viewport",
  ) as HTMLElement;
  const scrollTo = vi.spyOn(viewport, "scrollTo").mockImplementation(() => {});
  const follow = createFollow(figure, false);
  // 実行
  follow.reveal(["n1"]);
  viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
  follow.reveal(["n1"]);
  follow.resume();
  follow.reveal(["n1"]);
  follow.destroy();
  // 検証
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

// 画面に入ったら始める（正常系）
test("test_attach_band_when_autoplay", async () => {
  // 準備
  vi.useFakeTimers();
  const { applied, enter, button } = await setUp({ autoplay: true });
  expect(applied).toEqual([]);
  // 実行
  enter();
  // 検証
  expect(applied[0]).toBe(0);
  expect(button("一時停止").getAttribute("aria-pressed")).toBe("true");
});

// 動きを減らす設定（正常系）
test("test_attach_band_when_autoplay_reduced", async () => {
  // 準備
  const { applied, enter, root } = await setUp({
    autoplay: true,
    reducedMotion: true,
  });
  // 実行
  enter();
  // 検証
  expect(applied).toEqual([]);
  expect(root.querySelector(".map-band-count")?.textContent).toBe("–/4");
});

// 矢印キーで続けて進める（正常系）
test("test_attach_band_when_keys_kept_focus", async () => {
  // 準備
  const { root, applied, button } = await setUp();
  button("次の手順").focus();
  // 実行
  for (let i = 0; i < 2; i += 1)
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  // 検証
  expect(applied).toEqual([0, 1]);
  expect(root.querySelector(".map-band-count")?.textContent).toBe("2/4");
  expect(document.activeElement).toBe(button("次の手順"));
});
