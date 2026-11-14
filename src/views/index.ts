import { attachTables } from "../interact/tables.ts";
import { visibleText } from "../interact/text.ts";
import {
  renderView,
  renderViewBoard,
  renderViewSwitch,
} from "../parts/view.ts";
import type { MdmarkViewOptions, ViewSpec } from "./spec.ts";

/** ビューの部品のモジュール（`dist/view.js`）が export する関数 */
export type ViewPartModule = {
  /** `mountView` が呼ぶ */
  drawView: (el: HTMLElement, opts: MdmarkViewOptions) => () => void;
  /** `mount` が描いた `div.mdmark-view` ごとに呼ぶ */
  attachView: (view: HTMLElement) => () => void;
};

/** ビューの要素の `id` を文書の中で重ならせないための通し番号 */
let viewCounter = 0;

/** 何もしない片付けの関数 */
const noop = (): void => {};

/** 切り替えのボタンを押すとボードと表形式を出し分け、`aria-pressed` を修正する。受け取りを解除する関数を返却する */
function attachSwitch(options: {
  /** ビューの要素 */
  view: HTMLElement;
  /** 最初のビュー */
  mode: "board" | "table";
}): () => void {
  const { view } = options;
  const board = view.querySelector<HTMLElement>(".mdmark-view-board");
  const table = view.querySelector<HTMLElement>(".mdmark-view-table");
  const bar = view.querySelector<HTMLElement>(".mdmark-view-switch");
  /** 今のビューを出し、もう片方を隠す */
  const show = (mode: string): void => {
    if (board) {
      board.hidden = mode !== "board";
    }
    if (table) {
      table.hidden = mode !== "table";
    }
    for (const button of view.querySelectorAll<HTMLButtonElement>(
      ".mdmark-view-switch-item",
    )) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    }
  };
  const onClick = (event: Event): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      ".mdmark-view-switch-item",
    );
    if (button && !button.disabled && button.dataset.mode) {
      show(button.dataset.mode);
    }
  };
  show(options.mode);
  bar?.addEventListener("click", onClick);
  return () => bar?.removeEventListener("click", onClick);
}

/** `mountView` の指定から、`el` の中に class `mdmark` の要素を配置してビューを描き、表の操作と切り替えを付ける */
export function drawView(el: HTMLElement, opts: MdmarkViewOptions): () => void {
  const { columns, group, filter = {}, icons } = opts;
  const items = opts.items.map((item) =>
    columns.map((column) => item[column] ?? ""),
  );
  viewCounter += 1;
  const mode = opts.default ?? (group === undefined ? "table" : "board");
  const root = document.createElement("div");
  root.className = "mdmark";
  root.innerHTML = renderView({
    columns,
    items,
    group,
    mode,
    filters: Object.entries(filter).map(([name, kind]) => ({
      column: columns.indexOf(name),
      kind,
    })),
    icons,
    id: `mdmark-view-${viewCounter}`,
  });
  // 部品の HTML は操作を付けた後の外観（絞り込みのドロワーと一致なしの行）を持つため、操作が自分で追加する分と重ならないよう取り除く
  for (const part of root.querySelectorAll(
    ".mdmark-filter-drawer, .mdmark-table-empty",
  )) {
    part.remove();
  }
  el.replaceChildren(root);
  const view = root.querySelector<HTMLElement>(".mdmark-view");
  const detachTables = attachTables(root);
  const detachSwitch = view ? attachSwitch({ view, mode }) : noop;
  return () => {
    detachSwitch();
    detachTables();
    el.replaceChildren();
  };
}

/** `data-view` を `ViewSpec` として読み込む。読み込めなければ `undefined` */
function readSpec(view: HTMLElement): ViewSpec | undefined {
  try {
    return JSON.parse(view.dataset.view ?? "") as ViewSpec;
  } catch {
    return undefined;
  }
}

/** 本文の行のセルの文字を並べる（行の詳細と一致なしの行は除く） */
function readRows(table: HTMLTableElement): string[][] {
  return [...(table.tBodies[0]?.rows ?? [])]
    .filter(
      (row) =>
        !row.classList.contains("mdmark-table-empty") &&
        !row.classList.contains("mdmark-row-detail"),
    )
    .map((row) => [...row.cells].map((cell) => visibleText(cell)));
}

/** 見出しの行のセルの文字を並べる */
function readColumns(table: HTMLTableElement): string[] {
  return [...(table.tHead?.rows[0]?.cells ?? [])].map((cell) =>
    visibleText(cell),
  );
}

/** 表（表の部品で包んでいればその枠）を `div.mdmark-view-table` で包み、包んだ要素と包みを返却する */
function wrapTable(table: HTMLTableElement): {
  target: HTMLElement;
  holder: HTMLElement;
} {
  const target = table.closest<HTMLElement>(".mdmark-table") ?? table;
  const holder = document.createElement("div");
  holder.className = "mdmark-view-table";
  target.before(holder);
  holder.append(target);
  return { target, holder };
}

/** `render` が描いた `div.mdmark-view` の `data-view` と中の表から、切り替えとボードを配置して付ける。追加した要素を取り除き、表を元に戻す関数を返却する */
export function attachView(view: HTMLElement): () => void {
  const spec = readSpec(view);
  const table = view.querySelector("table");
  if (!spec || !table || (spec.group === null && spec.boardDisabled === "")) {
    return noop;
  }
  const columns = readColumns(table);
  const { target, holder } = wrapTable(table);
  const mode = spec.boardDisabled === "" ? spec.mode : "table";
  holder.insertAdjacentHTML(
    "beforebegin",
    renderViewSwitch({
      mode,
      boardDisabled: spec.boardDisabled || undefined,
    }) +
      renderViewBoard({
        columns,
        items: readRows(table),
        group: spec.group ?? -1,
        icons: spec.icons,
      }),
  );
  const detachSwitch = attachSwitch({ view, mode });
  return () => {
    detachSwitch();
    view.querySelector(".mdmark-view-switch")?.remove();
    view.querySelector(".mdmark-view-board")?.remove();
    holder.before(target);
    holder.remove();
  };
}
