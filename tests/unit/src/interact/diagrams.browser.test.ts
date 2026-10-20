import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { INQUIRY_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

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

/** 倍率の表示 */
function zoomText(root: ParentNode): string {
  return root.querySelector('[aria-label="倍率"]')?.textContent ?? "";
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
  detachers.push(attachDiagrams(root));
  // 検証
  expect(zoomText(root)).toBe("55%");
  expect(button(root, "縮小").disabled).toBe(true);
  button(root, "拡大").click();
  expect(zoomText(root)).toBe("68%");
  viewportOf(root).focus();
  await userEvent.keyboard("0");
  expect(zoomText(root)).toBe("55%");
});

// 上限で拡大を押せなくする（正常系）
test("test_attach_diagrams_when_max", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams(root));
  // 実行
  for (let i = 0; i < 10; i += 1) {
    button(root, "拡大").click();
  }
  // 検証
  expect(zoomText(root)).toBe("300%");
  expect(button(root, "拡大").disabled).toBe(true);
});

// 拡大した間だけ移動のボタンを出し、矢印キーで動かす（正常系）
test("test_attach_diagrams_when_panned", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams(root));
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

// ホイールで倍率を変えない（正常系）
test("test_attach_diagrams_when_wheel", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams(root));
  const viewport = viewportOf(root);
  const event = new WheelEvent("wheel", {
    deltaY: -100,
    bubbles: true,
    cancelable: true,
  });
  // 実行
  viewport.dispatchEvent(event);
  // 検証
  expect(zoomText(root)).toBe("55%");
  expect(event.defaultPrevented).toBe(false);
});

// 外すと監視も外れる（正常系）
test("test_attach_diagrams_when_cleaned_up", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const disconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
  const root = createDiagramRoot();
  const detach = attachDiagrams(root);
  // 実行
  detach();
  button(root, "拡大").click();
  // 検証
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(zoomText(root)).toBe("55%");
});

// 全画面を開いて Esc で閉じ、フォーカスを全画面のボタンへ戻す（正常系）
test("test_open_diagram_dialog", async () => {
  // 準備
  const { attachDiagrams } = await loadDiagrams();
  const root = createDiagramRoot();
  detachers.push(attachDiagrams(root));
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
  detachers.push(attachDiagrams(root));
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
