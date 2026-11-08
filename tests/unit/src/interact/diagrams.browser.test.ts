import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  INQUIRY_GROUPS_TEXT,
  INQUIRY_TEXT,
  wrapDirective,
} from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";
import { memoryStorage } from "../../helpers/storage.ts";

/** 図の操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiagrams = () => import("../../../../src/interact/diagrams.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.restoreAllMocks();
});

/** 幅 600px の描く先の要素に、幅 1100 のフロー図を描く */
function createDiagramRoot(): HTMLElement {
  const { root } = createRoot(wrapDirective("flow", INQUIRY_TEXT));
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  return root;
}

/** 幅 600・高さ 1200 のフロー図の定義（全体が収まる倍率が 1 になる縦長の図） */
const TALL_TEXT = JSON.stringify({
  title: "縦長の図",
  scope: "表示する枠の高さを確かめる",
  updated: "2026-10-31",
  width: 600,
  height: 1200,
  nodes: [
    { id: "top", kind: "script", x: 230, y: 20, w: 140, h: 64, name: "上" },
  ],
  wires: [],
});

/** 幅 600px の描く先の要素に、幅 600・高さ 1200 のフロー図を描く */
function createTallDiagramRoot(): HTMLElement {
  const { root } = createRoot(wrapDirective("flow", TALL_TEXT));
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  return root;
}

/** 読み上げの名前でボタンを探す */
function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    `button[aria-label="${name}"]`,
  );
  if (!found) {
    throw new Error(`ボタンが無い: ${name}`);
  }
  return found;
}

/** 倍率のボタン（読み上げの名前が `倍率 {今の倍率}。全体が収まる倍率に戻す`） */
function zoomButton(root: ParentNode): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(
    'button[aria-label^="倍率"]',
  );
  if (!found) {
    throw new Error("倍率のボタンが無い");
  }
  return found;
}

/** 倍率の表示 */
function zoomText(root: ParentNode): string {
  return zoomButton(root).textContent ?? "";
}

/** 図の表示する枠 */
function viewportOf(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(
    '[role="group"][aria-roledescription="図"]',
  );
  if (!found) {
    throw new Error("表示する枠が無い");
  }
  return found;
}

// 全体が収まる倍率で開き、拡大と戻すができる（正常系）
test("test_attach_diagrams", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  // 実行
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(button(root, "縮小").disabled).toBe(true);
  button(root, "拡大").click();
  expect(zoomText(root)).toBe("125%");
  viewportOf(root).focus();
  await userEvent.keyboard("0");
  expect(zoomText(root)).toBe("100%");
});

// 上限で拡大を押せなくする（正常系）
test("test_attach_diagrams_when_max", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 実行
  for (let i = 0; i < 10; i += 1) {
    button(root, "拡大").click();
  }
  // 検証
  expect(zoomText(root)).toBe("550%");
  expect(button(root, "拡大").disabled).toBe(true);
});

// 拡大した間だけ移動のボタンを出し、矢印キーで動かす（正常系）
test("test_attach_diagrams_when_panned", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const panGroup = button(root, "右へ動かす").parentElement;
  expect(panGroup?.hidden).toBe(true);
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewport = viewportOf(root);
  const before = viewport.scrollLeft;
  // 実行
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  // 検証
  expect(panGroup?.hidden).toBe(false);
  expect(viewport.scrollLeft - before).toBe(80);
});

// 倍率のボタンで開いたときの倍率と位置に戻す（正常系）
test("test_attach_diagrams_when_zoom_button", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "拡大").click();
  button(root, "拡大").click();
  const viewport = viewportOf(root);
  viewport.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(viewport.scrollLeft).toBeGreaterThan(0);
  expect(zoomButton(root).getAttribute("aria-label")).toBe(
    "倍率 156%。全体が収まる倍率に戻す",
  );
  // 実行
  zoomButton(root).click();
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(viewport.scrollLeft).toBe(0);
  expect(zoomButton(root).getAttribute("aria-label")).toBe(
    "倍率 100%。全体が収まる倍率に戻す",
  );
  // 実行: 開いたときの倍率のままでも押せる
  expect(zoomButton(root).disabled).toBe(false);
  zoomButton(root).click();
  // 検証
  expect(zoomText(root)).toBe("100%");
});

// ホイールで倍率を変えない（正常系）
test("test_attach_diagrams_when_wheel", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const viewport = viewportOf(root);
  const event = new WheelEvent("wheel", {
    deltaY: -100,
    bubbles: true,
    cancelable: true,
  });
  // 実行
  viewport.dispatchEvent(event);
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(event.defaultPrevented).toBe(false);
});

// 開いたときの高さを --mdmark-diagram-max-height で抑え、上限を図の全体が収まる高さにする（正常系）
test("test_attach_diagrams_when_tall", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createTallDiagramRoot();
  // 実行
  detachers.push(attachDiagrams({ root, placement: "top" }));
  // 検証
  const viewport = viewportOf(root);
  expect(viewport.clientHeight).toBe(576);
  expect(viewport.style.maxHeight).toBe("1200px");
});

// 使う側が高さを変えると、36rem を超えて図の全体が収まる高さまで広がり、倍率に合わせて上限を付け替える（正常系）
test("test_attach_diagrams_when_resized", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createTallDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const viewport = viewportOf(root);
  // 実行: 36rem を超える高さにする
  viewport.style.height = "1000px";
  // 検証
  expect(viewport.clientHeight).toBe(1000);
  // 実行: 図の全体が収まる高さを超える高さにする
  viewport.style.height = "1500px";
  // 検証: 上限で止まる
  expect(viewport.clientHeight).toBe(1200);
  // 実行: 拡大する
  button(root, "拡大").click();
  // 検証: 上限を今の倍率に合わせる
  expect(viewport.style.maxHeight).toBe("1500px");
  // 実行: 開いたときの倍率に戻す
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(viewport.clientHeight).toBe(576);
  expect(viewport.style.maxHeight).toBe("1200px");
});

// 外すと監視も外れる（正常系）
test("test_attach_diagrams_when_cleaned_up", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const disconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
  const root = createDiagramRoot();
  const detach = attachDiagrams({ root, placement: "top" });
  // 実行
  detach();
  button(root, "拡大").click();
  // 検証
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(zoomText(root)).toBe("100%");
});

// 全画面を開いて Esc で閉じ、フォーカスを全画面のボタンへ戻す（正常系）
test("test_open_diagram_dialog", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  const opener = button(root, "全画面で開く");
  // 実行
  opener.click();
  // 検証
  expect(root.querySelectorAll("dialog[open]")).toHaveLength(1);
  await userEvent.keyboard("{Escape}");
  expect(root.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

// ツールチップを開いている間の Esc は、何度でもツールチップだけを閉じる（正常系）
test("test_open_diagram_dialog_when_tip_open", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams({ root, placement: "top" }));
  button(root, "全画面で開く").click();
  const dialog = root.querySelector("dialog");
  if (!dialog) {
    throw new Error("全画面が開いていない");
  }
  const owners = [
    ...dialog.querySelectorAll<HTMLElement>(".mdmark-diagram-label.has-tip"),
  ];
  expect(owners.length).toBeGreaterThanOrEqual(2);
  // 実行・検証
  for (const owner of owners.slice(0, 2)) {
    await userEvent.hover(owner);
    const tip = document.getElementById(
      owner.getAttribute("aria-describedby") ?? "",
    );
    expect(tip?.hidden).toBe(false);
    await userEvent.keyboard("{Escape}");
    expect(tip?.hidden).toBe(true);
    expect(dialog.open).toBe(true);
  }
});

/** 幅 500・高さ 1600 のフロー図の定義（全体が収まる倍率は幅で決まり 1 になる縦長の図） */
const LONG_TEXT = JSON.stringify({
  title: "縦に長い図",
  scope: "リサイズハンドルを確かめる",
  updated: "2026-11-05",
  width: 500,
  height: 1600,
  nodes: [
    { id: "top", kind: "script", x: 180, y: 20, w: 140, h: 64, name: "上" },
  ],
  wires: [],
});

/** 表示する枠の右下のリサイズハンドル */
function handleOf(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(".mdmark-diagram-resize");
  if (!found) {
    throw new Error("リサイズハンドルが無い");
  }
  return found;
}

// リサイズハンドルで高さを変えると、全体が収まる倍率を幅と高さで求め直し、付け直しても保つ（正常系）
test("test_attach_diagrams_when_handle_resized", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachDiagrams } = await loadDiagrams();
  const { root } = createRoot(wrapDirective("flow", LONG_TEXT));
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  const storage = memoryStorage();
  const detach = attachDiagrams({ root, placement: "bottom", storage });
  const viewport = viewportOf(root);
  const handle = handleOf(root);
  const point = { bubbles: true, pointerId: 1, button: 0, clientX: 10 };
  // 実行: 200px 下へドラッグする
  handle.dispatchEvent(
    new PointerEvent("pointerdown", { ...point, clientY: 100 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointermove", { ...point, clientY: 300 }),
  );
  handle.dispatchEvent(
    new PointerEvent("pointerup", { ...point, clientY: 300 }),
  );
  // 検証: 高さが 576 + 200 になり、倍率は変わらない（全体が収まる倍率が下がった分、倍率の文字は 100% より大きい）
  expect(viewport.clientHeight).toBe(776);
  expect(zoomText(root)).not.toBe("100%");
  // 実行: 全体が収まる倍率に戻す
  viewport.focus();
  await userEvent.keyboard("0");
  // 検証
  expect(zoomText(root)).toBe("100%");
  expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight + 1);
  // 実行: 外して付け直す
  detach();
  detachers.push(attachDiagrams({ root, placement: "bottom", storage }));
  // 検証
  expect(viewportOf(root).clientHeight).toBe(776);
});

// 渡した図だけに付け、倍率の下限を守る（正常系）
test("test_attach_diagrams_when_figures_given", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const { root } = createRoot(
    `${wrapDirective("flow", INQUIRY_TEXT)}\n\n${wrapDirective("flow", INQUIRY_TEXT)}`,
  );
  root.style.width = "300px";
  root.style.setProperty("--mdmark-padding", "0");
  const [other, floored] = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ];
  if (other === undefined || floored === undefined) {
    throw new Error("図が 2 つ無い");
  }
  floored.dataset.fitMin = "0.75";
  // 実行
  detachers.push(
    attachDiagrams({ root, placement: "bottom", figures: [floored] }),
  );
  // 検証
  const content = floored.querySelector<HTMLElement>(".mdmark-diagram-stage");
  expect(content?.style.transform).toBe("scale(0.75)");
  button(floored, "拡大").click();
  expect(content?.style.transform).not.toBe("scale(0.75)");
  const before = zoomText(other);
  button(other, "拡大").click();
  expect(zoomText(other)).toBe(before);
});

// 動かした間、グループのタイトルを上端に留め、off の図では留めない（正常系）
test("test_attach_diagrams_when_titles_stuck", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const off = JSON.stringify({
    ...JSON.parse(INQUIRY_GROUPS_TEXT),
    stickyTitles: false,
  });
  const { root } = createRoot(
    `${wrapDirective("flow", INQUIRY_GROUPS_TEXT)}\n\n${wrapDirective("flow", off)}`,
  );
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  detachers.push(attachDiagrams({ root, placement: "bottom" }));
  const figures = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ];
  // 実行
  for (const figure of figures) {
    button(figure, "拡大").click();
    button(figure, "拡大").click();
    const viewport = viewportOf(figure);
    viewport.scrollTop = viewport.scrollHeight * 0.4;
    viewport.dispatchEvent(new Event("scroll"));
  }
  // 検証
  const [on, stopped] = figures;
  const frameTitle = on?.querySelector<HTMLElement>(
    ".mdmark-diagram-frame-title",
  );
  expect(frameTitle?.classList.contains("is-stuck")).toBe(true);
  expect(frameTitle?.style.transform).toContain("translateY");
  expect(
    on?.querySelectorAll(".mdmark-diagram-lane-label.is-stuck").length,
  ).toBe(1);
  for (const title of stopped?.querySelectorAll<HTMLElement>(
    "[data-sticky-top]",
  ) ?? []) {
    expect(title.style.transform).toBe("");
  }
});
