import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { wrapDirective } from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";
import { erText, shopEr } from "../../helpers/er.ts";
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

/** 幅 1100 の ER 図（モックの `shop-er` の幅を広げたもの）の定義の JSON */
const WIDE_TEXT = erText({ ...shopEr(), width: 1100 });

/** 幅 `width`・高さ `height` の ER 図の定義の JSON（列 1 つのテーブルを、図の下端が `height` になる位置に配置する） */
function sizedEr(width: number, height: number): string {
  return erText({
    title: "大きさを決めた図",
    scope: "表示する枠の高さを確認する",
    updated: "2026-11-05",
    width,
    tables: [
      {
        id: "items",
        name: "items",
        label: "項目",
        x: 20,
        // テーブルの高さ（見出し 44・列 26・枠 4）と図の下の余白 32 を引く
        y: height - 106,
        w: 140,
        columns: [{ name: "id", type: "bigint", pk: true }],
      },
    ],
    relations: [],
  });
}

/** 幅 600px の描く先の要素に、幅 1100 の ER 図を描く */
function createDiagramRoot(): HTMLElement {
  const { root } = createRoot(wrapDirective("er", WIDE_TEXT));
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  return root;
}

/** 幅 600・高さ 1200 の ER 図の定義（全体が収まる倍率が 1 になる縦長の図） */
const TALL_TEXT = sizedEr(600, 1200);

/** 幅 600px の描く先の要素に、幅 600・高さ 1200 の ER 図を描く */
function createTallDiagramRoot(): HTMLElement {
  const { root } = createRoot(wrapDirective("er", TALL_TEXT));
  root.style.width = "600px";
  root.style.setProperty("--mdmark-padding", "0");
  return root;
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

/** 倍率のボタン（スクリーンリーダー向けの名前が `倍率 {今の倍率}。全体が収まる倍率に戻す`） */
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

// 利用側が高さを変えると、36rem を超えて図の全体が収まる高さまで広がり、倍率に合わせて上限を付け替える（正常系）
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

// 削除すると監視も削除される（正常系）
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
    ...dialog.querySelectorAll<HTMLElement>(
      ".mdmark-diagram-info[aria-describedby]",
    ),
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

/** 幅 500・高さ 1600 の ER 図の定義（全体が収まる倍率は幅で決まり 1 になる縦長の図） */
const LONG_TEXT = sizedEr(500, 1600);

/** 表示する枠の右下のリサイズハンドル */
function handleOf(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>(".mdmark-diagram-resize");
  if (!found) {
    throw new Error("リサイズハンドルが無い");
  }
  return found;
}

// リサイズハンドルで高さを変えると、全体が収まる倍率を幅と高さでもう一度求め、もう一度付けても保つ（正常系）
test("test_attach_diagrams_when_handle_resized", async () => {
  // 準備
  vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
  const { attachDiagrams } = await loadDiagrams();
  const { root } = createRoot(wrapDirective("er", LONG_TEXT));
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
  // 実行: 削除してもう一度付ける
  detach();
  detachers.push(attachDiagrams({ root, placement: "bottom", storage }));
  // 検証
  expect(viewportOf(root).clientHeight).toBe(776);
});

// 指定した図だけに付け、倍率の下限を守る（正常系）
test("test_attach_diagrams_when_figures_given", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const { root } = createRoot(
    `${wrapDirective("er", WIDE_TEXT)}\n\n${wrapDirective("er", WIDE_TEXT)}`,
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
