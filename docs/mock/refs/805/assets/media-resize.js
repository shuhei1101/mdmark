// 動画の大きさを変えるリサイズハンドル（#805 で共有するアセット）: ドラッグと ↑ ↓ で縦横の比率を保って動画の幅を変え、ダブルクリックで元の大きさに戻す。変えた幅は同じタブの中で再読み込みしても保つ
(() => {
  // 1 回の ↑ ↓ で変える高さ（図の枠のリサイズハンドルと同じ 32px）
  const KEY_STEP_PX = 32;
  // 動画の幅の下限
  const MIN_WIDTH_PX = 160;
  // 点の並びのアイコン（図の枠のリサイズハンドルと同じ grip）
  const GRIP =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/></svg>';

  // [data-mock-resize-plan]: その図の動画にハンドルを付ける（値は案の記号 a / b）。[data-mock-resize="off"] の祖先を持つ図には付けない
  const figures = document.querySelectorAll("figure.mdmark-media[data-mock-resize-plan]");
  figures.forEach((figure, index) => {
    if (figure.closest('[data-mock-resize="off"]')) return;
    const video = figure.querySelector(":scope > video");

    // 動画を入れ物に入れ、入れ物の右下（案 A）か右上（案 B）にハンドルを配置する
    const frame = document.createElement("div");
    frame.className = "mdmark-media-frame";
    frame.dataset.mockPlan = figure.dataset.mockResizePlan;
    video.before(frame);
    frame.append(video);
    const handle = document.createElement("div");
    handle.className = "mdmark-media-resize";
    handle.setAttribute("role", "separator");
    handle.tabIndex = 0;
    handle.setAttribute("aria-orientation", "horizontal");
    // [data-mock-label]: 読み上げの名前に入れる動画の名前（実装では alt）
    handle.setAttribute("aria-label", `「${figure.dataset.mockLabel}」の大きさ`);
    handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
    handle.title = "ドラッグか ↑ ↓ で大きさを変える。ダブルクリックで元の大きさに戻す";
    handle.innerHTML = GRIP;
    frame.append(handle);

    const storageKey = `mock-media-width:${location.pathname}:${index}`;
    const original = figure.style.getPropertyValue("--mdmark-image-width");
    // 縦横の比率: video の width・height の属性の比（実装では読み込んだ動画の videoWidth・videoHeight）
    const ratio = Number(video.getAttribute("height")) / Number(video.getAttribute("width"));
    const maxWidth = () => figure.parentElement.clientWidth;

    /** 幅（px）を本文の幅と下限に収めて当て、読み上げに今の幅を伝える。保存するときは sessionStorage に書く。 */
    const setWidth = (width, save) => {
      const clamped = Math.round(Math.max(MIN_WIDTH_PX, Math.min(maxWidth(), width)));
      figure.style.setProperty("--mdmark-image-width", `${clamped}px`);
      handle.setAttribute("aria-valuemin", String(MIN_WIDTH_PX));
      handle.setAttribute("aria-valuemax", String(maxWidth()));
      handle.setAttribute("aria-valuenow", String(clamped));
      if (save) sessionStorage.setItem(storageKey, String(clamped));
    };

    // 開いたときの幅: 同じタブの中で変えた幅があればその幅、無ければ今の幅を読み上げに伝える
    const saved = Number(sessionStorage.getItem(storageKey));
    setWidth(saved || video.getBoundingClientRect().width, false);
    if (!saved) {
      if (original) figure.style.setProperty("--mdmark-image-width", original);
      else figure.style.removeProperty("--mdmark-image-width");
    }

    // ドラッグ: 右下へ動かすと大きく、左上へ動かすと小さくする。横と縦の動きのうち大きい方を幅に換算する（縦は比率で換算する）
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("is-resizing");
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = video.getBoundingClientRect().width;
      const move = (e) => {
        const dx = e.clientX - startX;
        const dy = (e.clientY - startY) / ratio;
        setWidth(startWidth + (Math.abs(dx) > Math.abs(dy) ? dx : dy), true);
      };
      const end = () => {
        handle.classList.remove("is-resizing");
        handle.removeEventListener("pointermove", move);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end, { once: true });
      handle.addEventListener("pointercancel", end, { once: true });
    });

    // ↑ で小さく、↓ で大きくする（高さを 32px ずつ変え、比率で幅に換算する）
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const step = KEY_STEP_PX / ratio;
      setWidth(video.getBoundingClientRect().width + (event.key === "ArrowDown" ? step : -step), true);
    });

    // ダブルクリック: 記載した幅（無ければ本文の幅）に戻し、保存した幅を削除する
    handle.addEventListener("dblclick", () => {
      if (original) figure.style.setProperty("--mdmark-image-width", original);
      else figure.style.removeProperty("--mdmark-image-width");
      sessionStorage.removeItem(storageKey);
      handle.setAttribute("aria-valuenow", String(Math.round(video.getBoundingClientRect().width)));
    });
  });
})();
