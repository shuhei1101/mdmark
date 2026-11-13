import { afterEach, beforeAll, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import type { PartStates } from "../../../../src/interact/part-states.ts";
import { wrapDirective } from "../../helpers/diagrams.ts";
import { addStyles, createRoot, removeRoots } from "../../helpers/dom.ts";
import { erText, foldEr, shopErFolded } from "../../helpers/er.ts";

/** ER 図の列の開閉を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadFolds = () => import("../../../../src/interact/er-folds.ts");

const detachers: Array<() => void> = [];

beforeAll(() => {
  addStyles();
});

afterEach(() => {
  for (const detach of detachers.splice(0)) {
    detach();
  }
  removeRoots();
});

/** 描いた ER 図の figure */
function figureOf(root: HTMLElement): HTMLElement {
  const figure = root.querySelector<HTMLElement>(
    'figure.mdmark-diagram[data-diagram="er"]',
  );
  if (figure === null) {
    throw new Error("ER 図が描かれていない");
  }
  return figure;
}

/** テーブルの要素 */
function tableOf(figure: HTMLElement, id: string): HTMLElement {
  const table = figure.querySelector<HTMLElement>(
    `.mdmark-diagram-er-table[data-node="${id}"]`,
  );
  if (table === null) {
    throw new Error(`テーブルが無い: ${id}`);
  }
  return table;
}

/** 関係の線の先の端の y（`d` の最後の縦の線の終わり） */
function endY(figure: HTMLElement): number {
  const d =
    figure
      .querySelector('[data-er-to="orders"] path[data-line="er"]')
      ?.getAttribute("d") ?? "";
  const y = /V([\d.]+) H[\d.]+$/.exec(d)?.[1];
  if (y === undefined) {
    throw new Error(`線の経路が読み込めない: ${d}`);
  }
  return Number(y);
}

/** 主キーでも外部キーでもない列の行 */
function otherRows(table: HTMLElement): HTMLElement[] {
  return [
    ...table.querySelectorAll<HTMLElement>(".mdmark-diagram-er-column"),
  ].filter(
    (row) => row.querySelector('[data-key="pk"], [data-key="fk"]') === null,
  );
}

// 開閉のボタンで列を畳み、関係の線をもう一度結ぶ（正常系）
test("test_attach_er_folds", async () => {
  // 準備
  const { attachErFolds } = await loadFolds();
  const { root } = createRoot(wrapDirective("er", erText(foldEr())));
  const figure = figureOf(root);
  detachers.push(attachErFolds(figure));
  const orders = tableOf(figure, "orders");
  const button = orders.querySelector<HTMLButtonElement>(
    "button.mdmark-diagram-er-fold",
  );
  if (button === null) {
    throw new Error("開閉のボタンが無い");
  }
  const before = endY(figure);
  // 実行
  await userEvent.click(button);
  const folded = endY(figure);
  const foldedRows = otherRows(orders).map((row) => row.hidden);
  const foldedDisplays = otherRows(orders).map(
    (row) => getComputedStyle(row).display,
  );
  const foldedExpanded = button.getAttribute("aria-expanded");
  await userEvent.click(button);
  // 検証
  expect(foldedRows.every(Boolean)).toBe(true);
  expect(foldedDisplays.every((display) => display === "none")).toBe(true);
  expect(foldedExpanded).toBe("false");
  expect(folded).not.toBe(before);
  expect(otherRows(orders).some((row) => row.hidden)).toBe(false);
  expect(
    otherRows(orders).every((row) => getComputedStyle(row).display !== "none"),
  ).toBe(true);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(endY(figure)).toBe(before);
  expect(document.activeElement).toBe(button);
});

// 畳んだテーブルを開き、もう一度畳む（正常系）
test("test_set_er_table_folded", async () => {
  // 準備
  const { setErTableFolded } = await loadFolds();
  const { root } = createRoot(wrapDirective("er", erText(shopErFolded())));
  const figure = figureOf(root);
  const orders = tableOf(figure, "orders");
  const initial = figure.innerHTML;
  // 実行
  setErTableFolded({ table: orders, folded: false });
  const openedHidden = otherRows(orders).some((row) => row.hidden);
  const openedRest = orders.querySelector<HTMLElement>(
    ".mdmark-diagram-er-rest",
  );
  const openedRestShown =
    openedRest !== null && getComputedStyle(openedRest).display !== "none";
  setErTableFolded({ table: orders, folded: true });
  // 検証
  expect(openedHidden).toBe(false);
  expect(openedRestShown).toBe(false);
  expect(figure.innerHTML).toBe(initial);
});

// 記録した開閉で始め、押した開閉を記録する（正常系）
test("test_attach_er_folds_when_states", async () => {
  // 準備
  const { attachErFolds } = await loadFolds();
  const states: PartStates = new Map();
  const markdown = wrapDirective("er", erText(foldEr()));
  const first = createRoot(markdown).root;
  const detachFirst = attachErFolds(figureOf(first), states);
  const firstButton = tableOf(
    figureOf(first),
    "orders",
  ).querySelector<HTMLButtonElement>("button.mdmark-diagram-er-fold");
  if (firstButton === null) {
    throw new Error("開閉のボタンが無い");
  }
  await userEvent.click(firstButton);
  detachFirst();
  first.remove();
  const { root } = createRoot(markdown);
  const figure = figureOf(root);
  // 実行
  detachers.push(attachErFolds(figure, states));
  // 検証: orders は畳んだまま始まる
  const orders = tableOf(figure, "orders");
  expect(otherRows(orders).every((row) => row.hidden)).toBe(true);
  expect(
    orders
      .querySelector("button.mdmark-diagram-er-fold")
      ?.getAttribute("aria-expanded"),
  ).toBe("false");
});
