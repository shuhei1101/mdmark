// 用語のツールチップの操作（実装の mount が付ける振る舞いのモック）: ポインターとフォーカスで開き、Esc で閉じ、
// 親の枠で切れないよう画面に対して置き、下に収まらないときは用語の上に開く

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // ポインターが用語とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
  const CLOSE_DELAY_MS = 150;
  // ツールチップと画面の端との間に空ける幅（px）
  const VIEWPORT_MARGIN_PX = 16;

  // [data-mock-static]: 部品のモックで開いた状態を見せるだけの用語。操作を付けず、置く位置だけを当てる（[data-mock-side]: 置く向き）
  const wraps = [...document.querySelectorAll(".mdmark-term-wrap:not([data-mock-static])")];
  const staticWraps = [...document.querySelectorAll(".mdmark-term-wrap[data-mock-static]")];
  const closeTimers = new Map();

  /** ツールチップを用語の下（収まらなければ上）に、画面からはみ出さないよう置く。行をまたぐ用語は、下なら最後の行、上なら最初の行に付ける。 */
  const place = (wrap) => {
    const rects = wrap.querySelector(".mdmark-term").getClientRects();
    const first = rects[0];
    const last = rects[rects.length - 1];
    const tip = wrap.querySelector(".mdmark-term-tip");
    tip.style.position = "fixed";
    const { width, height } = tip.getBoundingClientRect();
    // 部品のモックの見本は、収まり方によらず書いた向き（data-mock-side="above" なら上、無ければ下）に置く
    const above = wrap.hasAttribute("data-mock-static")
      ? wrap.dataset.mockSide === "above"
      : last.bottom + height > window.innerHeight && first.top - height >= 0;
    wrap.classList.toggle("is-above", above);
    const anchor = above ? first : last;
    const left = Math.min(anchor.left, window.innerWidth - width - VIEWPORT_MARGIN_PX);
    tip.style.top = `${above ? first.top - height : last.bottom}px`;
    tip.style.bottom = "auto";
    tip.style.left = `${Math.max(left, VIEWPORT_MARGIN_PX)}px`;
  };

  /** ツールチップを閉じ、置いた位置を外す。 */
  const close = (wrap) => {
    clearTimeout(closeTimers.get(wrap));
    wrap.classList.remove("is-open", "is-above");
    const tip = wrap.querySelector(".mdmark-term-tip");
    tip.style.position = tip.style.top = tip.style.bottom = tip.style.left = "";
  };

  /** ほかのツールチップを閉じてから、このツールチップを開く。Esc で閉じた後は、用語を離れるまで開き直さない。 */
  const open = (wrap) => {
    clearTimeout(closeTimers.get(wrap));
    if (wrap.classList.contains("is-dismissed")) return;
    for (const other of wraps) if (other !== wrap) close(other);
    wrap.classList.add("is-open");
    place(wrap);
  };

  /** ポインターもフォーカスも用語とツールチップを離れたら、少し待って閉じる。 */
  const closeLater = (wrap) => {
    clearTimeout(closeTimers.get(wrap));
    closeTimers.set(
      wrap,
      setTimeout(() => {
        if (wrap.matches(":hover, :focus-within")) return;
        close(wrap);
        wrap.classList.remove("is-dismissed");
      }, CLOSE_DELAY_MS),
    );
  };

  for (const wrap of wraps) {
    wrap.addEventListener("pointerenter", () => open(wrap));
    wrap.addEventListener("pointerleave", () => closeLater(wrap));
    wrap.addEventListener("focusin", () => open(wrap));
    wrap.addEventListener("focusout", () => closeLater(wrap));
  }

  // Esc: 開いているツールチップを閉じる。フォーカスは用語に残す
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const wrap of wraps) {
      if (!wrap.classList.contains("is-open")) continue;
      close(wrap);
      wrap.classList.add("is-dismissed");
    }
  });

  // 画面のスクロールと幅の変化: 開いているツールチップを用語に付いて動かす
  const placeOpen = () => {
    for (const wrap of [...wraps, ...staticWraps]) if (wrap.classList.contains("is-open")) place(wrap);
  };
  window.addEventListener("scroll", placeOpen, { capture: true, passive: true });
  window.addEventListener("resize", placeOpen);
  placeOpen();

  // 印刷の前: 開いているツールチップを閉じる（紙には出さない）
  window.addEventListener("beforeprint", () => {
    for (const wrap of wraps) close(wrap);
  });
}
