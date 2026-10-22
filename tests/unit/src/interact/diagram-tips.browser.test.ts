import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { wrapHtml } from "../../helpers/charts.ts";
import { INQUIRY_TEXT, wrapDirective } from "../../helpers/diagrams.ts";
import {
  addStyles,
  createRoot,
  createRootFromHtml,
  removeRoots,
} from "../../helpers/dom.ts";
import { renderDoc } from "../../helpers/render.ts";

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

// 箱の印の外では開かない（正常系）
test("test_attach_diagram_tips_when_box_hovered", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const figure = createFigure();
  const { detach } = attachDiagramTips(figure);
  detachers.push(detach);
  const info = figure.querySelector<HTMLElement>(".mdmark-diagram-info");
  const box = info?.closest<HTMLElement>(".mdmark-diagram-node");
  const name = box?.querySelector<HTMLElement>(".mdmark-diagram-node-name");
  if (!info || !box || !name) {
    throw new Error("入力・処理・出力を持つ箱が無い");
  }
  const tip = tipOf(info);
  // 実行
  box.dispatchEvent(new PointerEvent("pointerenter"));
  name.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tip.hidden).toBe(true);
  // 実行
  info.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tip.hidden).toBe(false);
});

/** 埋め込んだ HTML のヒント: ブロックの要素 1 つと、行内の要素 1 つ */
const HINT_BODY = [
  '<div data-hint="ブロックの説明" style="width: 20rem; padding: 1rem">ブロックの文字</div>',
  '<p>前の文字 <span data-hint="行内の説明">行内の語</span> 後ろの文字</p>',
].join("\n");

/** ヒントを持つ埋め込んだ HTML を描いた `div.mdmark-html` */
function createEmbedded(): HTMLElement {
  const { root } = createRoot(wrapHtml(HINT_BODY));
  const embedded = root.querySelector<HTMLElement>("div.mdmark-html");
  if (!embedded) {
    throw new Error("埋め込んだ HTML が描かれていない");
  }
  return embedded;
}

/** 開いている（`hidden` でない）ツールチップの数 */
function openCount(scope: ParentNode): number {
  return [...scope.querySelectorAll<HTMLElement>('[role="tooltip"]')].filter(
    (tip) => !tip.hidden,
  ).length;
}

// 埋め込んだ HTML のヒントを開く（正常系）
test("test_attach_diagram_tips_when_embedded_hint", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const embedded = createEmbedded();
  const { detach } = attachDiagramTips(embedded);
  detachers.push(detach);
  const block = embedded.querySelector<HTMLElement>(".mdmark-hint-block");
  const mark = embedded.querySelector<HTMLElement>(".mdmark-hint-mark");
  const inline = embedded.querySelector<HTMLElement>(".mdmark-hint-inline");
  if (!block || !mark || !inline) {
    throw new Error("ヒントの要素が描かれていない");
  }
  // 実行: ブロックの要素の文字の上
  block.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(openCount(embedded)).toBe(0);
  // 実行: 印の上
  mark.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tipOf(mark).hidden).toBe(false);
  expect(tipOf(mark).textContent).toContain("ブロックの説明");
  expect(openCount(embedded)).toBe(1);
  // 実行: 行内の要素の上
  inline.dispatchEvent(new PointerEvent("pointerenter"));
  // 検証
  expect(tipOf(inline).hidden).toBe(false);
  expect(tipOf(inline).textContent).toContain("行内の説明");
  expect(tipOf(mark).hidden).toBe(true);
  expect(openCount(embedded)).toBe(1);
});

// 同じページに 2 回描いてもヒントの id が重ならない（正常系）
test("test_attach_diagram_tips_when_embedded_unique_ids", async () => {
  // 準備
  const { attachDiagramTips } = await loadTips();
  const { html } = renderDoc(wrapHtml(HINT_BODY));
  const roots = [createRootFromHtml(html), createRootFromHtml(html)];
  // 実行
  for (const root of roots) {
    const embedded = root.querySelector<HTMLElement>("div.mdmark-html");
    if (!embedded) {
      throw new Error("埋め込んだ HTML が描かれていない");
    }
    detachers.push(attachDiagramTips(embedded).detach);
  }
  // 検証
  const ids = roots.flatMap((root) =>
    [...root.querySelectorAll("[id]")].map((element) => element.id),
  );
  expect(ids.length).toBeGreaterThanOrEqual(4);
  expect(new Set(ids).size).toBe(ids.length);
  for (const root of roots) {
    const owners = root.querySelectorAll<HTMLElement>("[aria-describedby]");
    expect(owners.length).toBe(2);
    for (const owner of owners) {
      expect(root.contains(tipOf(owner))).toBe(true);
    }
  }
});
