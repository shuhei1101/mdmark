// 動画の大きさを変えるリサイズハンドル（#805 で共有するアセット）: ドラッグと ↑ ↓ で縦横の比率を保って動画の幅を変え、ダブルクリックで元の大きさに戻す。ハンドルを押す（動かさずに離す）か Enter で、小さく・大きく・元の大きさのメニューを開く。変えた幅は同じタブの中で再読み込みしても保つ
(() => {
  // 1 回の ↑ ↓ とメニューのボタンで変える高さ（図の枠のリサイズハンドルと同じ 32px）
  const STEP_PX = 32;
  // 動画の幅の下限
  const MIN_WIDTH_PX = 160;
  // 押した後にこれより動かしたらドラッグとして扱い、メニューを開かない
  const DRAG_THRESHOLD_PX = 4;
  // 点の並びのアイコン（図の枠のリサイズハンドルと同じ grip）
  const GRIP =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/></svg>';
  // メニューのボタンのアイコン（lucide の minus・plus・rotate-ccw）
  const ICONS = {
    smaller: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    larger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  // [data-mock-resize-plan]: その図の動画にハンドルを付ける（値は案の記号 a / b）。[data-mock-resize="off"] の祖先を持つ図には付けない
  const figures = document.querySelectorAll("figure.mdmark-media[data-mock-resize-plan]");
  figures.forEach((figure, index) => {
    if (figure.closest('[data-mock-resize="off"]')) return;
    const video = figure.querySelector(":scope > video");
    // [data-mock-label]: 読み上げの名前に入れる動画の名前（実装では alt）
    const label = figure.dataset.mockLabel;

    // 動画を入れ物に入れ、入れ物の右下（案 A）か右上（案 B）にハンドルを配置する
    const frame = document.createElement("div");
    frame.className = "mdmark-media-frame";
    frame.dataset.mockPlan = figure.dataset.mockResizePlan;
    video.before(frame);
    frame.append(video);
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "mdmark-media-resize";
    handle.setAttribute("aria-label", `「${label}」の大きさを変える`);
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    handle.title = "ドラッグか ↑ ↓ で大きさを変える。押すと大きさのメニューを開く。ダブルクリックで元の大きさに戻す";
    handle.innerHTML = `<span class="mdmark-media-resize-grip">${GRIP}</span>`;
    frame.append(handle);

    // 大きさのメニュー: popover で最前面に出す
    const menu = document.createElement("div");
    menu.className = "mdmark-media-size-menu";
    menu.id = `mock-media-size-menu-${index}`;
    menu.popover = "auto";
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", `「${label}」の大きさ`);
    menu.innerHTML = `
      <button type="button" data-size="smaller">${ICONS.smaller}小さくする</button>
      <button type="button" data-size="larger">${ICONS.larger}大きくする</button>
      <button type="button" data-size="reset">${ICONS.reset}元の大きさに戻す</button>`;
    document.body.append(menu);
    // ハンドルを押す（動かさずに離す）か Enter・Space でメニューを開閉する。開閉・外を押して閉じる動作・aria-expanded はブラウザに任せる
    handle.popoverTargetElement = menu;
    handle.popoverTargetAction = "toggle";

    const storageKey = `mock-media-width:${location.pathname}:${index}`;
    const original = figure.style.getPropertyValue("--mdmark-image-width");
    // 縦横の比率: video の width・height の属性の比（実装では読み込んだ動画の videoWidth・videoHeight）
    const ratio = Number(video.getAttribute("height")) / Number(video.getAttribute("width"));
    const maxWidth = () => figure.parentElement.clientWidth;
    const currentWidth = () => video.getBoundingClientRect().width;

    /** メニューのボタンを、下限・上限・元の大きさに達しているときは押せなくする。 */
    const updateMenu = () => {
      const width = currentWidth();
      menu.querySelector('[data-size="smaller"]').disabled = width <= MIN_WIDTH_PX + 0.5;
      menu.querySelector('[data-size="larger"]').disabled = width >= maxWidth() - 0.5;
      menu.querySelector('[data-size="reset"]').disabled = !sessionStorage.getItem(storageKey);
    };

    /** 開いているメニューを、ハンドルの下に右端を合わせて配置する。下に入らなければ上に配置する。 */
    const placeMenu = () => {
      if (!menu.matches(":popover-open")) return;
      const rect = handle.getBoundingClientRect();
      const below = rect.bottom + 4;
      const top = below + menu.offsetHeight > window.innerHeight ? rect.top - 4 - menu.offsetHeight : below;
      menu.style.top = `${top}px`;
      menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
    };

    /** 幅（px）を本文の幅と下限に収めて当て、sessionStorage に記録する。 */
    const setWidth = (width) => {
      const clamped = Math.round(Math.max(MIN_WIDTH_PX, Math.min(maxWidth(), width)));
      figure.style.setProperty("--mdmark-image-width", `${clamped}px`);
      sessionStorage.setItem(storageKey, String(clamped));
      updateMenu();
      placeMenu();
    };

    /** 記載した幅（無ければ本文の幅）に戻し、記録した幅を削除する。 */
    const reset = () => {
      if (original) figure.style.setProperty("--mdmark-image-width", original);
      else figure.style.removeProperty("--mdmark-image-width");
      sessionStorage.removeItem(storageKey);
      updateMenu();
      placeMenu();
    };

    // 開いたとき: 同じタブの中で変えた幅があればその幅で描く
    const saved = Number(sessionStorage.getItem(storageKey));
    if (saved) figure.style.setProperty("--mdmark-image-width", `${saved}px`);

    // ドラッグ: 右下へ動かすと大きく、左上へ動かすと小さくする。横と縦の動きのうち大きい方を幅に換算する（縦は比率で換算する）
    let dragged = false;
    handle.addEventListener("pointerdown", (event) => {
      // 文字の選択を止めるために既定の動作を止めるので、押したハンドルへフォーカスを移して ↑ ↓ を受け取れるようにする
      event.preventDefault();
      handle.focus();
      handle.setPointerCapture(event.pointerId);
      dragged = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = currentWidth();
      const move = (e) => {
        const dx = e.clientX - startX;
        const dy = (e.clientY - startY) / ratio;
        if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        handle.classList.add("is-resizing");
        setWidth(startWidth + (Math.abs(dx) > Math.abs(dy) ? dx : dy));
      };
      const end = () => {
        handle.classList.remove("is-resizing");
        handle.removeEventListener("pointermove", move);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end, { once: true });
      handle.addEventListener("pointercancel", end, { once: true });
    });

    // ドラッグした後の click: メニューを開閉しない（popover の開閉を止める）
    handle.addEventListener("click", (event) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
    });
    // 大きさを変えてハンドルが動いたときとスクロールしたときも、開いているメニューをハンドルに付けて動かす
    window.addEventListener("scroll", placeMenu, { passive: true });
    window.addEventListener("resize", placeMenu);
    menu.addEventListener("toggle", (event) => {
      handle.classList.toggle("is-open", event.newState === "open");
      // 開いたら、ボタンの押せる・押せないを合わせ、ハンドルのそばに配置して、最初の押せるボタンへフォーカスを移す
      if (event.newState === "open") {
        updateMenu();
        placeMenu();
        menu.querySelector("button:not(:disabled)")?.focus();
        return;
      }
      // Esc・外を押して閉じたときは、フォーカスをハンドルへ戻す
      if (menu.contains(document.activeElement)) handle.focus();
    });
    menu.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-size]");
      if (!button) return;
      const step = STEP_PX / ratio;
      if (button.dataset.size === "smaller") setWidth(currentWidth() - step);
      if (button.dataset.size === "larger") setWidth(currentWidth() + step);
      if (button.dataset.size === "reset") reset();
      // 押したボタンが押せなくなったら、押せるボタンへフォーカスを移す
      if (button.disabled) menu.querySelector("button:not(:disabled)")?.focus();
    });

    // ↑ で小さく、↓ で大きくする（高さを 32px ずつ変え、比率で幅に換算する）
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const step = STEP_PX / ratio;
      setWidth(currentWidth() + (event.key === "ArrowDown" ? step : -step));
    });

    // ダブルクリック: 元の大きさに戻す（2 回目の押下で開いたメニューは閉じる）
    handle.addEventListener("dblclick", () => {
      reset();
      if (menu.matches(":popover-open")) menu.hidePopover();
    });
  });
})();
