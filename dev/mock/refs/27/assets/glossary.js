// 用語のツールチップの操作（実装の mount が付ける振る舞いのモック）: ポインターとフォーカスで開き、Esc で閉じ、
// 親の枠で切れないよう画面に対して置き、下に収まらないときは用語の上に開く

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // ポインターが用語とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
  const CLOSE_DELAY_MS = 150;
  // ツールチップと画面の端との間に空ける幅（px）
  const VIEWPORT_MARGIN_PX = 16;

  // [data-mock-static]: 部品のモックで開いた状態を見せるだけの用語。操作を付けない
  const wraps = [...document.querySelectorAll(".mdmark-term-wrap:not([data-mock-static])")];
  const closeTimers = new Map();

  /** ツールチップを用語の下（収まらなければ上）に、画面からはみ出さないよう置く。 */
  const place = (wrap) => {
    const term = wrap.querySelector(".mdmark-term");
    const tip = wrap.querySelector(".mdmark-term-tip");
    const rect = term.getBoundingClientRect();
    tip.style.position = "fixed";
    const { width, height } = tip.getBoundingClientRect();
    const above = rect.bottom + height > window.innerHeight && rect.top - height >= 0;
    wrap.classList.toggle("is-above", above);
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN_PX), window.innerWidth - width - VIEWPORT_MARGIN_PX);
    tip.style.top = `${above ? rect.top - height : rect.bottom}px`;
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
    for (const wrap of wraps) if (wrap.classList.contains("is-open")) place(wrap);
  };
  window.addEventListener("scroll", placeOpen, { capture: true, passive: true });
  window.addEventListener("resize", placeOpen);

  // 印刷の前: 開いているツールチップを閉じる（紙には出さない）
  window.addEventListener("beforeprint", () => {
    for (const wrap of wraps) close(wrap);
  });
}
