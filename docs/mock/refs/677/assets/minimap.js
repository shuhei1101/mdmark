// 拡大した図のミニマップのモックの操作（#677）
// diagram.js が描いた図の枠（文書の中と全画面のモーダル）に、パネルのミニマップのボタンと、表示する枠の隅に重ねるミニマップを付ける。
// 祖先の [data-mock-minimap-default="off"] は最初にボタンを押していない状態で始め（案 A）、[data-mock-minimap-at="start"] はミニマップを左下に配置する（モックだけの指定）
const MINIMAP_LABEL = "ミニマップ";
const MINIMAP_TITLE = "ミニマップを出す・隠す";
// ミニマップの外枠の最大の大きさ（px）。図の縦横の比を保って、この中に収める
const MINIMAP_MAX = { width: 160, height: 120 };
// 図の枠の幅が 30rem 未満のときの最大の大きさ（px）
const MINIMAP_MAX_NARROW = { width: 112, height: 84 };
const NARROW_PX = 480;
// 表示する枠の端からミニマップまでの間（px）
const MINIMAP_INSET = 6;
// 押した位置へ移す動きの時間（ミリ秒）。動きを減らす設定では 0
const MOVE_MS = 200;
// 折りたたんだ地図のアイコン（24 の格子の線のアイコン）
const MAP_ICON =
  '<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>';

// 全画面を開いた図のボタンの状態（全画面のモーダルが引き継ぐ）
let openerPressed;
addEventListener(
  "click",
  (event) => {
    const opener = event.target.closest('[data-tool="fullscreen"]');
    if (opener) openerPressed = opener.closest("figure")?.querySelector('[data-tool="minimap"]')?.getAttribute("aria-pressed") === "true";
  },
  true,
);

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 表示する枠のスクロールを、時間をかけて目標の位置へ移す */
const scrollViewport = (viewport, left, top) => {
  viewport.scrollTo({ left, top, behavior: reducedMotion() ? "instant" : "smooth" });
};

const attachMinimap = (box) => {
  if (box.dataset.mockMinimap) return;
  box.dataset.mockMinimap = "on";
  const figure = box.closest("figure");
  const viewport = box.querySelector(".mdmark-diagram-viewport");
  const sizer = box.querySelector(".mdmark-diagram-sizer");
  const stage = box.querySelector(".mdmark-diagram-stage");
  const zoomGroup = box.querySelector('.mdmark-diagram-tools-group[data-group="zoom"]');
  if (!viewport || !sizer || !stage || !zoomGroup) return;
  const modal = Boolean(box.closest("dialog"));

  // パネルのボタン: 拡大のボタンの後ろ（全画面のボタンの前）に配置する
  const button = document.createElement("button");
  button.className = "mdmark-diagram-tool mdmark-diagram-minimap-tool";
  button.type = "button";
  button.dataset.tool = "minimap";
  button.setAttribute("aria-label", MINIMAP_LABEL);
  button.title = MINIMAP_TITLE;
  button.innerHTML = MAP_ICON;
  zoomGroup.querySelector('[data-tool="in"]').after(button);
  const startOff = figure.closest('[data-mock-minimap-default="off"]');
  button.setAttribute("aria-pressed", String(modal && openerPressed !== undefined ? openerPressed : !startOff));

  // ミニマップ: 図の中身を縮めた複製と、今見えている範囲の枠線
  const map = document.createElement("div");
  map.className = "mdmark-diagram-minimap";
  map.setAttribute("aria-hidden", "true");
  if (figure.closest('[data-mock-minimap-at="start"]')) map.dataset.at = "start";
  const copy = document.createElement("div");
  copy.className = "mdmark-diagram-minimap-copy";
  // 複製の中のボタン・リンク・フォーカスできる要素を、フォーカスと読み上げの対象から除く
  copy.inert = true;
  const view = document.createElement("div");
  view.className = "mdmark-diagram-minimap-view";
  map.append(copy, view);
  box.append(map);

  const size = () => ({ width: stage.offsetWidth, height: stage.offsetHeight });
  let ratio = 1;
  const redrawCopy = () => {
    const { width, height } = size();
    const max = box.clientWidth < NARROW_PX ? MINIMAP_MAX_NARROW : MINIMAP_MAX;
    ratio = Math.min(max.width / width, max.height / height);
    map.style.width = `${width * ratio}px`;
    map.style.height = `${height * ratio}px`;
    const clone = stage.cloneNode(true);
    clone.removeAttribute("id");
    for (const element of clone.querySelectorAll("[id]")) element.removeAttribute("id");
    clone.style.transform = `scale(${ratio})`;
    copy.replaceChildren(clone);
  };

  const scale = () => sizer.offsetWidth / size().width;
  const fits = () => sizer.offsetWidth <= viewport.clientWidth + 1 && sizer.offsetHeight <= viewport.clientHeight + 1;

  /** 見えている範囲の枠線と、ミニマップを出すかを、今の倍率とスクロールに合わせる */
  const sync = () => {
    const shown = button.getAttribute("aria-pressed") === "true" && !fits();
    map.hidden = !shown;
    if (!shown) return;
    // 横のスクロールバーとリサイズハンドルの上に重ねないよう、どちらか高い方の上端に合わせる
    const handle = box.querySelector(".mdmark-diagram-resize");
    const floor = Math.min(viewport.offsetTop + viewport.clientHeight, handle ? handle.offsetTop : Infinity);
    map.style.insetBlockEnd = `${box.clientHeight - floor + MINIMAP_INSET}px`;
    const s = scale();
    const left = viewport.scrollLeft / s;
    const top = viewport.scrollTop / s;
    const width = Math.min(size().width, viewport.clientWidth / s);
    const height = Math.min(size().height, viewport.clientHeight / s);
    view.style.left = `${left * ratio}px`;
    view.style.top = `${top * ratio}px`;
    view.style.width = `${width * ratio}px`;
    view.style.height = `${height * ratio}px`;
  };

  button.addEventListener("click", () => {
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    sync();
  });

  /** ミニマップの中の位置（px）を、表示する枠の中央へ移す */
  const center = (x, y, smooth) => {
    const s = scale();
    const left = (x / ratio) * s - viewport.clientWidth / 2;
    const top = (y / ratio) * s - viewport.clientHeight / 2;
    if (smooth) scrollViewport(viewport, left, top);
    else {
      viewport.scrollLeft = left;
      viewport.scrollTop = top;
    }
  };

  // 見えている範囲の外を押すと、その位置を中央へ移す。枠線を押したまま動かすと、動きに合わせて図を移す
  let drag;
  map.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = map.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (event.target === view) {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      map.setPointerCapture(event.pointerId);
      map.classList.add("is-dragging");
      return;
    }
    center(x, y, true);
  });
  map.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const s = scale();
    viewport.scrollLeft = drag.left + ((event.clientX - drag.x) / ratio) * s;
    viewport.scrollTop = drag.top + ((event.clientY - drag.y) / ratio) * s;
  });
  const endDrag = () => {
    drag = undefined;
    map.classList.remove("is-dragging");
  };
  map.addEventListener("pointerup", endDrag);
  map.addEventListener("pointercancel", endDrag);

  viewport.addEventListener("scroll", sync, { passive: true });
  new ResizeObserver(sync).observe(viewport);
  // 倍率（sizer の大きさ）と、図の中身の描き直しに合わせる
  new MutationObserver(sync).observe(sizer, { attributes: true, attributeFilter: ["style"] });
  new MutationObserver(() => {
    redrawCopy();
    sync();
  }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  redrawCopy();
  sync();
  // カタログで拡大した状態を見せる（モックだけの指定。data-mock-zoom の倍率を適用した後に枠線を合わせる）
  requestAnimationFrame(sync);
};

const scan = (root) => {
  for (const box of root.querySelectorAll?.(".mdmark-diagram-box") ?? []) attachMinimap(box);
};

new MutationObserver((records) => {
  for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) scan(node.matches?.(".mdmark-diagram-box") ? node.parentElement : node);
}).observe(document.documentElement, { childList: true, subtree: true });
addEventListener("load", () => scan(document));
