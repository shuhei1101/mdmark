// 先頭へ戻るボタンのモック: mount が描いた文書に、スクロールの位置で出し分けるボタンを付ける

/** 出し始めるスクロールの量の案: スクロールする場所の高さに掛ける割合 */
const THRESHOLD_RATIO = { viewport: 1, half: 0.5 };

/** ボタンとスクロールする場所の端との間（--mdmark-back-to-top-gap の px） */
const GAP_PX = 16;

/** 避ける部品とボタンの間 */
const AVOID_GAP_PX = 8;

/** 上向きの矢印と線のアイコン（lucide の arrow-up-to-line） */
const ICON =
  '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14"/><path d="m18 13-6-6-6 6"/><path d="M12 7v14"/></svg>';

/** 描く先の要素に一番近い、縦にスクロールする祖先の要素を返す。無ければ null（画面全体がスクロールする） */
function findScroller(root) {
  for (let node = root.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/** スクロールする場所の、画面の中の見えている矩形（スクロールバーを除く） */
function areaRect(scroller) {
  if (!scroller) {
    const { clientWidth, clientHeight } = document.documentElement;
    return { top: 0, right: clientWidth, bottom: clientHeight, height: clientHeight };
  }
  const rect = scroller.getBoundingClientRect();
  const top = rect.top + scroller.clientTop;
  const left = rect.left + scroller.clientLeft;
  return { top, right: left + scroller.clientWidth, bottom: top + scroller.clientHeight, height: scroller.clientHeight };
}

/** 2 つの矩形が重なるか */
function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** 描く先の要素に先頭へ戻るボタンを付ける。threshold は出し始める量の案、avoidMargin は余白の列を避けるか */
export function attachBackToTop(root, { threshold, avoidMargin }) {
  const scroller = findScroller(root);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mdmark-back-to-top";
  button.setAttribute("aria-label", "先頭へ戻る");
  button.title = "先頭へ戻る";
  button.hidden = true;
  button.innerHTML = ICON;
  root.append(button);

  /** 出すかを決め、出すときはスクロールする場所の右下で、ミニマップと余白の列を避けた位置に置く */
  function update() {
    const area = areaRect(scroller);
    const scrolled = area.top - root.getBoundingClientRect().top;
    button.hidden = scrolled < area.height * THRESHOLD_RATIO[threshold];
    if (button.hidden) return;

    const { clientWidth, clientHeight } = document.documentElement;
    const size = button.offsetWidth;
    let right = clientWidth - area.right + GAP_PX;
    const bottom = clientHeight - area.bottom + GAP_PX;
    const obstacles = [document.querySelector(".mdmark-diff-minimap")];
    if (avoidMargin) obstacles.push(root.querySelector(":scope > .mdmark-comment-margin"));
    // 避ける部品と重なるときは、その部品の左へずらす（ミニマップ・余白の列の順に見る）
    for (const obstacle of obstacles) {
      if (!obstacle) continue;
      const rect = obstacle.getBoundingClientRect();
      const box = {
        left: clientWidth - right - size,
        right: clientWidth - right,
        top: clientHeight - bottom - size,
        bottom: clientHeight - bottom,
      };
      if (overlaps(box, rect)) right = clientWidth - rect.left + AVOID_GAP_PX;
    }
    button.style.setProperty("--mdmark-back-to-top-right", `${right}px`);
    button.style.setProperty("--mdmark-back-to-top-bottom", `${bottom}px`);
  }

  // 押したとき: 描いた文書の先頭へスクロールし、フォーカスを本文の列へ移す（動きを減らす設定では一度に移る）
  button.addEventListener("click", () => {
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const offset = root.getBoundingClientRect().top - areaRect(scroller).top;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollTop + offset, behavior });
    } else {
      const stickyTop = Number.parseFloat(getComputedStyle(root).getPropertyValue("--mdmark-sticky-top"));
      window.scrollTo({ top: window.scrollY + offset - stickyTop, behavior });
    }
    const content = root.querySelector(":scope > .mdmark-content");
    content.tabIndex = -1;
    content.focus({ preventScroll: true });
  });

  // スクロールと画面の大きさの変化・ミニマップの出し入れのたびに、1 フレームに 1 回だけ置き直す
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  (scroller ?? window).addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.body, { childList: true });
  update();
}
