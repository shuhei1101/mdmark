// 脚注の操作（実装の mount が付ける振る舞いのモック）: 番号のツールチップをポインターとフォーカスで開き、Esc で閉じる。
// 番号を押す（Enter を含む）と、閉じた末尾の一覧を開いて該当の項目へフォーカスを移す。
// 一覧の戻るリンクを押すと、本文の番号へフォーカスを戻す。印刷の前に一覧を開き、印刷の後に閉じ直す

// sample.js・glossary.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // ポインターが番号とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
  const CLOSE_DELAY_MS = 150;
  // ツールチップと画面の端との間に空ける幅（px）
  const VIEWPORT_MARGIN_PX = 16;

  // [data-mock-static]: 部品のモックで開いた状態を見せるだけの番号。操作を付けず、置く位置だけを当てる
  const refs = [...document.querySelectorAll(".mdmark-fn-ref:not([data-mock-static])")];
  const staticRefs = [...document.querySelectorAll(".mdmark-fn-ref[data-mock-static]")];
  const closeTimers = new Map();

  /** ツールチップを番号の下（収まらなければ上）に、画面からはみ出さないよう置く。 */
  const place = (ref) => {
    const anchor = ref.querySelector(".mdmark-fn-link").getBoundingClientRect();
    const tip = ref.querySelector(".mdmark-fn-tip");
    tip.style.position = "fixed";
    const { width, height } = tip.getBoundingClientRect();
    const above = ref.hasAttribute("data-mock-static")
      ? ref.dataset.mockSide === "above"
      : anchor.bottom + height > window.innerHeight && anchor.top - height >= 0;
    ref.classList.toggle("is-above", above);
    const left = Math.min(anchor.left, window.innerWidth - width - VIEWPORT_MARGIN_PX);
    tip.style.top = `${above ? anchor.top - height : anchor.bottom}px`;
    tip.style.bottom = "auto";
    tip.style.left = `${Math.max(left, VIEWPORT_MARGIN_PX)}px`;
  };

  /** ツールチップを閉じ、置いた位置を外す。 */
  const close = (ref) => {
    clearTimeout(closeTimers.get(ref));
    ref.classList.remove("is-open", "is-above");
    const tip = ref.querySelector(".mdmark-fn-tip");
    tip.style.position = tip.style.top = tip.style.bottom = tip.style.left = "";
  };

  /** ほかのツールチップを閉じてから開く。Esc で閉じた後は、番号を離れるまで開き直さない。 */
  const open = (ref) => {
    clearTimeout(closeTimers.get(ref));
    if (ref.classList.contains("is-dismissed")) return;
    for (const other of refs) if (other !== ref) close(other);
    ref.classList.add("is-open");
    place(ref);
  };

  /** ポインターもフォーカスも番号とツールチップを離れたら、少し待って閉じる。 */
  const closeLater = (ref) => {
    clearTimeout(closeTimers.get(ref));
    closeTimers.set(
      ref,
      setTimeout(() => {
        if (ref.matches(":hover, :focus-within")) return;
        close(ref);
        ref.classList.remove("is-dismissed");
      }, CLOSE_DELAY_MS),
    );
  };

  /** 文書の中から、href の # の後ろの id の要素を引く（同じ id を見本ごとに持つため、同じ article の中だけを探す）。 */
  const target = (from, href) => from.closest(".mdmark")?.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);

  for (const ref of refs) {
    ref.addEventListener("pointerenter", () => open(ref));
    ref.addEventListener("pointerleave", () => closeLater(ref));
    ref.addEventListener("focusin", () => open(ref));
    ref.addEventListener("focusout", () => closeLater(ref));

    // 番号を押す: 閉じた一覧を開き、該当の項目を画面に入れてフォーカスを移す
    ref.querySelector(".mdmark-fn-link").addEventListener("click", (event) => {
      const item = target(ref, event.currentTarget.getAttribute("href"));
      if (!item) return;
      event.preventDefault();
      // 移った先の項目に重ならないよう、ポインターが番号を離れるまで開き直さない
      close(ref);
      ref.classList.add("is-dismissed");
      const list = item.closest("details");
      if (list) list.open = true;
      item.scrollIntoView({ block: "center" });
      item.focus();
    });
  }

  // 戻るリンクを押す: 本文の番号を画面に入れてフォーカスを移す
  for (const back of document.querySelectorAll(".mdmark-fn-back")) {
    back.addEventListener("click", (event) => {
      const link = target(back, back.getAttribute("href"));
      if (!link) return;
      event.preventDefault();
      link.scrollIntoView({ block: "center" });
      link.focus();
    });
  }

  // Esc: 開いているツールチップを閉じる。フォーカスは番号に残す
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const ref of refs) {
      if (!ref.classList.contains("is-open")) continue;
      close(ref);
      ref.classList.add("is-dismissed");
    }
  });

  // 画面のスクロールと幅の変化: 開いているツールチップを番号に付いて動かす
  const placeOpen = () => {
    for (const ref of [...refs, ...staticRefs]) if (ref.classList.contains("is-open")) place(ref);
  };
  window.addEventListener("scroll", placeOpen, { capture: true, passive: true });
  window.addEventListener("resize", placeOpen);
  placeOpen();

  // 印刷の前: ツールチップを閉じ、閉じた一覧を開く。印刷の後: 印刷の前に閉じていた一覧を閉じ直す
  const openedForPrint = [];
  window.addEventListener("beforeprint", () => {
    for (const ref of refs) close(ref);
    for (const list of document.querySelectorAll("details.mdmark-footnotes:not([open])")) {
      list.open = true;
      openedForPrint.push(list);
    }
  });
  window.addEventListener("afterprint", () => {
    for (const list of openedForPrint.splice(0)) list.open = false;
  });
}
