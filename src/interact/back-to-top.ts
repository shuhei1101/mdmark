import { renderBackToTop } from "../parts/back-to-top.ts";
import { findScrollContainer, type ScrollContainer } from "./scroller.ts";

/** 差分のミニマップか余白の列と横の範囲が重なるとき、その部品の左端からボタンの右端までに空ける幅（px） */
export const BACK_TO_TOP_AVOID_GAP_PX = 8;

/** ボタンが回避する部品のうち、ページに配置する差分のミニマップの帯 */
const MINIMAP_SELECTOR = ".mdmark-diff-minimap";

/** ボタンが回避する部品のうち、描く先の要素の子の余白の列 */
const COMMENT_MARGIN_SELECTOR = ":scope > .mdmark-comment-margin";

/** 動きを減らす設定のメディアクエリ */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** スクロールする場所の画面の中の矩形（スクロールバーを除き、右端と下端は画面の中に収める） */
type AreaRect = {
  top: number;
  right: number;
  bottom: number;
  height: number;
};

/** スクロールする場所の画面の中の矩形を返却する */
function areaRect({ target, page }: ScrollContainer): AreaRect {
  const { clientWidth, clientHeight } = document.documentElement;
  if (page) {
    return {
      top: 0,
      right: clientWidth,
      bottom: clientHeight,
      height: clientHeight,
    };
  }
  const rect = target.getBoundingClientRect();
  const top = rect.top + target.clientTop;
  const left = rect.left + target.clientLeft;
  return {
    top,
    right: Math.min(left + target.clientWidth, clientWidth),
    bottom: Math.min(top + target.clientHeight, clientHeight),
    height: target.clientHeight,
  };
}

/** 描く先の要素の `--mdmark-sticky-top` の px を返却する（指定が無ければ 0） */
function stickyTop(el: HTMLElement): number {
  const value = getComputedStyle(el)
    .getPropertyValue("--mdmark-sticky-top")
    .trim();
  return value === "" ? 0 : Number.parseFloat(value);
}

/** HTML 文字列からボタンの要素を作る */
function createButton(): HTMLButtonElement {
  const template = document.createElement("template");
  template.innerHTML = renderBackToTop({ hidden: true });
  return template.content.firstElementChild as HTMLButtonElement;
}

/** 描く先の要素の子の末尾に先頭へ戻るボタンを配置し、スクロールの量で出し分け、スクロールする場所の右下でミニマップと余白の列を回避して配置し、押すと先頭へ戻す。返却する関数でボタンと受け取りを解除する */
export function attachBackToTop(options: {
  /** 描く先の要素 */
  el: HTMLElement;
  /** 押した後にフォーカスを移す本文の列 */
  content: HTMLElement;
}): () => void {
  const { el, content } = options;
  const button = createButton();
  el.append(button);
  const container = findScrollContainer(el);
  let addedTabIndex = false;

  /** 出すかを決め、出すときはスクロールする場所の右下で、回避する部品の左に配置する */
  const place = (): void => {
    const area = areaRect(container);
    const scrolled = area.top - el.getBoundingClientRect().top;
    button.hidden = scrolled < area.height;
    if (button.hidden) {
      return;
    }
    const { clientWidth, clientHeight } = document.documentElement;
    button.style.setProperty(
      "--mdmark-back-to-top-right",
      `calc(${clientWidth - area.right}px + var(--mdmark-back-to-top-gap))`,
    );
    button.style.setProperty(
      "--mdmark-back-to-top-bottom",
      `calc(${clientHeight - area.bottom}px + var(--mdmark-back-to-top-gap))`,
    );
    const obstacles = [
      ...document.querySelectorAll<HTMLElement>(`body > ${MINIMAP_SELECTOR}`),
      ...el.querySelectorAll<HTMLElement>(COMMENT_MARGIN_SELECTOR),
    ];
    const { left, right } = button.getBoundingClientRect();
    let box = { left, right };
    // 横の範囲（部品の左端から間の分だけ左までを含む）が重なる部品の左へ、順にずらす
    for (const obstacle of obstacles) {
      const rect = obstacle.getBoundingClientRect();
      if (
        rect.width === 0 ||
        box.left >= rect.right ||
        rect.left - BACK_TO_TOP_AVOID_GAP_PX >= box.right
      ) {
        continue;
      }
      const shifted = rect.left - BACK_TO_TOP_AVOID_GAP_PX;
      button.style.setProperty(
        "--mdmark-back-to-top-right",
        `${clientWidth - shifted}px`,
      );
      box = { left: shifted - (box.right - box.left), right: shifted };
    }
  };

  // スクロール・画面の大きさ・回避する部品の出し入れのたびに、1 フレームに 1 回だけもう一度配置する
  let frame: number | undefined;
  const schedule = (): void => {
    if (frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      place();
    });
  };

  /** 描いた文書の先頭へスクロールし、本文の列へフォーカスを移す */
  const backToTop = (): void => {
    const behavior: ScrollBehavior = matchMedia(REDUCED_MOTION_QUERY).matches
      ? "auto"
      : "smooth";
    const offset = el.getBoundingClientRect().top - areaRect(container).top;
    if (container.page) {
      window.scrollTo({
        top: window.scrollY + offset - stickyTop(el),
        behavior,
      });
    } else {
      container.target.scrollTo({
        top: container.target.scrollTop + offset,
        behavior,
      });
    }
    if (!content.hasAttribute("tabindex")) {
      content.tabIndex = -1;
      addedTabIndex = true;
    }
    content.focus({ preventScroll: true });
  };

  button.addEventListener("click", backToTop);
  // 画面全体なら画面のスクロール、祖先の要素なら祖先の外のスクロールでも位置が変わるためキャプチャーフェーズで受ける
  const scrollSource: Window | Document = container.page ? window : document;
  scrollSource.addEventListener("scroll", schedule, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true });
  observer.observe(el, { childList: true });
  place();

  return () => {
    scrollSource.removeEventListener("scroll", schedule, { capture: true });
    window.removeEventListener("resize", schedule);
    observer.disconnect();
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
    button.remove();
    if (addedTabIndex) {
      content.removeAttribute("tabindex");
    }
  };
}
