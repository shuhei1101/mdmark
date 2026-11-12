import { DRAG_THRESHOLD } from "./zoom.ts";

/** タップしても操作中にしない、表示する枠の中の要素（ノード・線・グラフの項目・ボタン・リンク・ツールチップのマーカー） */
const NOT_BLANK_SELECTOR = [
  ".mdmark-diagram-node",
  "[data-node]",
  ".mdmark-diagram-wire",
  ".mdmark-diagram-wire-hit",
  ".map-wire-hit",
  ".map-group-head",
  "[data-tip-owner]",
  "button",
  "a",
].join(", ");

/** 操作中の表示するノードに付ける属性 */
const ACTIVE_ATTRIBUTE = "data-touch-active";

/** タッチで表示する枠の余白をタップすると表示するノードに `data-touch-active` を付け、外のタッチの `pointerdown` で外す。付けた操作を削除する関数を返却する */
export function attachDiagramTouch(options: {
  box: HTMLElement;
  viewport: HTMLElement;
}): () => void {
  const { box, viewport } = options;
  const controller = new AbortController();
  const { signal } = controller;
  let press: { x: number; y: number; id: number } | undefined;
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      press =
        event.pointerType === "touch"
          ? { x: event.clientX, y: event.clientY, id: event.pointerId }
          : undefined;
    },
    { signal },
  );
  viewport.addEventListener(
    "pointerup",
    (event) => {
      const start = press;
      press = undefined;
      if (
        event.pointerType !== "touch" ||
        !start ||
        start.id !== event.pointerId
      ) {
        return;
      }
      const moved = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      const target = event.target instanceof Element ? event.target : null;
      if (moved > DRAG_THRESHOLD || target?.closest(NOT_BLANK_SELECTOR)) {
        return;
      }
      box.setAttribute(ACTIVE_ATTRIBUTE, "");
    },
    { signal },
  );
  viewport.addEventListener(
    "pointercancel",
    () => {
      press = undefined;
    },
    { signal },
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.pointerType === "touch" &&
        box.hasAttribute(ACTIVE_ATTRIBUTE) &&
        !(event.target instanceof Node && box.contains(event.target))
      ) {
        box.removeAttribute(ACTIVE_ATTRIBUTE);
      }
    },
    { signal, capture: true },
  );
  return () => {
    controller.abort();
    box.removeAttribute(ACTIVE_ATTRIBUTE);
  };
}
