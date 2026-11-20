// #763 のモック: 配布物の mount で実物の map の図を描き、変える振る舞いだけを重ねる
import { mount } from "../../../../../dist/index.js";

/** Lucide の chevron-right / chevron-down（グループの開閉のボタンと同じアイコン） */
const CHEVRON = {
  right: '<svg class="mdmark-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  down: '<svg class="mdmark-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
};
/** 角のハンドルの 2 本の斜線 */
const CORNER = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 6 6 14M14 10l-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

/** 図を 1 つ描く。描いた後の再描画のたびに `patch` を当て直す */
export function drawMap(host, markdown, patch) {
  host.classList.add("mock-763", "one-row-head");
  mount(host, { markdown });
  const apply = () => patch?.(host);
  new MutationObserver(apply).observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
  apply();
}

/** 開閉のボタン: 列・メンバーの数の文字を消し、山形のアイコンにする（数はスクリーンリーダー向けの名前に残す） */
export function patchToggles(host) {
  for (const button of host.querySelectorAll(".map-er-toggle, .map-class-toggle")) {
    const icon = button.getAttribute("aria-expanded") === "false" ? CHEVRON.right : CHEVRON.down;
    if (button.dataset.mockIcon === icon) continue;
    button.dataset.mockIcon = icon;
    button.innerHTML = icon;
  }
}

/** データの印の向き: `reversed` の関連（`r{番号}`）は、線の先から元へ流す */
export function patchDirection(reversed) {
  return (host) => {
    for (const motion of host.querySelectorAll(".map-packet animateMotion")) {
      const wire = motion.parentElement?.getAttribute("data-wire");
      if (!reversed.has(wire) || motion.hasAttribute("keyPoints")) continue;
      motion.setAttribute("keyPoints", "1;0");
      motion.setAttribute("keyTimes", "0;1");
      motion.setAttribute("calcMode", "linear");
    }
  };
}

/** グループの右下の角に、ドラッグと矢印キーで大きさを変えるハンドルを置く（モックでは外のグループと線は追随しない） */
export function patchCorners(host) {
  for (const group of host.querySelectorAll(".mdmark-diagram-stage .map-group:not(.is-entered)")) {
    if (group.querySelector(":scope > .mock-group-corner")) continue;
    const title = group.querySelector(".map-group-title, .map-group-head")?.textContent?.trim() ?? "グループ";
    const corner = Object.assign(document.createElement("button"), {
      type: "button",
      className: "mock-group-corner",
      innerHTML: CORNER,
      title: "ドラッグで大きさを変える",
    });
    corner.setAttribute("aria-label", `${title}の大きさを変える`);
    group.append(corner);
    // 縁（左・右・下。上はタイトルの行の帯）を掴んでもグループを動かせるようにする。
    // 実物の移動の処理は、押した要素が .map-group-bar の中ならグループを動かすので、同じクラスの細い帯を置く
    for (const side of ["left", "right", "bottom"]) {
      const edge = Object.assign(document.createElement("div"), { className: `map-group-bar mock-group-edge is-${side}`, title: "ドラッグでグループを動かす" });
      edge.setAttribute("aria-hidden", "true");
      group.insertBefore(edge, corner);
    }
    const min = { w: group.offsetWidth, h: group.offsetHeight };
    const resize = (w, h) => {
      group.style.width = `${Math.max(min.w, w)}px`;
      group.style.height = `${Math.max(min.h, h)}px`;
    };
    corner.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      corner.setPointerCapture(event.pointerId);
      corner.classList.add("is-dragging");
      const start = { x: event.clientX, y: event.clientY, w: group.offsetWidth, h: group.offsetHeight };
      const move = (e) => resize(start.w + e.clientX - start.x, start.h + e.clientY - start.y);
      const up = () => {
        corner.classList.remove("is-dragging");
        corner.removeEventListener("pointermove", move);
        corner.removeEventListener("pointerup", up);
      };
      corner.addEventListener("pointermove", move);
      corner.addEventListener("pointerup", up);
    });
    corner.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 32 : 8;
      const delta = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step] }[event.key];
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      resize(group.offsetWidth + delta[0], group.offsetHeight + delta[1]);
    });
  }
}

/** 案 B の説明のマーカー: 列の名前にポインターを重ねたら、説明のボタンにポインターを重ねたのと同じにツールチップを出す */
export function patchNoteUnderline(host) {
  for (const button of host.querySelectorAll(".map-er-column .map-er-note")) {
    const name = button.closest(".map-er-column")?.querySelector(".map-er-name");
    if (!name || name.dataset.mockNote) continue;
    name.dataset.mockNote = "1";
    for (const type of ["pointerenter", "pointerleave"]) {
      name.addEventListener(type, (event) => {
        if (event.pointerType === "touch") return;
        button.dispatchEvent(new PointerEvent(type, { pointerType: event.pointerType }));
      });
    }
  }
}
