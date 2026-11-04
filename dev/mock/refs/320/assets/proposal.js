// #320 の案を、配布物の mount が描いた右側の目次に当てる: 上端のラベルの削除とボタンの並び替え、ピン止めのアイコンの差し替え、hover で開く位置。
// 見出しの線と区切り線の案は proposal.css だけで当たる

/** lucide のアイコンの線（lucide-static v1.67.0、ISC） */
const ICON_PATHS = {
  "panel-right": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  "panel-right-dashed": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 14v1"/><path d="M15 19v2"/><path d="M15 3v2"/><path d="M15 9v1"/>',
  "panel-right-open": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/>',
  "panel-right-close": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  "pin-off": '<path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',
};

/** ピン止めのアイコンの案: 押す前（off）と押した後（on）のアイコン */
export const PIN_ICONS = {
  // A（推奨）: 点線の右の列 → 実線の右の列。目次を右の列に留めることを形で示す
  panel: { off: "panel-right-dashed", on: "panel-right" },
  // B: 右の列を開く矢印 → 閉じる矢印。押すと起きることを矢印で示す
  arrow: { off: "panel-right-open", on: "panel-right-close" },
  // C: ピン → 斜線の入ったピン。押した後は外す操作を示す
  pin: { off: "pin", on: "pin-off" },
};

/** 右端の線の上端から、枠で覆う高さ（線 3 本分） */
const RAIL_COVER_PX = 32;

/** アイコンの名前から、配布物の iconSvg と同じ属性の SVG を返す */
export function iconSvg(name) {
  return `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** 目次の頭: 「目次」のラベルを削除し、まとめて開閉するボタンの並びをピン止めのボタンの前へ移す */
export function reshapeHead(aside) {
  const head = aside.querySelector(".mdmark-side-toc-head");
  head.querySelector(".mdmark-side-toc-title").remove();
  // sections がオフの文書はまとめて開閉するボタンを持たない
  const actions = aside.querySelector(".mdmark-side-toc-actions");
  if (actions) head.prepend(actions);
}

/** ピン止めのボタンのアイコンを、案の押す前・押した後のアイコンに差し替え、押すたびに付け替える */
export function applyPinIcon(pin, icon) {
  const render = () => {
    const pressed = pin.getAttribute("aria-pressed") === "true";
    pin.querySelector("svg").outerHTML = iconSvg(PIN_ICONS[icon][pressed ? "on" : "off"]);
  };
  render();
  new MutationObserver(render).observe(pin, { attributes: true, attributeFilter: ["aria-pressed"] });
}

/** 描く先の要素に最も近い、縦にスクロールする祖先の要素を返す（無ければ null で、画面全体がスクロールする） */
function scrollParent(element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/** 案 A の位置: 目次の枠の上端を、見えている枠の上端と描いた文書の上端の低いほうに合わせ、右端を右側の目次の右端に合わせ、右端の線の上端まで届く最小の高さを入れる */
export function followRail(aside) {
  const root = aside.closest(".mdmark");
  const rail = aside.querySelector(".mdmark-side-toc-rail");
  const scroller = scrollParent(root);
  const update = () => {
    const style = getComputedStyle(root);
    const stickyTop = Number.parseFloat(style.getPropertyValue("--mdmark-sticky-top")) || 0;
    const space = Number.parseFloat(style.getPropertyValue("--mdmark-space")) * Number.parseFloat(style.fontSize);
    // 見えている枠の上端: スクロールする要素の中なら要素の上端、画面全体なら画面の上端
    const frameTop = (scroller ? scroller.getBoundingClientRect().top : 0) + stickyTop;
    const top = Math.max(frameTop, root.getBoundingClientRect().top) + space;
    aside.style.setProperty("--proposal-panel-top", `${top}px`);
    aside.style.setProperty("--proposal-panel-end", `${document.documentElement.clientWidth - aside.getBoundingClientRect().right}px`);
    // 線から枠へポインターを動かしても hover が切れないよう、枠の下端を線の上から 3 本分の位置より下にする
    const reach = rail.getBoundingClientRect().top + RAIL_COVER_PX - top;
    aside.style.setProperty("--proposal-panel-min-height", `${Math.max(reach, 0)}px`);
  };
  update();
  (scroller ?? window).addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
}

/** 描いた文書の右側の目次に案を当てる */
export function applyProposal(root, { icon, position }) {
  const aside = root.querySelector(".mdmark-side-toc");
  reshapeHead(aside);
  applyPinIcon(aside.querySelector(".mdmark-side-toc-pin"), icon);
  if (position === "viewport") followRail(aside);
}
