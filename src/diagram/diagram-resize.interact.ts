import {
  openStepMenu,
  type StepMenuHandle,
} from "../shared/step-menu.interact.ts";
import {
  readStoredSize,
  storedSizeKey,
  writeStoredSize,
} from "../shared/stored-size.logic.ts";
import { clampDiagramHeight, RESIZE } from "./geometry.ts";

/** リサイズハンドルで変えた高さを sessionStorage に記載するキーの頭 */
export const DIAGRAM_HEIGHT_KEY_PREFIX = "mdmark-diagram-height:";

// ドラッグの間にリサイズハンドルに付ける class
const RESIZING_CLASS = "is-resizing";

// 上下キーと、高さを変える向き
const KEY_STEPS: Record<string, number> = {
  ArrowUp: -RESIZE.step,
  ArrowDown: RESIZE.step,
};

/** 同じページの同じ順の同じ題名の図だけが同じ高さを読み込む、sessionStorage のキー */
export const diagramHeightKey = (options: {
  pathname: string;
  index: number;
  title: string;
}): string =>
  storedSizeKey({
    prefix: DIAGRAM_HEIGHT_KEY_PREFIX,
    pathname: options.pathname,
    index: options.index,
    name: options.title,
  });

/** リサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、ダブルクリックで今の倍率の図の全体が収まる高さにし、動かさずに押すか Enter・Space で大きさのメニューを開き、変えた高さを保つ。付けたときに保った高さを当て、その高さと操作を削除する関数を返却する */
export const attachDiagramResize = (options: {
  /** 表示する枠 */
  viewport: HTMLElement;
  /** リサイズハンドル */
  handle: HTMLElement;
  /** 高さを保つキー（`diagramHeightKey`） */
  key: string;
  /** 高さを保つ先（sessionStorage。使用できないときは `null`） */
  storage: Storage | null;
  /** 今の倍率の図の全体が収まる高さを返却する */
  fit: () => number;
  /** 高さを変えたときに、変えた高さで呼ぶ */
  onResize: (height: number) => void;
}): { restored: number | null; detach: () => void } => {
  const { viewport, handle, key, storage, fit: fitHeight, onResize } = options;
  const controller = new AbortController();
  const { signal } = controller;

  /** スクリーンリーダーの値（今の高さと、変えられる範囲）を書き換える */
  const updateValues = (height: number): void => {
    handle.setAttribute("aria-valuenow", String(Math.round(height)));
    handle.setAttribute("aria-valuemin", String(RESIZE.min));
    handle.setAttribute(
      "aria-valuemax",
      String(Math.round(Math.max(RESIZE.min, fitHeight(), height))),
    );
    handle.setAttribute("aria-valuetext", `${Math.round(height)}px`);
  };

  /** 高さを範囲に収めて当て、保って通知する */
  const setHeight = (height: number): void => {
    const next = clampDiagramHeight(height);
    viewport.style.height = `${next}px`;
    updateValues(next);
    writeStoredSize(storage, key, next);
    onResize(next);
  };

  const currentHeight = (): number => viewport.getBoundingClientRect().height;

  // 大きさのメニュー: ドラッグの代わりに高さを 1 段ずつ変える・全体が収まる高さにする
  let menu: StepMenuHandle | undefined;
  const closeMenu = (): void => {
    menu?.close({ restoreFocus: false });
    menu = undefined;
  };
  const openMenu = (): void => {
    if (menu) {
      return;
    }
    const opened = openStepMenu({
      opener: handle,
      label: handle.getAttribute("aria-label") ?? "図の表示の高さ",
      sides: ["below", "above"],
      align: "center",
      onClose: () => {
        if (menu === opened) {
          menu = undefined;
        }
      },
      items: [
        {
          label: "低くする",
          icon: "minus",
          enabled: () => Math.round(currentHeight()) > RESIZE.min,
          run: () => setHeight(currentHeight() - RESIZE.step),
        },
        {
          label: "高くする",
          icon: "plus",
          enabled: () => Math.round(currentHeight()) < Math.round(fitHeight()),
          run: () => setHeight(currentHeight() + RESIZE.step),
        },
        {
          label: "全体が収まる高さにする",
          icon: "chevrons-up-down",
          enabled: () =>
            Math.round(currentHeight()) !== Math.round(fitHeight()),
          run: () => setHeight(fitHeight()),
        },
      ],
    });
    menu = opened;
  };
  signal.addEventListener("abort", closeMenu);

  // ドラッグ: 縦の移動の分だけ高さを変える。`RESIZE.dragThreshold` 未満の動きで離したときは大きさのメニューを開く
  let drag:
    | { y: number; height: number; id: number; moved: boolean }
    | undefined;
  handle.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      drag = {
        y: event.clientY,
        height: currentHeight(),
        id: event.pointerId,
        moved: false,
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
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dy) < RESIZE.dragThreshold) {
        return;
      }
      if (!drag.moved) {
        drag.moved = true;
        closeMenu();
      }
      setHeight(drag.height + dy);
    },
    { signal },
  );
  const endDrag = (): void => {
    drag = undefined;
    handle.classList.remove(RESIZING_CLASS);
  };
  handle.addEventListener(
    "pointerup",
    (event) => {
      const pressed = drag !== undefined && !drag.moved && event.button === 0;
      endDrag();
      if (pressed) {
        openMenu();
      }
    },
    { signal },
  );
  handle.addEventListener("pointercancel", endDrag, { signal });

  // 上下キー: 1 回で `RESIZE.step` ずつ変える。Enter・Space: 大きさのメニューを開く
  handle.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMenu();
        return;
      }
      const step = KEY_STEPS[event.key];
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      setHeight(currentHeight() + step);
    },
    { signal },
  );

  // ダブルクリック: 倍率を変えずに、今の倍率の図の全体が収まる高さにする
  handle.addEventListener(
    "dblclick",
    () => {
      closeMenu();
      setHeight(fitHeight());
    },
    { signal },
  );

  // 保った高さは、操作で変えるときと同じく範囲に収めて適用する
  const kept = readStoredSize(storage, key);
  const restored = kept === null ? null : clampDiagramHeight(kept);
  if (restored === null) {
    updateValues(viewport.getBoundingClientRect().height);
  } else {
    viewport.style.height = `${restored}px`;
    updateValues(restored);
  }
  return { restored, detach: () => controller.abort() };
};
