import { clampColumnWidth } from "../table-logic.ts";

/** 列の幅のつまみにフォーカスして ←・→ キーを 1 回押したときに変える幅（px） */
export const COLUMN_RESIZE_STEP_PX = 16;

/** タッチの 2 回のタップをダブルタップとみなす、前のタップを離してから次のタップを離すまでの上限（ms） */
export const DOUBLE_TAP_MS = 300;

/** タッチの `pointerdown` から `pointerup` までの移動がこの幅（px）以内なら、ドラッグでなくタップとして数える */
export const TAP_MOVE_TOLERANCE_PX = 8;

/** 描く処理が見出しのセルに入れる、描いたときの幅の変数 */
const MIN_WIDTH_VARIABLE = "--mdmark-column-min-width";

/** つまみの class */
const HANDLE_CLASS = "mdmark-col-resize";

/** つまみの `aria-*` のうち、付けた後に書き換える属性 */
const VALUE_ATTRIBUTES = [
  "aria-valuenow",
  "aria-valuetext",
  "aria-valuemin",
  "aria-valuemax",
] as const;

/** 列の幅のつまみに操作を付ける引数 */
export type ColumnResizeOptions = {
  /** 列ごとの最下段の見出しのセル */
  headCells: HTMLTableCellElement[];
  /** 列の幅の上限（px）を返却する */
  maxWidth: (column: number) => number;
  /** 幅を変えた後と戻した後に呼ぶ */
  onResize: (column: number) => void;
  /** 見出しのセルに幅を入れた後、外側の幅を測る前に呼ぶ（表の幅を列の幅の合計に合わせる） */
  onWidthWritten?: () => void;
};

/** ドラッグしている間の記録 */
type DragState = {
  column: number;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  startWidth: number;
  /** `pointerdown` からの最も大きな移動（px） */
  distance: number;
};

/** セルの左右の余白と罫線の幅の合計（px） */
const insetOf = (cell: HTMLElement): number => {
  const style = getComputedStyle(cell);
  return [
    style.paddingLeft,
    style.paddingRight,
    style.borderLeftWidth,
    style.borderRightWidth,
  ].reduce((sum, value) => sum + Number.parseFloat(value), 0);
};

/** 見出しのセルのインラインの幅の指定を除いて測った、列の最小幅（外側の幅。px） */
const minWidthOf = (cell: HTMLElement): number => {
  const minWidth = cell.style.minWidth;
  const variable = cell.style.getPropertyValue(MIN_WIDTH_VARIABLE);
  cell.style.minWidth = "";
  cell.style.removeProperty(MIN_WIDTH_VARIABLE);
  const value = Number.parseFloat(getComputedStyle(cell).minWidth) || 0;
  cell.style.minWidth = minWidth;
  if (variable) {
    cell.style.setProperty(MIN_WIDTH_VARIABLE, variable);
  }
  return value + insetOf(cell);
};

/** 見出しのセルの内側の幅を `width`・`min-width`・`--mdmark-column-min-width` に入れる */
const writeInnerWidth = (cell: HTMLElement, inner: number): void => {
  const value = `${Math.max(0, inner)}px`;
  cell.style.width = value;
  cell.style.minWidth = value;
  cell.style.setProperty(MIN_WIDTH_VARIABLE, value);
};

/** 見出しのセルの外側の幅を `outer` にする。入れた後に測った外側の幅が違えば、差を加えて入れ直す */
const writeOuterWidth = (
  cell: HTMLElement,
  outer: number,
  onWritten?: () => void,
): void => {
  const inner = outer - insetOf(cell);
  writeInnerWidth(cell, inner);
  onWritten?.();
  const diff = outer - cell.getBoundingClientRect().width;
  if (Math.abs(diff) >= 0.5) {
    writeInnerWidth(cell, inner + diff);
  }
};

/** 表の最下段の見出しのつまみに、ドラッグ・←→ キーで列の幅を変え、ダブルクリック・ダブルタップ・Enter で戻す操作を付ける。受け取りを削除し、幅の指定を全て戻す関数を返却する */
export const attachColumnResize = (
  table: HTMLTableElement,
  options: ColumnResizeOptions,
): (() => void) => {
  const { headCells, maxWidth, onResize, onWidthWritten } = options;
  const initialVariables = headCells.map((cell) =>
    cell.style.getPropertyValue(MIN_WIDTH_VARIABLE),
  );
  const initialTableWidth = table.style.width;
  const handles = headCells.map((cell) =>
    cell.querySelector<HTMLElement>(`:scope > .${HANDLE_CLASS}`),
  );
  // 幅を指定した列と、ほかの列の幅を保つために今の幅で止めた列
  const resized = new Set<number>();
  const frozen = new Set<number>();
  let drag: DragState | undefined;
  let lastTap: { column: number; time: number } | undefined;

  /** 列の全てのセル（見出しのセルと、本文・集計の行の同じ列のセル） */
  const cellsOf = (column: number): HTMLElement[] => {
    const head = headCells[column];
    return [
      ...(head ? [head] : []),
      ...table.querySelectorAll<HTMLElement>(
        `:scope > :is(tbody, tfoot) > tr > [data-col="${column}"]`,
      ),
    ];
  };
  /** 見出しのセルのインラインの幅の指定を解除し、`--mdmark-column-min-width` を付けたときの値に戻す */
  const clearWidth = (column: number): void => {
    const cell = headCells[column];
    if (!cell) {
      return;
    }
    cell.style.width = "";
    cell.style.minWidth = "";
    const variable = initialVariables[column];
    if (variable) {
      cell.style.setProperty(MIN_WIDTH_VARIABLE, variable);
    } else {
      cell.style.removeProperty(MIN_WIDTH_VARIABLE);
    }
  };
  /** つまみの今の幅・最小幅・上限を書き換える */
  const updateValues = (column: number): void => {
    const cell = headCells[column];
    const handle = handles[column];
    if (!cell || !handle) {
      return;
    }
    const width = String(cell.offsetWidth);
    handle.setAttribute("aria-valuenow", width);
    handle.setAttribute("aria-valuetext", `${width}px`);
    handle.setAttribute("aria-valuemin", String(Math.ceil(minWidthOf(cell))));
    handle.setAttribute("aria-valuemax", String(Math.floor(maxWidth(column))));
  };
  /** 最初に幅を指定するとき、表が残りの幅を列に配り直さないよう、ほかの列を今の幅で止める */
  const freezeOthers = (column: number): Array<[HTMLElement, number]> => {
    const others = headCells.flatMap(
      (cell, index): Array<[number, HTMLElement, number]> =>
        index === column || cell.hidden
          ? []
          : [[index, cell, cell.getBoundingClientRect().width]],
    );
    if (getComputedStyle(table).display === "table") {
      table.style.width = "auto";
    }
    for (const [index, cell, outer] of others) {
      frozen.add(index);
      writeInnerWidth(cell, outer - insetOf(cell));
    }
    return others.map(([, cell, outer]) => [cell, outer]);
  };
  /** 列の幅の指定を全て解除し、表の幅を付けたときに戻す */
  const unfreeze = (): void => {
    for (const index of frozen) {
      clearWidth(index);
    }
    frozen.clear();
    table.style.width = initialTableWidth;
  };
  /** 列の外側の幅を、列の最小幅から上限までに収めて見出しのセルに入れる */
  const setColumnWidth = (column: number, width: number): void => {
    const cell = headCells[column];
    if (!cell) {
      return;
    }
    // 自動で列の幅を決めた表は、ほかの列の幅を CSS 変数が保つので固定しない
    const others =
      resized.size === 0 && !table.hasAttribute("data-auto-width")
        ? freezeOthers(column)
        : [];
    frozen.delete(column);
    resized.add(column);
    // mdmark-wide の列は幅を指定すると折り返すので、class を付けてから最小幅を測る
    for (const target of cellsOf(column)) {
      target.classList.add("is-resized");
    }
    const target = clampColumnWidth({
      width,
      min: Math.ceil(minWidthOf(cell)),
      max: Math.floor(maxWidth(column)),
    });
    writeOuterWidth(cell, target, onWidthWritten);
    for (const [other, outer] of others) {
      writeOuterWidth(other, outer);
    }
    onResize(column);
    updateValues(column);
  };
  /** 列の幅の指定を解除し、描いた直後の幅に戻す */
  const resetWidth = (column: number): void => {
    if (!resized.has(column)) {
      return;
    }
    resized.delete(column);
    clearWidth(column);
    for (const target of cellsOf(column)) {
      target.classList.remove("is-resized");
    }
    if (resized.size === 0) {
      unfreeze();
    }
    onResize(column);
    updateValues(column);
  };

  /** タッチのタップを数え、前のタップから `DOUBLE_TAP_MS` 以内なら幅を戻す */
  const countTap = (column: number): void => {
    const now = performance.now();
    if (
      lastTap !== undefined &&
      lastTap.column === column &&
      now - lastTap.time <= DOUBLE_TAP_MS
    ) {
      lastTap = undefined;
      resetWidth(column);
      return;
    }
    lastTap = { column, time: now };
  };
  /** ドラッグを終える。タッチで動かさなかったときだけタップに数える */
  const endDrag = (event: PointerEvent, counted: boolean): void => {
    if (drag === undefined || event.pointerId !== drag.pointerId) {
      return;
    }
    const { column, pointerType, distance } = drag;
    drag = undefined;
    handles[column]?.classList.remove("is-dragging");
    if (!counted || pointerType !== "touch") {
      return;
    }
    if (distance <= TAP_MOVE_TOLERANCE_PX) {
      countTap(column);
    } else {
      lastTap = undefined;
    }
  };

  const removers = handles.flatMap((handle, column) => {
    const cell = headCells[column];
    if (!handle || !cell) {
      return [];
    }
    const onPointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("is-dragging");
      drag = {
        column,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: cell.offsetWidth,
        distance: 0,
      };
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (drag === undefined || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      drag.distance = Math.max(
        drag.distance,
        Math.hypot(dx, event.clientY - drag.startY),
      );
      if (dx !== 0) {
        setColumnWidth(column, drag.startWidth + dx);
      }
    };
    const onPointerUp = (event: PointerEvent): void => {
      endDrag(event, true);
    };
    const onPointerCancel = (event: PointerEvent): void => {
      endDrag(event, false);
    };
    const onDoubleClick = (event: MouseEvent): void => {
      event.preventDefault();
      resetWidth(column);
    };
    // 上限はほかの列の幅・ピン止め・表の幅で変わるので、フォーカスしたときにも書き換える
    const onFocus = (): void => {
      updateValues(column);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const step =
          event.key === "ArrowRight"
            ? COLUMN_RESIZE_STEP_PX
            : -COLUMN_RESIZE_STEP_PX;
        setColumnWidth(column, cell.offsetWidth + step);
      } else if (event.key === "Enter") {
        event.preventDefault();
        resetWidth(column);
      }
    };
    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerCancel);
    handle.addEventListener("dblclick", onDoubleClick);
    handle.addEventListener("keydown", onKeyDown);
    handle.addEventListener("focus", onFocus);
    updateValues(column);
    return [
      (): void => {
        handle.removeEventListener("pointerdown", onPointerDown);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerCancel);
        handle.removeEventListener("dblclick", onDoubleClick);
        handle.removeEventListener("keydown", onKeyDown);
        handle.removeEventListener("focus", onFocus);
        handle.classList.remove("is-dragging");
        for (const name of VALUE_ATTRIBUTES) {
          handle.removeAttribute(name);
        }
      },
    ];
  });

  return () => {
    for (const remove of removers) {
      remove();
    }
    for (const column of resized) {
      clearWidth(column);
      for (const target of cellsOf(column)) {
        target.classList.remove("is-resized");
      }
    }
    resized.clear();
    unfreeze();
  };
};
