// 埋め込んだ HTML と data-hint のヒントのモック（実装の mount が埋め込んだ HTML に付ける振る舞い）。
// .mdmark-html: 列より広いときだけ中で横にスクロールさせる。
// [data-hint]: ブロックの要素は右上の印、行内の要素は破線の下線で示す。ブロックは印、行内は要素そのものがポインターとフォーカスを受け、図のツールチップと同じ見た目のツールチップを開く。
// 上に乗っても消えず、Esc で閉じる（フォーカスは要素に残す）。祖先に data-mock-hints="off" があるときは何も付けない（機能 hints をオフにした文書）。
// モックの見本だけの指定: data-mock-open（その要素のツールチップを開いたまま見せる）

// sample.js・glossary.js・diagram.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // ポインターが要素とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）と、要素との間・画面の端との間に空ける幅（px）
  const CLOSE_DELAY_MS = 150;
  const TIP_GAP_PX = 6;
  const VIEWPORT_MARGIN_PX = 16;

  // 情報のアイコン（図の箱の印と同じ lucide の形）
  const INFO_ICON = '<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

  // ヒントのツールチップの id の通し番号
  let tipCount = 0;

  // 開いているツールチップの持ち主と、閉じるのを待つタイマー
  let current = null;
  let closeTimer = null;

  // モックの見本で開いたままにする要素（操作では開け閉めしない）
  const pinned = new Set();

  /** ツールチップを要素の下（収まらなければ上）に、画面からはみ出さないよう置く。開いたままの見本は収まり方によらず下に置く。 */
  const place = (owner) => {
    const tip = owner.mdmarkHintTip;
    const a = owner.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const above = !pinned.has(owner) && a.bottom + TIP_GAP_PX + height > window.innerHeight && a.top - TIP_GAP_PX - height >= 0;
    tip.style.left = `${Math.max(VIEWPORT_MARGIN_PX, Math.min(a.left, window.innerWidth - width - VIEWPORT_MARGIN_PX))}px`;
    tip.style.top = `${above ? a.top - TIP_GAP_PX - height : a.bottom + TIP_GAP_PX}px`;
  };

  /** 開いているツールチップを閉じる。 */
  const close = () => {
    clearTimeout(closeTimer);
    if (!current) return;
    current.mdmarkHintTip.hidden = true;
    current.classList.remove("is-hint-open");
    current = null;
  };

  /** ほかのツールチップを閉じてから、この要素のツールチップを開く。開いたままの見本は開け閉めしない。 */
  const open = (owner) => {
    clearTimeout(closeTimer);
    if (pinned.has(owner) || owner === current) return;
    close();
    owner.mdmarkHintTip.hidden = false;
    owner.classList.add("is-hint-open");
    place(owner);
    current = owner;
  };

  /** ポインターもフォーカスも要素とツールチップを離れたら、少し待って閉じる。 */
  const closeLater = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (current && (current.mdmarkHintTip.matches(":hover") || current.mdmarkHintTrigger.matches(":hover, :focus"))) return;
      close();
    }, CLOSE_DELAY_MS);
  };

  /** data-hint を持つ要素に、印か下線・フォーカス・ツールチップを付ける。 */
  const attachHint = (owner, root) => {
    tipCount += 1;
    const tip = document.createElement("div");
    tip.className = "mdmark-diagram-tip mdmark-hint-tip";
    tip.id = `mdmark-hint-tip-${tipCount}`;
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    tip.textContent = owner.dataset.hint;
    root.append(tip);
    owner.mdmarkHintTip = tip;

    // 行内の要素は下線を引いて要素そのものを、それ以外は右上に置く印をツールチップの持ち主にする（ブロックの印の外では開かない）
    const inline = getComputedStyle(owner).display === "inline";
    owner.classList.add(inline ? "mdmark-hint-inline" : "mdmark-hint-block");
    let trigger = owner;
    if (inline) {
      // 元からフォーカスできない要素（span など）だけを Tab で辿れるようにする
      if (owner.tabIndex < 0) owner.tabIndex = 0;
    } else {
      owner.insertAdjacentHTML("beforeend", `<button class="mdmark-hint-mark" type="button" aria-label="説明">${INFO_ICON}</button>`);
      trigger = owner.lastElementChild;
    }
    trigger.setAttribute("aria-describedby", tip.id);
    owner.mdmarkHintTrigger = trigger;

    trigger.addEventListener("pointerenter", () => open(owner));
    trigger.addEventListener("pointerleave", closeLater);
    trigger.addEventListener("focus", () => open(owner));
    trigger.addEventListener("blur", closeLater);
    tip.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    tip.addEventListener("pointerleave", closeLater);
  };

  for (const root of document.querySelectorAll(".mdmark-html")) {
    // 列より広い HTML だけを、中で横にスクロールさせる（幅が変わったら判定し直す）
    new ResizeObserver(() => {
      const wide = root.scrollWidth > root.clientWidth + 1;
      root.classList.toggle("is-wide", wide);
      if (wide) root.tabIndex = 0;
      else root.removeAttribute("tabindex");
    }).observe(root);

    if (root.closest('[data-mock-hints="off"]')) continue;
    for (const owner of root.querySelectorAll("[data-hint]")) attachHint(owner, root);
  }

  // Esc: 開いているツールチップを閉じ、フォーカスは要素に残す
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !current) return;
    close();
  });

  // 画面のスクロール（横にスクロールする HTML の中も含む）と幅の変化: 開いているツールチップを要素に付いて動かす
  const follow = () => {
    if (current) place(current);
    for (const owner of pinned) place(owner);
  };
  window.addEventListener("scroll", follow, { capture: true, passive: true });
  window.addEventListener("resize", follow);

  // 印刷の前: 開いているツールチップを閉じる（紙には出さない）
  window.addEventListener("beforeprint", close);

  // モックの見本: 開いた状態のまま見せる
  for (const owner of document.querySelectorAll("[data-hint][data-mock-open]")) {
    if (!owner.mdmarkHintTip) continue;
    pinned.add(owner);
    owner.mdmarkHintTip.hidden = false;
    owner.classList.add("is-hint-open");
  }
  requestAnimationFrame(follow);
}
