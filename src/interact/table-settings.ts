import { type ColumnPlace, canMoveColumn, moveColumn } from "../table-logic.ts";

/** 落とす先の線を出す項目の class */
const DROP_CLASSES = { before: "is-drop-before", after: "is-drop-after" };

/** 一覧の項目のまとまりの鍵から、列が属する範囲とピン止めの側を返却する */
function placeOf(item: HTMLElement): ColumnPlace {
  const key = item.dataset.place ?? "";
  return {
    group: key === "" || key === "pinned" ? undefined : key,
    pinned: key === "pinned",
  };
}

/** 行のうち `data-col` を持つセルを、列の順 `order` にもう一度並べる（持たないセルとセルの配置場所は変えない） */
export function reorderRowCells(
  row: HTMLTableRowElement,
  order: number[],
): void {
  const rank = new Map(order.map((column, index) => [column, index]));
  const cells = [...row.cells].filter(
    (cell) =>
      cell.dataset.col !== undefined && rank.has(Number(cell.dataset.col)),
  );
  const sorted = [...cells].sort(
    (a, b) =>
      (rank.get(Number(a.dataset.col)) ?? 0) -
      (rank.get(Number(b.dataset.col)) ?? 0),
  );
  if (sorted.every((cell, index) => cell === cells[index])) {
    return;
  }
  const markers = cells.map((cell) => {
    const marker = document.createComment("");
    cell.replaceWith(marker);
    return marker;
  });
  sorted.forEach((cell, index) => {
    markers[index]?.replaceWith(cell);
  });
}

/** 表の帯のテーブル設定のパネルのつまみに、ドラッグ＆ドロップと ↑・↓ キーで列を動かす操作を付ける。列を動かしたら見出し・本文の行・集計の行のセルと一覧をもう一度並べ、`onReorder` に新しい列の順を指定する。受け取りを解除する関数を返却する */
export function attachTableSettings(options: {
  /** `div.mdmark-table` */
  wrapper: HTMLElement;
  /** 囲みの中の表 */
  table: HTMLTableElement;
  /** 列を動かした後に呼ぶ */
  onReorder: (order: number[]) => void;
}): () => void {
  const { wrapper, table, onReorder } = options;
  const panel = [...wrapper.children].find((child) =>
    child.classList.contains("mdmark-table-settings"),
  ) as HTMLElement | undefined;
  const list = panel?.querySelector<HTMLElement>(".mdmark-table-settings-list");
  if (!panel || !list) {
    return () => {};
  }
  /** 一覧の項目を、並んだ順に返却する */
  const items = (): HTMLElement[] => [
    ...list.querySelectorAll<HTMLElement>(".mdmark-table-settings-item"),
  ];
  const orderOf = (): number[] =>
    items().map((item) => Number(item.dataset.column));
  const itemOf = (column: number): HTMLElement | undefined =>
    items().find((item) => Number(item.dataset.column) === column);
  let dragging: number | undefined;

  /** 列 `column` を `target` の前か後ろへ動かし、表のセルと一覧をもう一度並べる */
  const move = (column: number, target: number, side: "before" | "after") => {
    const from = itemOf(column);
    const to = itemOf(target);
    if (!from || !to || column === target) {
      return;
    }
    if (!canMoveColumn({ from: placeOf(from), to: placeOf(to) })) {
      return;
    }
    const order = moveColumn({ order: orderOf(), column, target, side });
    if (side === "before") {
      to.before(from);
    } else {
      to.after(from);
    }
    for (const row of table.rows) {
      reorderRowCells(row, order);
    }
    onReorder(order);
  };
  /** 落とす先の線を全て削除する */
  const clearDropLines = (): void => {
    for (const item of items()) {
      item.classList.remove(DROP_CLASSES.before, DROP_CLASSES.after);
    }
  };
  /** ドラッグの位置から、落とす先の項目と向きを決める（落とせないときは `undefined`） */
  const dropTarget = (
    event: DragEvent,
  ): { item: HTMLElement; side: "before" | "after" } | undefined => {
    const item = (event.target as Element | null)?.closest<HTMLElement>(
      ".mdmark-table-settings-item",
    );
    const from = dragging === undefined ? undefined : itemOf(dragging);
    if (!item || !from || item === from || !list.contains(item)) {
      return undefined;
    }
    if (!canMoveColumn({ from: placeOf(from), to: placeOf(item) })) {
      return undefined;
    }
    const rect = item.getBoundingClientRect();
    return {
      item,
      side: event.clientY < rect.top + rect.height / 2 ? "before" : "after",
    };
  };
  const onDragStart = (event: DragEvent): void => {
    const grip = (event.target as Element | null)?.closest<HTMLElement>(
      ".mdmark-table-settings-grip",
    );
    const item = grip?.closest<HTMLElement>(".mdmark-table-settings-item");
    if (!grip || !item || !list.contains(item)) {
      return;
    }
    dragging = Number(item.dataset.column);
    item.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", String(dragging));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };
  const onDragOver = (event: DragEvent): void => {
    const target = dropTarget(event);
    clearDropLines();
    // 動かせない位置では `preventDefault` せず、線も出さない
    if (target) {
      event.preventDefault();
      target.item.classList.add(DROP_CLASSES[target.side]);
    }
  };
  const onDrop = (event: DragEvent): void => {
    const target = dropTarget(event);
    clearDropLines();
    if (target && dragging !== undefined) {
      event.preventDefault();
      move(dragging, Number(target.item.dataset.column), target.side);
    }
  };
  const onDragEnd = (): void => {
    clearDropLines();
    if (dragging !== undefined) {
      itemOf(dragging)?.classList.remove("is-dragging");
    }
    dragging = undefined;
  };
  /** つまみの ↑・↓ キーで、同じ範囲の隣の列と入れ替える。フォーカスはつまみに残す */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    const grip = (event.target as Element | null)?.closest<HTMLElement>(
      ".mdmark-table-settings-grip",
    );
    const item = grip?.closest<HTMLElement>(".mdmark-table-settings-item");
    if (!grip || !item || !list.contains(item)) {
      return;
    }
    event.preventDefault();
    moveByKey(item, event.key === "ArrowUp" ? "before" : "after");
    grip.focus();
  };
  /** 項目を、同じ範囲の上（`before`）か下（`after`）の隣の列と入れ替える */
  const moveByKey = (item: HTMLElement, side: "before" | "after"): void => {
    const all = items();
    const index = all.indexOf(item);
    const neighbor = all[side === "before" ? index - 1 : index + 1];
    if (neighbor) {
      move(Number(item.dataset.column), Number(neighbor.dataset.column), side);
    }
  };
  list.addEventListener("dragstart", onDragStart);
  list.addEventListener("dragenter", onDragOver);
  list.addEventListener("dragover", onDragOver);
  list.addEventListener("drop", onDrop);
  list.addEventListener("dragend", onDragEnd);
  list.addEventListener("keydown", onKeyDown);
  return () => {
    list.removeEventListener("dragstart", onDragStart);
    list.removeEventListener("dragenter", onDragOver);
    list.removeEventListener("dragover", onDragOver);
    list.removeEventListener("drop", onDrop);
    list.removeEventListener("dragend", onDragEnd);
    list.removeEventListener("keydown", onKeyDown);
  };
}
