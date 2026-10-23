import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { addStyles } from "../../helpers/dom.ts";

/** ミニマップを付ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMinimap = () => import("../../../../src/diff/minimap.ts");

// 1 行の高さ（px）。画面に収まらない長さにするために使う
const LINE_HEIGHT = 30;

const elements: HTMLElement[] = [];
const detaches: (() => void)[] = [];
const originalMatchMedia = window.matchMedia;

/** 差分の行の並びを作り、`kinds` の位置の行を削除した行・追加した行にする */
function createLines(
  count: number,
  kinds: Record<number, "del" | "add">,
): HTMLElement {
  const lines = document.createElement("div");
  lines.className = "mdmark-diff-lines";
  for (let index = 0; index < count; index += 1) {
    const line = document.createElement("div");
    line.className = "mdmark-diff-line";
    line.dataset.kind = kinds[index] ?? "same";
    line.style.height = `${LINE_HEIGHT}px`;
    line.textContent = `行 ${index}`;
    lines.append(line);
  }
  return lines;
}

/** 要素をページの末尾に置く */
function place<T extends HTMLElement>(element: T, parent?: HTMLElement): T {
  (parent ?? document.body).append(element);
  elements.push(element);
  return element;
}

/** ミニマップを付け、後始末のために外す関数を控える */
async function attachTracked(lines: HTMLElement): Promise<() => void> {
  const { attachMinimap } = await loadMinimap();
  const detach = attachMinimap(lines);
  detaches.push(detach);
  return detach;
}

/** `document.body` の直下にある帯を返す */
function findBands(): HTMLElement[] {
  return [
    ...document.body.querySelectorAll<HTMLElement>(
      ":scope > .mdmark-diff-minimap",
    ),
  ];
}

/** 帯の印を種類ごとに数える */
function countMarks(band: HTMLElement, kind: "del" | "add"): number {
  return band.querySelectorAll(`.mdmark-diff-minimap-mark[data-kind="${kind}"]`)
    .length;
}

/** 帯の上の位置（上端からの割合）でポインターを押したことにする */
function pressBand(band: HTMLElement, ratio: number): void {
  // 合成したイベントには押されているポインターが無いため、捕まえる操作は偽物に替える
  band.setPointerCapture = vi.fn();
  band.hasPointerCapture = vi.fn(() => true);
  const rect = band.getBoundingClientRect();
  band.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height * ratio,
    }),
  );
}

beforeEach(() => {
  // 帯の `position: fixed` と幅は mdmark の CSS で決まる
  addStyles();
});

afterEach(() => {
  window.scrollTo(0, 0);
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
  for (const detach of detaches.splice(0)) {
    detach();
  }
  for (const element of elements.splice(0)) {
    element.remove();
  }
  for (const band of findBands()) {
    band.remove();
  }
});

// 画面の右端に帯を置き、削除した行と追加した行の印を並べる（正常系）
test("test_attach_minimap", async () => {
  // 準備
  const lines = place(createLines(200, { 10: "del", 150: "add" }));
  // 実行
  await attachTracked(lines);
  // 検証
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
    const [band] = findBands();
    expect(band && countMarks(band, "del")).toBe(1);
    expect(band && countMarks(band, "add")).toBe(1);
  });
  const [band] = findBands();
  expect(band?.getAttribute("aria-hidden")).toBe("true");
  expect(getComputedStyle(band as HTMLElement).position).toBe("fixed");
});

// 帯を押すとその位置へ送る（正常系）
test("test_attach_minimap_when_pressed", async () => {
  // 準備
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const lines = place(createLines(200, { 10: "del", 150: "add" }));
  await attachTracked(lines);
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
  });
  const [band] = findBands();
  // 実行
  pressBand(band as HTMLElement, 0.8);
  // 検証
  expect(scrollTo).toHaveBeenCalled();
  const options = scrollTo.mock.calls.at(-1)?.[0] as ScrollToOptions;
  const total = document.documentElement.scrollHeight;
  expect(options.top).toBeGreaterThan(total / 2);
  expect(options.top).toBeLessThan(total);
});

// 同じ送り先の 2 つの差分で帯を 1 本にまとめる（正常系）
test("test_attach_minimap_when_two_diffs", async () => {
  // 準備
  const first = place(createLines(100, { 10: "del" }));
  const second = place(createLines(100, { 30: "add" }));
  // 実行
  const detachFirst = await attachTracked(first);
  const detachSecond = await attachTracked(second);
  // 検証
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
    const [band] = findBands();
    expect(band && countMarks(band, "del")).toBe(1);
    expect(band && countMarks(band, "add")).toBe(1);
  });
  detachFirst();
  await vi.waitFor(() => {
    const [band] = findBands();
    expect(findBands()).toHaveLength(1);
    expect(band && countMarks(band, "del")).toBe(0);
    expect(band && countMarks(band, "add")).toBe(1);
  });
  detachSecond();
  expect(findBands()).toHaveLength(0);
});

// スクロールする枠の中の差分は、枠の右端に置き枠を送る（正常系）
test("test_attach_minimap_when_scroll_container", async () => {
  // 準備
  const container = place(document.createElement("div"));
  container.style.cssText =
    "height: 300px; width: 240px; overflow-y: auto; margin-left: 40px;";
  const lines = place(createLines(100, { 5: "del", 90: "add" }), container);
  await attachTracked(lines);
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
  });
  const [band] = findBands();
  // 検証: 枠の右端に、枠の高さで置く
  const bandRect = (band as HTMLElement).getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  expect(Math.abs(bandRect.right - containerRect.right)).toBeLessThanOrEqual(1);
  expect(Math.abs(bandRect.height - containerRect.height)).toBeLessThanOrEqual(
    1,
  );
  // 実行: 帯の下寄りを押すと枠が送られる
  expect(container.scrollTop).toBe(0);
  pressBand(band as HTMLElement, 0.9);
  // 検証
  await vi.waitFor(() => {
    expect(container.scrollTop).toBeGreaterThan(0);
  });
});

// 使う側が `.mdmark` に書いた変数の上書きを帯に写し、配色が切り替わると写し直す（正常系）
test("test_attach_minimap_when_theme_overridden", async () => {
  // 準備
  const listeners = new Set<EventListener>();
  const fakeQuery = {
    matches: false,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (type: string, listener: EventListener) => {
      if (type === "change") {
        listeners.add(listener);
      }
    },
    removeEventListener: (type: string, listener: EventListener) => {
      if (type === "change") {
        listeners.delete(listener);
      }
    },
  };
  window.matchMedia = vi.fn(() => fakeQuery as unknown as MediaQueryList);
  const style = place(document.createElement("style"), document.head);
  style.textContent =
    ".mdmark { --mdmark-color-diff-del-sign: #000; --mdmark-diff-minimap-z-index: 50; }";
  const root = place(document.createElement("div"));
  root.className = "mdmark";
  const lines = place(createLines(200, { 10: "del", 150: "add" }), root);
  await attachTracked(lines);
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
  });
  const [band] = findBands();
  const read = (name: string) =>
    (band as HTMLElement).style.getPropertyValue(name).trim();
  // 検証: 上書きした値が帯に写っている
  await vi.waitFor(() => {
    expect(read("--mdmark-color-diff-del-sign")).toBe("#000");
  });
  expect(read("--mdmark-diff-minimap-z-index")).toBe("50");
  // 実行: 上書きを変えて、配色の切り替えを送る
  style.textContent =
    ".mdmark { --mdmark-color-diff-del-sign: #111; --mdmark-diff-minimap-z-index: 50; }";
  for (const listener of listeners) {
    listener(new Event("change"));
  }
  // 検証
  await vi.waitFor(() => {
    expect(read("--mdmark-color-diff-del-sign")).toBe("#111");
  });
});

// 祖先の class で配色が切り替わると帯に写し直す（正常系）
test("test_attach_minimap_when_class_changed", async () => {
  // 準備
  document.body.classList.add("vscode-light");
  const root = place(document.createElement("div"));
  root.className = "mdmark";
  const lines = place(createLines(200, { 10: "del", 150: "add" }), root);
  try {
    await attachTracked(lines);
    await vi.waitFor(() => {
      expect(findBands()).toHaveLength(1);
    });
    const [band] = findBands();
    const read = (name: string) =>
      (band as HTMLElement).style.getPropertyValue(name).trim();
    await vi.waitFor(() => {
      expect(read("--mdmark-color-diff-del-sign")).toBe("#d1242f");
    });
    // 実行: body の class を替える
    document.body.classList.replace("vscode-light", "vscode-dark");
    // 検証
    await vi.waitFor(() => {
      expect(read("--mdmark-color-diff-del-sign")).toBe("#f85149");
    });
  } finally {
    document.body.classList.remove("vscode-light", "vscode-dark");
  }
});

// スクロールする枠の外で画面がスクロールすると、帯を枠の右端に置き直す（正常系）
test("test_attach_minimap_when_page_scrolled", async () => {
  // 準備
  const spacer = place(document.createElement("div"));
  spacer.style.height = "600px";
  const container = place(document.createElement("div"));
  container.style.cssText =
    "height: 300px; width: 240px; overflow-y: auto; margin-bottom: 2000px;";
  const lines = place(createLines(100, { 5: "del", 90: "add" }), container);
  await attachTracked(lines);
  await vi.waitFor(() => {
    expect(findBands()).toHaveLength(1);
  });
  const [band] = findBands();
  // 大きさの監視の最初の通知が来て、帯が枠の位置に置かれるのを待つ
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  const before = container.getBoundingClientRect().top;
  expect(
    Math.abs((band as HTMLElement).getBoundingClientRect().top - before),
  ).toBeLessThanOrEqual(1);
  // 実行: 枠の外の画面をスクロールする
  window.scrollTo(0, 300);
  // 検証: 枠の位置が動いても、帯の上端と高さが枠と同じ
  await vi.waitFor(() => {
    const bandRect = (band as HTMLElement).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    expect(containerRect.top).toBeLessThan(before);
    expect(Math.abs(bandRect.top - containerRect.top)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(bandRect.height - containerRect.height),
    ).toBeLessThanOrEqual(1);
  });
});
