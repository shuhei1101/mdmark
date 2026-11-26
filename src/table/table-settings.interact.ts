import { type ColumnPlace, canMoveColumn, moveColumn } from "./table.logic.ts";

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

/** テーブル設定のパネルのつまみに、ドラッグ＆ドロップ・↑・↓ キー・押して開く列の移動のメニューで列を動かす操作を付ける。列を動かしたら見出し・本文の行・集計の行のセルと一覧をもう一度並べ、`onReorder` に新しい列の順を指定する。受け取りを解除する関数を返却する */
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
  /** 押したつまみの項目（一覧の外やつまみでなければ `undefined`） */
  const gripItemOf = (
    target: EventTarget | null,
  ): { grip: HTMLButtonElement; item: HTMLElement } | undefined => {
    const grip = (target as Element | null)?.closest<HTMLButtonElement>(
      ".mdmark-table-settings-grip",
    );
    const item = grip?.closest<HTMLElement>(".mdmark-table-settings-item");
    return grip && item && list.contains(item) ? { grip, item } : undefined;
  };
  /** つまみの ↑・↓ キーで同じ範囲の隣の列と入れ替え、Enter で列の移動のメニューを開閉する。フォーカスはつまみに残す */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && moveOpen()) {
      event.preventDefault();
      event.stopPropagation();
      closeMoveMenu(true);
      return;
    }
    const target = gripItemOf(event.target);
    if (!target) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleMoveMenu(target);
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    moveByKey(target.item, event.key === "ArrowUp" ? "before" : "after");
    target.grip.focus();
  };
  /** 項目の `side` の向きの隣の項目（同じ範囲でなければ `undefined`） */
  const neighborOf = (
    item: HTMLElement,
    side: "before" | "after",
  ): HTMLElement | undefined => {
    const all = items();
    const index = all.indexOf(item);
    const neighbor = all[side === "before" ? index - 1 : index + 1];
    return neighbor &&
      canMoveColumn({ from: placeOf(item), to: placeOf(neighbor) })
      ? neighbor
      : undefined;
  };
  /** 項目を、同じ範囲の上（`before`）か下（`after`）の隣の列と入れ替える */
  const moveByKey = (item: HTMLElement, side: "before" | "after"): void => {
    const neighbor = neighborOf(item, side);
    if (neighbor) {
      move(Number(item.dataset.column), Number(neighbor.dataset.column), side);
    }
  };

  // ─── 列の移動のメニュー ───
  const moveMenu = panel.querySelector<HTMLElement>(".mdmark-table-move-menu");
  let moveTarget: { grip: HTMLButtonElement; item: HTMLElement } | undefined;
  /** 列の移動のメニューを開いているか */
  const moveOpen = (): boolean => moveTarget !== undefined;
  /** 列の移動のメニューのボタン */
  const moveButton = (
    side: "before" | "after",
  ): HTMLButtonElement | null | undefined =>
    moveMenu?.querySelector<HTMLButtonElement>(`button[data-move="${side}"]`);
  /** 列の移動のメニューを開いた項目の後ろに配置し、動かせない向きのボタンを `disabled` にする */
  const placeMoveMenu = (item: HTMLElement): void => {
    if (!moveMenu) {
      return;
    }
    item.after(moveMenu);
    moveMenu.setAttribute(
      "aria-label",
      `「${item.dataset.name ?? ""}」の列の移動`,
    );
    for (const side of ["before", "after"] as const) {
      const button = moveButton(side);
      if (button) {
        button.disabled = neighborOf(item, side) === undefined;
      }
    }
  };
  /** 列の移動のメニューを閉じる。`returnFocus` が真なら開いたつまみへフォーカスを戻す */
  const closeMoveMenu = (returnFocus: boolean): void => {
    const target = moveTarget;
    moveTarget = undefined;
    if (moveMenu) {
      moveMenu.hidden = true;
    }
    target?.grip.setAttribute("aria-expanded", "false");
    if (returnFocus) {
      target?.grip.focus();
    }
  };
  /** つまみの列の移動のメニューを開く（同じつまみで開いていれば閉じる）。開いたら押せる最初のボタンへフォーカスを移す */
  const toggleMoveMenu = (target: {
    grip: HTMLButtonElement;
    item: HTMLElement;
  }): void => {
    if (!moveMenu || target.grip.disabled) {
      return;
    }
    const same = moveTarget?.grip === target.grip;
    closeMoveMenu(same);
    if (same) {
      return;
    }
    moveTarget = target;
    placeMoveMenu(target.item);
    moveMenu.hidden = false;
    target.grip.setAttribute("aria-expanded", "true");
    const first = [moveButton("before"), moveButton("after")].find(
      (button) => button && !button.disabled,
    );
    first?.focus();
  };
  /** 列の移動のメニューのボタンで列を 1 つ動かし、メニューを開いたまま項目に付けて動かす。押したボタンが押せなくなったら、もう一方へフォーカスを移す */
  const moveByMenu = (side: "before" | "after"): void => {
    if (!moveTarget) {
      return;
    }
    moveByKey(moveTarget.item, side);
    placeMoveMenu(moveTarget.item);
    const pressed = moveButton(side);
    const other = moveButton(side === "before" ? "after" : "before");
    if (pressed?.disabled && other && !other.disabled) {
      other.focus();
    } else {
      pressed?.focus();
    }
  };
  const onClick = (event: MouseEvent): void => {
    const move = (event.target as Element | null)?.closest<HTMLElement>(
      ".mdmark-table-move-menu button[data-move]",
    );
    if (move && list.contains(move)) {
      moveByMenu(move.dataset.move === "before" ? "before" : "after");
      return;
    }
    const target = gripItemOf(event.target);
    if (target) {
      toggleMoveMenu(target);
    }
  };
  list.addEventListener("dragstart", onDragStart);
  list.addEventListener("dragenter", onDragOver);
  list.addEventListener("dragover", onDragOver);
  list.addEventListener("drop", onDrop);
  list.addEventListener("dragend", onDragEnd);
  list.addEventListener("keydown", onKeyDown);
  list.addEventListener("click", onClick);
  return () => {
    list.removeEventListener("click", onClick);
    closeMoveMenu(false);
    list.removeEventListener("dragstart", onDragStart);
    list.removeEventListener("dragenter", onDragOver);
    list.removeEventListener("dragover", onDragOver);
    list.removeEventListener("drop", onDrop);
    list.removeEventListener("dragend", onDragEnd);
    list.removeEventListener("keydown", onKeyDown);
  };
}
