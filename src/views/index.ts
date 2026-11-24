import { visibleText } from "../shared/text.interact.ts";
import { attachTableRows } from "../table/mdmark-table.interact.ts";
import { attachTables } from "../table/table.interact.ts";
import type { MdmarkViewOptions, ViewSpec } from "./spec.ts";
import { renderView, renderViewBoard, renderViewSwitch } from "./view.part.ts";

/** ビューの部品のモジュール（`dist/view.js`）が export する関数 */
export type ViewPartModule = {
  /** `mountView` とビューのカスタム要素が呼ぶ */
  drawView: (
    el: HTMLElement,
    opts: MdmarkViewOptions,
    hooks?: ViewHooks,
  ) => () => void;
  /** `mount` が描いた `div.mdmark-view` ごとに呼ぶ */
  attachView: (view: HTMLElement) => () => void;
};

/** ビューのカスタム要素だけが `drawView` に指定する、項目を押せるようにする指定 */
export type ViewHooks = {
  /** 項目ごとのキー（`opts.items` と同じ並び） */
  keys?: string[] | undefined;
  /** ボードの項目か表形式の行を押したときに、その項目のキーで呼ぶ */
  onItemClick?: ((key: string) => void) | undefined;
};

/** 押しても項目の押下にしない要素 */
const INTERACTIVE = "button, input, a, select, textarea, label";

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

/** ボードの押せる項目を、列ごとの並びで返却する */
function boardColumns(view: HTMLElement): HTMLElement[][] {
  return [...view.querySelectorAll<HTMLElement>(".mdmark-view-cards")].map(
    (list) => [
      ...list.querySelectorAll<HTMLElement>(".mdmark-view-card[data-key]"),
    ],
  );
}

/** ↑・↓・←・→ で移る先のボードの項目。移れなければ `undefined` */
function nextCard(
  columns: HTMLElement[][],
  card: HTMLElement,
  key: string,
): HTMLElement | undefined {
  const column = columns.findIndex((cards) => cards.includes(card));
  const row = columns[column]?.indexOf(card) ?? -1;
  if (key === "ArrowUp" || key === "ArrowDown") {
    return columns[column]?.[row + (key === "ArrowUp" ? -1 : 1)];
  }
  const target = columns[column + (key === "ArrowLeft" ? -1 : 1)];
  return target?.[Math.min(row, target.length - 1)];
}

/** ボードの押せる項目に押下・Enter と矢印キーの移動を付け、受け取りを解除する関数を返却する */
function attachBoardItems(
  view: HTMLElement,
  onItemClick: (key: string) => void,
): () => void {
  const board = view.querySelector<HTMLElement>(".mdmark-view-board");
  if (!board) {
    return noop;
  }
  const cardOf = (event: Event): HTMLElement | null =>
    (event.target as Element).closest<HTMLElement>(
      ".mdmark-view-card[data-key]",
    );
  const onClick = (event: MouseEvent): void => {
    const card = cardOf(event);
    if (card && !(event.target as Element).closest(INTERACTIVE)) {
      onItemClick(card.dataset.key ?? "");
    }
  };
  const onKeydown = (event: KeyboardEvent): void => {
    const card = cardOf(event);
    if (!card || event.target !== card) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onItemClick(card.dataset.key ?? "");
      return;
    }
    const next = nextCard(boardColumns(view), card, event.key);
    if (next) {
      event.preventDefault();
      card.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  };
  board.addEventListener("click", onClick);
  board.addEventListener("keydown", onKeydown);
  return () => {
    board.removeEventListener("click", onClick);
    board.removeEventListener("keydown", onKeydown);
  };
}

/** 表形式の押せる行に、表のカスタム要素と同じ押下とキー操作を付ける（セルの編集・行の追加は無い） */
function attachTableItems(
  view: HTMLElement,
  onItemClick: (key: string) => void,
): () => void {
  const wrapper = view.querySelector<HTMLElement>(
    ".mdmark-view-table .mdmark-table",
  );
  if (!wrapper) {
    return noop;
  }
  return attachTableRows(wrapper, {
    onRowClick: onItemClick,
    onCellEdit: () => false,
    onRowAdd: noop,
    renderCell: noop,
    valueOf: () => null,
  });
}

/** `mountView` の指定から、`el` の中に class `mdmark` の要素を配置してビューを描き、表の操作と切り替えを付ける。`hooks.keys` があれば項目を押せるようにする */
export function drawView(
  el: HTMLElement,
  opts: MdmarkViewOptions,
  hooks: ViewHooks = {},
): () => void {
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
    keys: hooks.keys,
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
  const { onItemClick } = hooks;
  const detachItems =
    view && hooks.keys && onItemClick
      ? [
          attachBoardItems(view, onItemClick),
          attachTableItems(view, onItemClick),
        ]
      : [];
  return () => {
    for (const detach of detachItems) {
      detach();
    }
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
