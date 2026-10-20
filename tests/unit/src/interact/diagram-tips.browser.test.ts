import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { INQUIRY_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";

/** 図のツールチップの操作を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTips = () => import("../../../../src/interact/diagram-tips.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
  vi.useRealTimers();
});

/** `tip` を持つ線のラベル（ツールチップの持ち主）を返す */
function tipOwner(figure: ParentNode): HTMLElement {
  const owner = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-label.has-tip",
  );
  if (!owner) {
    throw new Error("ツールチップを持つ線のラベルが無い");
  }
  return owner;
}

/** 持ち主が指すツールチップ */
function tipOf(owner: HTMLElement): HTMLElement {
  const tip = document.getElementById(
    owner.getAttribute("aria-describedby") ?? "",
  );
  if (!tip) {
    throw new Error("ツールチップが無い");
  }
  return tip;
}

/** フロー図を描いた `figure` */
function createFigure(): HTMLElement {
  const { root } = createRoot(wrapDirective("flow", INQUIRY_TEXT));
  const figure = root.querySelector<HTMLElement>("figure.mdmark-diagram");
  if (!figure) {
    throw new Error("図が描かれていない");
  }
  return figure;
}

// フォーカスで開き、Esc で閉じてフォーカスを持ち主に残す（正常系）
test("test_attach_diagram_tips", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips(figure);
  detachers.push(detach);
  const owner = tipOwner(figure);
  // 実行
  owner.focus();
  // 検証
  const tip = tipOf(owner);
  expect(tip.hidden).toBe(false);
  await userEvent.keyboard("{Escape}");
  expect(tip.hidden).toBe(true);
  expect(document.activeElement).toBe(owner);
});

// ツールチップの上では閉じない（正常系）
test("test_attach_diagram_tips_when_hovered", async () => {
  // 準備
  vi.useFakeTimers();
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips(figure);
  detachers.push(detach);
  const owner = tipOwner(figure);
  const tip = tipOf(owner);
  owner.dispatchEvent(new PointerEvent("pointerenter"));
  // 実行
  owner.dispatchEvent(new PointerEvent("pointerleave"));
  tip.dispatchEvent(new PointerEvent("pointerenter"));
  vi.advanceTimersByTime(1000);
  // 検証
  expect(tip.hidden).toBe(false);
});
