import { afterEach, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { addStyles, createRootFromHtml, removeRoots } from "../../helpers/dom.ts";

/** 向きのメニューを読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読み込む） */
const loadStepMenu = (): Promise<
  typeof import("../../../../src/shared/step-menu.interact.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/shared/step-menu.interact.ts",
      import.meta.url,
    ).href
  );

const closers: Array<() => void> = [];

afterEach(() => {
  for (const close of closers.splice(0)) {
    close();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 開いた元のボタンを配置して返却する */
function setUpOpener(): { root: HTMLElement; opener: HTMLButtonElement } {
  addStyles();
  const root = createRootFromHtml(
    '<button class="opener" type="button" aria-expanded="false">移動</button>',
  );
  const opener = root.querySelector<HTMLButtonElement>("button.opener");
  if (!opener) {
    throw new Error("開いた元のボタンが無い");
  }
  return { root, opener };
}

/** 開いたメニューのボタンを並び順に返却する */
function menuButtons(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(".mdmark-step-menu button"),
  ];
}

/** `enabled` の値の並びから項目を作る */
function itemsOf(enabled: boolean[], run: () => void = () => {}) {
  const labels = ["上へ移す", "下へ移す", "右へ移す"];
  return enabled.map((value, index) => ({
    label: labels[index] ?? `項目 ${index}`,
    icon: "arrow-up" as never,
    enabled: () => value,
    run,
  }));
}

// 開いたら最初の押せる項目へフォーカスし、押せない項目を disabled にする（正常系）
test("test_open_step_menu", async () => {
  // 準備
  const { openStepMenu } = await loadStepMenu();
  const { opener } = setUpOpener();
  // 実行
  const handle = openStepMenu({
    opener,
    label: "移動",
    items: itemsOf([false, true, true]),
  });
  closers.push(() => handle.close({ restoreFocus: false }));
  // 検証
  const menu = document.querySelector<HTMLElement>(".mdmark-step-menu");
  expect(menu?.getAttribute("role")).toBe("group");
  expect(menu?.matches(":popover-open")).toBe(true);
  const buttons = menuButtons();
  expect(buttons[0]?.disabled).toBe(true);
  expect(document.activeElement).toBe(buttons[1]);
  expect(opener.getAttribute("aria-expanded")).toBe("true");
});

// 項目を押しても開いたままで、押せなくなった項目からフォーカスを移す（正常系）
test("test_open_step_menu_when_item_pressed", async () => {
  // 準備
  const { openStepMenu } = await loadStepMenu();
  const { opener } = setUpOpener();
  let secondEnabled = true;
  const run = vi.fn(() => {
    secondEnabled = false;
  });
  const handle = openStepMenu({
    opener,
    label: "移動",
    items: [
      { label: "上へ移す", icon: "arrow-up" as never, enabled: () => true, run: () => {} },
      { label: "下へ移す", icon: "arrow-down" as never, enabled: () => secondEnabled, run },
      { label: "右へ移す", icon: "arrow-right" as never, enabled: () => true, run: () => {} },
    ],
  });
  closers.push(() => handle.close({ restoreFocus: false }));
  const buttons = menuButtons();
  buttons[1]?.focus();
  // 実行
  buttons[1]?.click();
  // 検証
  expect(run).toHaveBeenCalledTimes(1);
  expect(
    document.querySelector(".mdmark-step-menu")?.matches(":popover-open"),
  ).toBe(true);
  const after = menuButtons();
  expect(after[1]?.disabled).toBe(true);
  expect(document.activeElement).toBe(after[2]);
});

// Esc で閉じて元の要素へフォーカスを戻し、外へ Esc を伝えない（正常系）
test("test_open_step_menu_when_escape", async () => {
  // 準備
  const { openStepMenu } = await loadStepMenu();
  const { root, opener } = setUpOpener();
  const outer = vi.fn();
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      outer();
    }
  });
  openStepMenu({ opener, label: "移動", items: itemsOf([true, true, true]) });
  // 実行
  await userEvent.keyboard("{Escape}");
  // 検証
  expect(document.querySelector(".mdmark-step-menu")).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(opener.getAttribute("aria-expanded")).toBe("false");
  expect(outer).not.toHaveBeenCalled();
});

// 上下の矢印キーで押せる項目の間を移る（正常系）
test("test_open_step_menu_when_arrow_keys", async () => {
  // 準備
  const { openStepMenu } = await loadStepMenu();
  const { opener } = setUpOpener();
  const handle = openStepMenu({
    opener,
    label: "移動",
    items: itemsOf([true, false, true]),
  });
  closers.push(() => handle.close({ restoreFocus: false }));
  const buttons = menuButtons();
  expect(document.activeElement).toBe(buttons[0]);
  // 実行
  await userEvent.keyboard("{ArrowDown}");
  // 検証
  expect(document.activeElement).toBe(buttons[2]);
});

/** 画面 1280×800 */
const VIEWPORT = { width: 1280, height: 800 };

/** 開いた元の要素の矩形 `(100, 100, 24, 24)` */
const ANCHOR = new DOMRect(100, 100, 24, 24);

/** メニューの大きさ `120×140` */
const SIZE = { width: 120, height: 140 };

/** 既定の試す側の順 */
const SIDES = ["below", "above", "right", "left"] as const;

// 下に入れば下に置く（正常系）
test("test_place_step_menu", async () => {
  // 準備
  const { placeStepMenu } = await loadStepMenu();
  // 実行
  const placed = placeStepMenu({
    anchor: ANCHOR,
    size: SIZE,
    avoid: [],
    viewport: VIEWPORT,
    sides: SIDES,
  });
  // 検証
  expect(placed).toEqual({ x: 100, y: 124, side: "below" });
});

// 下が避ける矩形と重なり、上と左が画面に入らないときは右に配置する（正常系）
test("test_place_step_menu_when_below_overlaps", async () => {
  // 準備
  const { placeStepMenu } = await loadStepMenu();
  // 実行
  const placed = placeStepMenu({
    anchor: ANCHOR,
    size: SIZE,
    avoid: [new DOMRect(100, 130, 20, 100)],
    viewport: VIEWPORT,
    sides: SIDES,
  });
  // 検証
  expect(placed).toEqual({ x: 124, y: 100, side: "right" });
});

// center は中央を合わせ、下に入らないときは上に置く（正常系）
test("test_place_step_menu_when_center", async () => {
  // 準備
  const { placeStepMenu } = await loadStepMenu();
  // 実行
  const placed = placeStepMenu({
    anchor: new DOMRect(400, 700, 200, 24),
    size: { width: 160, height: 120 },
    avoid: [],
    viewport: VIEWPORT,
    sides: SIDES,
    align: "center",
  });
  // 検証
  expect(placed).toEqual({ x: 420, y: 580, side: "above" });
});

// どの候補も当てはまらないときは画面に収まる最初の候補を返却する（正常系）
test("test_place_step_menu_when_nothing_fits", async () => {
  // 準備
  const { placeStepMenu } = await loadStepMenu();
  // 実行
  const placed = placeStepMenu({
    anchor: ANCHOR,
    size: SIZE,
    avoid: [new DOMRect(80, 130, 200, 100)],
    viewport: VIEWPORT,
    sides: SIDES,
  });
  // 検証
  expect(placed).toEqual({ x: 100, y: 124, side: "below" });
});
