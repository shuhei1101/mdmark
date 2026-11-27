import { iconSvg } from "../shared/icons.part.ts";
import {
  openStepMenu,
  type StepMenuHandle,
  type StepMenuItem,
} from "../shared/step-menu.interact.ts";
import { DRAG_THRESHOLD_PX } from "./drag.ts";

/** 移動のボタンを重ねる要素と、ボタンで開くメニューの項目 */
export type MoveTarget = {
  /** ボタンを内側の角に重ねる要素 */
  element: Element;
  /** 表示名。ボタンの名前とメニューの名前に使用する */
  name: string;
  /** メニューの項目 */
  items: StepMenuItem[];
  /** 再描画で要素が置き換わったときに、同じ要素を探し直すセレクタ */
  selector?: string;
};

/** ボタンと要素の角の間（px） */
const BUTTON_INSET = 4;

/** 2 つの矩形が重なるか */
const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** map の図で、動かさずに押した要素の内側の右上（図のパネルと重なるときは左上）に移動のボタンを重ね、押すと向きのメニューを開く */
export const attachMoveButton = (options: {
  /** 図の表示する枠。ボタンをこの中に配置する */
  viewport: HTMLElement;
  /** 図の右上のパネル */
  panel: () => Element | null;
  /** 動かさずに押した要素から動かす要素を求める。ボタンを出さない要素は `undefined` */
  pointedOf: (target: Element) => MoveTarget | undefined;
}): { refresh: () => void; hide: () => void; detach: () => void } => {
  const { viewport, panel, pointedOf } = options;
  const controller = new AbortController();
  const { signal } = controller;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-move";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.title = "移動";
  button.hidden = true;
  button.innerHTML = iconSvg("move");
  viewport.append(button);

  let current: MoveTarget | undefined;
  let menu: StepMenuHandle | undefined;

  const closeMenu = (): void => {
    menu?.close({ restoreFocus: false });
    menu = undefined;
  };

  /** ボタンを要素の内側の角へ配置する。右上が図のパネルと重なるときは左上にする */
  const place = (target: MoveTarget): void => {
    const box = target.element.getBoundingClientRect();
    const frame = viewport.getBoundingClientRect();
    const size = button.getBoundingClientRect();
    const top = box.top + BUTTON_INSET;
    const right = box.right - BUTTON_INSET - size.width;
    const left = box.left + BUTTON_INSET;
    const panelRect = panel()?.getBoundingClientRect();
    const atRight = new DOMRect(right, top, size.width, size.height);
    const x =
      panelRect && overlaps(atRight, panelRect) ? left : Math.max(right, left);
    button.style.left = `${x - frame.left - viewport.clientLeft + viewport.scrollLeft}px`;
    button.style.top = `${top - frame.top - viewport.clientTop + viewport.scrollTop}px`;
  };

  const show = (target: MoveTarget): void => {
    current = target;
    button.setAttribute("aria-label", `「${target.name}」を移動`);
    button.hidden = false;
    place(target);
  };

  const hide = (): void => {
    closeMenu();
    current = undefined;
    button.hidden = true;
  };

  /** 再描画の後に同じ要素を探し直し、ボタンと開いたメニューを置き直す */
  const refresh = (): void => {
    if (!current) {
      return;
    }
    const { selector } = current;
    const element =
      selector === undefined
        ? current.element
        : viewport.querySelector(selector);
    const next = element?.isConnected === true ? pointedOf(element) : undefined;
    if (!next) {
      hide();
      return;
    }
    show(next);
    menu?.refresh();
  };

  // 押した位置の動きを測り、`DRAG_THRESHOLD_PX` 未満で離したときだけ、次の描画の後に押した要素を求める
  let down: { x: number; y: number; target: Element } | undefined;
  const isOwn = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    (button.contains(target) || target.closest(".mdmark-step-menu") !== null);
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || isOwn(event.target)) {
        down = undefined;
        return;
      }
      down = {
        x: event.clientX,
        y: event.clientY,
        target: event.target as Element,
      };
    },
    { capture: true, signal },
  );
  viewport.addEventListener(
    "pointerup",
    (event) => {
      const pressed = down;
      down = undefined;
      if (
        !pressed ||
        Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) >=
          DRAG_THRESHOLD_PX
      ) {
        return;
      }
      // 押した要素は離した時点で求め、前に押した要素のボタンとメニューは次の描画まで隠す
      const pointed = pressed.target.isConnected
        ? pointedOf(pressed.target)
        : undefined;
      hide();
      requestAnimationFrame(() => {
        if (signal.aborted || !pointed) {
          return;
        }
        // 押した後の描き直しで要素が置き換わったときは、セレクタで今の要素を探し直す
        const element =
          pointed.element.isConnected || pointed.selector === undefined
            ? pointed.element
            : viewport.querySelector(pointed.selector);
        const target = element?.isConnected ? pointedOf(element) : undefined;
        if (target) {
          show(target);
        }
      });
    },
    { capture: true, signal },
  );

  button.addEventListener(
    "click",
    () => {
      if (menu) {
        closeMenu();
        return;
      }
      const target = current;
      if (!target) {
        return;
      }
      const opened = openStepMenu({
        opener: button,
        label: `「${target.name}」の移動`,
        // ボタンは要素の内側の角にあるため、要素そのものを基準に外側へ開き、要素に重ねない
        anchor: () => (current?.element as HTMLElement | undefined) ?? button,
        // Esc で閉じたときは移動のボタンへフォーカスを戻す
        focusBack: button,
        items: target.items.map((item) => ({
          ...item,
          // 再描画で項目の処理が置き換わっても、今の要素の項目を呼ぶ
          enabled: () =>
            current?.items.find((one) => one.label === item.label)?.enabled() ??
            false,
          run: () =>
            current?.items.find((one) => one.label === item.label)?.run(),
        })),
        avoid: () =>
          [
            current?.element.getBoundingClientRect(),
            button.getBoundingClientRect(),
            panel()?.getBoundingClientRect(),
          ].filter((rect): rect is DOMRect => rect !== undefined),
        onClose: () => {
          if (menu === opened) {
            menu = undefined;
          }
        },
      });
      menu = opened;
    },
    { signal },
  );

  return {
    refresh,
    hide,
    detach: () => {
      closeMenu();
      controller.abort();
      button.remove();
    },
  };
};
