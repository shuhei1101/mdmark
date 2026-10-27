// 右側の目次とまとめての開閉の操作（実装の interact のモック）。
// [data-mode]（hover・fixed）を持つ .mdmark-side-toc に、隣の本文の列（.mdmark-content）の h1〜h3 から目次を組み立て、目次を出すボタン・ピン止め・今いる節を受け持つ。
// すべて展開・すべて折りたたむ（[data-fold-all]）と、Shift を押しながらの入れ子の節の開閉は、右側の目次の有無によらず受け持つ。
// refs/19/assets/syntax.js の後に読む（1 つの節の開閉と、URL の #ID の見出しを囲む節を開く処理は syntax.js が持つ）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 右側の目次に載せる見出し
  const HEADING_SELECTOR = "h1[id], h2[id], h3[id]";
  // 今いる節を決める線の位置（画面の高さに対する、上端からの割合）。この線より上に入った最後の見出しを今いる節にする
  const CURRENT_LINE_RATIO = 0.25;

  // ボタンのアイコン（24 の格子。lucide の形）
  const ICON = {
    ellipsis: '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    pin: '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>',
    expand: '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>',
    collapse: '<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>',
  };

  /** すべて展開・すべて折りたたむのボタンの HTML を返す。 */
  const foldAllButtons = () =>
    `<button class="mdmark-fold-all" type="button" data-fold-all="open">${ICON.expand}すべて展開</button>` +
    `<button class="mdmark-fold-all" type="button" data-fold-all="close">${ICON.collapse}すべて折りたたむ</button>`;

  /** 節の中身の開閉を切り替え、見出しのボタンの aria-expanded を合わせる（syntax.js の setSectionOpen と同じ）。 */
  const setSectionOpen = (toggle, open) => {
    toggle.setAttribute("aria-expanded", String(open));
    const body = document.getElementById(toggle.getAttribute("aria-controls"));
    if (open) body.removeAttribute("hidden");
    else body.setAttribute("hidden", "until-found");
  };

  /** 見出しの階層どおりに入れ子にした目次の項目の並びを作る。 */
  const buildList = (headings, hrefPrefix) => {
    const root = document.createElement("ul");
    root.className = "mdmark-side-toc-list";
    // 今の項目までの祖先の項目（浅い階層から順）
    const stack = [];
    for (const heading of headings) {
      const level = Number(heading.tagName[1]);
      // 同じか浅い階層の項目は祖先にならない
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      const parent = stack.at(-1);
      const list = parent ? (parent.item.querySelector(":scope > ul") ?? parent.item.appendChild(document.createElement("ul"))) : root;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.setAttribute("href", hrefPrefix + heading.id);
      link.textContent = heading.textContent.trim();
      item.append(link);
      list.append(item);
      stack.push({ level, item });
    }
    return root;
  };

  // 右側の目次ごとの、載せた見出しと項目のリンク・右端の線・狭い幅の帯の今いる節の見出し
  const entries = new Map();

  /** 右側の目次を、本文の列の今の見出しから組み立て直す。出しているか・ピン止めしているかは保つ。 */
  const render = (aside, index) => {
    const content = aside.parentElement.querySelector(":scope > .mdmark-content");
    const headings = [...content.querySelectorAll(HEADING_SELECTOR)];
    aside.hidden = headings.length === 0;
    const titleId = `mdmark-side-toc-title-${index}`;
    const panelId = `mdmark-side-toc-panel-${index}`;
    // [data-actions="none"]: まとめて開閉するボタンを目次の上部に置かない（文書の先頭に置く案 B）
    const actions = aside.dataset.actions === "none" ? "" : `<div class="mdmark-side-toc-actions">${foldAllButtons()}</div>`;
    const bars = headings.map((heading) => `<span class="mdmark-side-toc-bar" data-level="${heading.tagName[1]}"></span>`).join("");
    aside.innerHTML =
      `<button class="mdmark-side-toc-toggle" type="button" aria-expanded="${"open" in aside.dataset}" aria-controls="${panelId}" aria-label="目次を表示" title="目次を表示"><span class="mdmark-side-toc-current"></span>${ICON.ellipsis}</button>` +
      `<div class="mdmark-side-toc-rail" aria-hidden="true">${bars}</div>` +
      `<nav class="mdmark-side-toc-panel" id="${panelId}" aria-labelledby="${titleId}">` +
      `<div class="mdmark-side-toc-head"><p class="mdmark-side-toc-title" id="${titleId}">目次</p>` +
      `<button class="mdmark-side-toc-pin" type="button" aria-pressed="${"pinned" in aside.dataset}" aria-label="目次をピン止め" title="目次をピン止め">${ICON.pin}</button></div>` +
      `${actions}</nav>`;
    aside.querySelector(".mdmark-side-toc-panel").append(buildList(headings, aside.dataset.hrefPrefix ?? "#"));
    entries.set(aside, {
      headings,
      links: [...aside.querySelectorAll(".mdmark-side-toc-list a")],
      bars: [...aside.querySelectorAll(".mdmark-side-toc-bar")],
      currentLabel: aside.querySelector(".mdmark-side-toc-current"),
    });
  };

  /** スクロールの位置から今いる節を決め、その項目と右端の線だけに印を付け、狭い幅の帯にその見出しを出す。 */
  const updateCurrent = () => {
    const line = window.innerHeight * CURRENT_LINE_RATIO;
    for (const { headings, links, bars, currentLabel } of entries.values()) {
      let current = -1;
      for (const [i, heading] of headings.entries()) {
        // 閉じた節や選ばれていないタブの中の見出しは、画面に無いので数えない
        if (heading.getClientRects().length === 0) continue;
        const top = heading.getBoundingClientRect().top;
        // 線より上の最後の見出し（線より上に 1 つも無いときは、画面にある最初の見出し）
        if (current < 0 || top <= line) current = i;
        if (top > line) break;
      }
      for (const [i, link] of links.entries()) {
        if (i === current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
        bars[i].toggleAttribute("data-current", i === current);
      }
      currentLabel.textContent = current < 0 ? "" : links[current].textContent;
    }
  };

  // スクロール・幅の変化・節の開閉の後に、今いる節を 1 フレームに 1 回だけ決め直す
  let frame = 0;
  const requestUpdate = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateCurrent();
    });
  };

  /** 目次を出すボタン（三点リーダー）で、目次を出すか隠すかを切り替える。 */
  const setOpen = (aside, open) => {
    aside.toggleAttribute("data-open", open);
    aside.querySelector(".mdmark-side-toc-toggle").setAttribute("aria-expanded", String(open));
  };

  for (const [index, aside] of [...document.querySelectorAll(".mdmark-side-toc[data-mode]")].entries()) {
    render(aside, index);

    aside.addEventListener("click", (event) => {
      if (event.target.closest(".mdmark-side-toc-toggle")) setOpen(aside, !("open" in aside.dataset));
      const pin = event.target.closest(".mdmark-side-toc-pin");
      if (pin) {
        const pinned = !("pinned" in aside.dataset);
        aside.toggleAttribute("data-pinned", pinned);
        pin.setAttribute("aria-pressed", String(pinned));
      }
      // 今の URL と同じ #ID の項目: URL が変わらず hashchange が起きないので、移る処理を呼び直す
      const link = event.target.closest(".mdmark-side-toc-list a");
      if (link && decodeURIComponent(location.hash) === link.getAttribute("href")) window.dispatchEvent(new HashChangeEvent("hashchange"));
      // 本文に重ねて開いた目次（狭い幅・ポインターを置けない端末）で項目を押したとき: 移った先を隠さないよう閉じる
      if (link && "open" in aside.dataset && getComputedStyle(aside.querySelector(".mdmark-side-toc-panel")).position === "absolute") setOpen(aside, false);
    });

    // 出している目次の中で Esc: 目次を隠し、目次を出すボタンへフォーカスを戻す
    aside.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !("open" in aside.dataset)) return;
      setOpen(aside, false);
      aside.querySelector(".mdmark-side-toc-toggle").focus();
    });

    // 本文が差し替わったとき（まとめた HTML で文書を移ったとき・描き直したとき）: 目次を組み立て直す
    const content = aside.parentElement.querySelector(":scope > .mdmark-content");
    new MutationObserver(() => {
      render(aside, index);
      requestUpdate();
    }).observe(content, { childList: true });
  }

  // 文書の先頭のまとめて開閉するボタンの並び（案 B）
  for (const bar of document.querySelectorAll(".mdmark-fold-bar")) bar.innerHTML = foldAllButtons();

  // すべて展開・すべて折りたたむ: 押したボタンの文書の全ての節を同じ状態にする
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fold-all]");
    if (!button) return;
    const open = button.dataset.foldAll === "open";
    for (const toggle of button.closest(".mdmark").querySelectorAll(".mdmark-section-toggle")) setSectionOpen(toggle, open);
  });

  // Shift を押しているか（Enter・Space で押したときは click の shiftKey が立たないブラウザがあるため、キーの状態からも読む）
  let shiftHeld = false;
  document.addEventListener("keydown", (event) => (shiftHeld = event.shiftKey), true);
  document.addEventListener("keyup", (event) => (shiftHeld = event.shiftKey), true);

  // Shift を押しながら節の開閉を押したとき: 1 つの節だけを開閉する処理（syntax.js）へ渡さず、その節と中の入れ子の節を全て同じ状態にする
  document.addEventListener(
    "click",
    (event) => {
      const toggle = event.target.closest(".mdmark-section-toggle");
      if (!toggle || !(event.shiftKey || shiftHeld)) return;
      event.stopPropagation();
      const open = toggle.getAttribute("aria-expanded") !== "true";
      setSectionOpen(toggle, open);
      const body = document.getElementById(toggle.getAttribute("aria-controls"));
      for (const inner of body.querySelectorAll(".mdmark-section-toggle")) setSectionOpen(inner, open);
      requestUpdate();
    },
    true,
  );

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("hashchange", requestUpdate);
  document.addEventListener("click", requestUpdate);
  updateCurrent();
}
