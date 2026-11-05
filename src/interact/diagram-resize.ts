import { clampDiagramHeight, RESIZE } from "../diagram/geometry.ts";

/** リサイズハンドルで変えた高さを sessionStorage に書くキーの頭 */
export const DIAGRAM_HEIGHT_KEY_PREFIX = "mdmark-diagram-height:";

// ドラッグの間にリサイズハンドルに付ける class
const RESIZING_CLASS = "is-resizing";

// 上下キーと、高さを変える向き
const KEY_STEPS: Record<string, number> = {
  ArrowUp: -RESIZE.step,
  ArrowDown: RESIZE.step,
};

/** 同じページの同じ順の同じ題名の図だけが同じ高さを読む、sessionStorage のキー */
export const diagramHeightKey = (options: {
  pathname: string;
  index: number;
  title: string;
}): string =>
  `${DIAGRAM_HEIGHT_KEY_PREFIX}${options.pathname}#${options.index}:${options.title}`;

/** 保った高さを読む。読めない・正の整数でないときは `null`（保つ先の例外は外へ出さない） */
const readHeight = (storage: Storage | null, key: string): number | null => {
  try {
    const value = storage?.getItem(key);
    if (value === null || value === undefined || !/^\d+$/.test(value)) {
      return null;
    }
    const height = Number(value);
    return height > 0 ? height : null;
  } catch {
    return null;
  }
};

/** 高さを保つ（`null` はキーを削除する）。保つ先の例外は外へ出さない */
const writeHeight = (
  storage: Storage | null,
  key: string,
  height: number | null,
): void => {
  try {
    if (height === null) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, String(height));
    }
  } catch {
    // 保てないときは、高さを保たずに変えるだけにする
  }
};

/** リサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、ダブルクリックで戻し、変えた高さを保つ。付けたときに保った高さを当て、その高さと操作を外す関数を返す */
export const attachDiagramResize = (options: {
  /** 表示する枠 */
  viewport: HTMLElement;
  /** リサイズハンドル */
  handle: HTMLElement;
  /** 高さを保つキー（`diagramHeightKey`） */
  key: string;
  /** 高さを保つ先（sessionStorage。使えないときは `null`） */
  storage: Storage | null;
  /** 今の上限（定義の高さ × 今の倍率） */
  max: () => number;
  /** 定義から決まる高さを当て、その高さを返す */
  reset: () => number;
  /** 高さを変えたとき（戻したときは `null`）に呼ぶ */
  onResize: (height: number | null) => void;
}): { restored: number | null; detach: () => void } => {
  const { viewport, handle, key, storage, max, reset, onResize } = options;
  const controller = new AbortController();
  const { signal } = controller;

  /** 読み上げの値（今の高さと、変えられる範囲）を書き換える */
  const updateValues = (height: number): void => {
    handle.setAttribute("aria-valuenow", String(Math.round(height)));
    handle.setAttribute("aria-valuemin", String(RESIZE.min));
    handle.setAttribute(
      "aria-valuemax",
      String(Math.round(Math.max(RESIZE.min, max()))),
    );
  };

  /** 高さを範囲に収めて当て、保って知らせる */
  const setHeight = (height: number): void => {
    const next = clampDiagramHeight(height, max());
    viewport.style.height = `${next}px`;
    updateValues(next);
    writeHeight(storage, key, next);
    onResize(next);
  };

  // ドラッグ: 縦の移動の分だけ高さを変える
  let drag: { y: number; height: number; id: number } | undefined;
  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      drag = {
        y: event.clientY,
        height: viewport.getBoundingClientRect().height,
        id: event.pointerId,
      };
      handle.setPointerCapture(event.pointerId);
      handle.classList.add(RESIZING_CLASS);
    },
    { signal },
  );
  handle.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      setHeight(drag.height + event.clientY - drag.y);
    },
    { signal },
  );
  const endDrag = (): void => {
    drag = undefined;
    handle.classList.remove(RESIZING_CLASS);
  };
  handle.addEventListener("pointerup", endDrag, { signal });
  handle.addEventListener("pointercancel", endDrag, { signal });

  // 上下キー: 1 回で `RESIZE.step` ずつ変える
  handle.addEventListener(
    "keydown",
    (event) => {
      const step = KEY_STEPS[event.key];
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      setHeight(viewport.getBoundingClientRect().height + step);
    },
    { signal },
  );

  // ダブルクリック: 定義から決まる高さに戻し、保った高さを削除する
  handle.addEventListener(
    "dblclick",
    () => {
      const height = reset();
      updateValues(height);
      writeHeight(storage, key, null);
      onResize(null);
    },
    { signal },
  );

  // 保った高さは、操作で変えるときと同じく範囲に収めて当てる
  const kept = readHeight(storage, key);
  const restored = kept === null ? null : clampDiagramHeight(kept, max());
  if (restored === null) {
    updateValues(viewport.getBoundingClientRect().height);
  } else {
    viewport.style.height = `${restored}px`;
    updateValues(restored);
  }
  return { restored, detach: () => controller.abort() };
};
