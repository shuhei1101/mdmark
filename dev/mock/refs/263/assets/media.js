// 画像・GIF・テーマの操作（#263 で共有するアセット）: ライトボックス（実装の mount が付ける操作のモック）、GIF の止める・再生する（PoC の案 A）、モック専用のテーマの切り替え

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const root = document.documentElement;

  // ---------- モック専用の操作列: テーマの切り替え ----------

  const themeButtons = document.querySelectorAll("[data-theme-set]");
  const themeLinks = document.querySelectorAll("link[data-theme-css]");

  /** テーマの配色の link だけを有効にし、選んでいるボタンを押された状態にする。 */
  const applyTheme = (theme) => {
    for (const link of themeLinks) {
      link.disabled = link.dataset.themeCss !== theme;
    }
    if (theme === "default") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    for (const button of themeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.themeSet === theme));
    }
  };

  for (const button of themeButtons) {
    button.addEventListener("click", () => applyTheme(button.dataset.themeSet));
  }
  if (themeButtons.length > 0) applyTheme("default");

  // ---------- ライトボックス ----------

  // 倍率: 図の枠と同じく 1.25 倍ずつ、全体が収まる倍率（1）から 300% まで
  const ZOOM_STEP = 1.25;
  const ZOOM_MAX = 3;
  // 矢印キーと移動のボタンで動かす量
  const PAN_STEP = 80;

  /** 倍率のボタン・縮小と拡大の押せる状態・移動のボタンを、今の倍率に合わせる。拡大中は画像を全体が収まる幅 × 倍率で置く */
  const applyZoom = (box, stage, zoom, fitWidth) => {
    const percent = `${Math.round(zoom * 100)}%`;
    const fit = box.querySelector('[data-tool="fit"]');
    fit.textContent = percent;
    fit.setAttribute("aria-label", `倍率 ${percent}。全体が収まる倍率に戻す`);
    box.querySelector('[data-tool="out"]').disabled = zoom <= 1;
    box.querySelector('[data-tool="in"]').disabled = zoom >= ZOOM_MAX;
    box.querySelector('[data-group="pan"]').hidden = zoom <= 1;
    stage.classList.toggle("is-zoomed", zoom > 1);
    stage.style.setProperty("--mdmark-lightbox-image-width", `${fitWidth * zoom}px`);
  };

  /** 画像の場所の余白をドラッグして動かす */
  const enableDrag = (stage) => {
    let from = null;
    stage.addEventListener("pointerdown", (event) => {
      if (!stage.classList.contains("is-zoomed")) return;
      from = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (event) => {
      if (!from) return;
      stage.scrollLeft = from.left - (event.clientX - from.x);
      stage.scrollTop = from.top - (event.clientY - from.y);
    });
    const stop = () => {
      from = null;
      stage.classList.remove("is-dragging");
    };
    stage.addEventListener("pointerup", stop);
    stage.addEventListener("pointercancel", stop);
  };

  const panBy = { left: [-1, 0], up: [0, -1], down: [0, 1], right: [1, 0] };
  const arrowPan = { ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right" };

  // モックの中の拡大した見本: 決めた倍率で止めて置き、中央を見せる
  for (const stage of document.querySelectorAll(".mdmark-lightbox.is-sample [data-mock-zoom]")) {
    const box = stage.closest(".mdmark-lightbox");
    const img = stage.querySelector("img");
    img.decode().then(() => {
      const fitWidth = Math.min(stage.clientWidth - 32, (img.naturalWidth / img.naturalHeight) * (stage.clientHeight - 32));
      applyZoom(box, stage, Number(stage.dataset.mockZoom), fitWidth);
      stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
      stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
      enableDrag(stage);
    });
  }

  const lightbox = document.querySelector("dialog.mdmark-lightbox");
  // 同じ文書のライトボックスの画像（nolightbox の画像は開くボタンを持たない）
  const openers = [...document.querySelectorAll("[data-lightbox-open]")];

  if (lightbox) {
    const stage = lightbox.querySelector(".mdmark-lightbox-stage");
    const image = stage.querySelector("img");
    const caption = lightbox.querySelector(".mdmark-lightbox-caption");
    const count = lightbox.querySelector(".mdmark-lightbox-count");
    const prev = lightbox.querySelector('[data-tool="prev"]');
    const next = lightbox.querySelector('[data-tool="next"]');
    const close = lightbox.querySelector('[data-tool="close"]');
    // 開いたときに見えている画像（今の配色に合わないテーマごとの画像を除く）
    let list = [];
    let index = 0;
    let opener = null;
    let zoom = 1;
    // 全体が収まる倍率のときの画像の幅（拡大の元にする）
    let fitWidth = 0;

    /** 倍率を変え、画像の場所の中央を保つ */
    const setZoom = (to) => {
      if (zoom === 1) fitWidth = image.getBoundingClientRect().width;
      const centerX = (stage.scrollLeft + stage.clientWidth / 2) / Math.max(stage.scrollWidth, 1);
      const centerY = (stage.scrollTop + stage.clientHeight / 2) / Math.max(stage.scrollHeight, 1);
      zoom = Math.min(Math.max(to, 1), ZOOM_MAX);
      applyZoom(lightbox, stage, zoom, fitWidth);
      stage.scrollLeft = centerX * stage.scrollWidth - stage.clientWidth / 2;
      stage.scrollTop = centerY * stage.scrollHeight - stage.clientHeight / 2;
    };

    /** index 番目の画像・キャプション・何枚目かを出し、端の前・次を押せなくする。倍率は全体が収まる倍率に戻す */
    const show = (to) => {
      index = Math.min(Math.max(to, 0), list.length - 1);
      const source = list[index].querySelector("img");
      const figcaption = list[index].closest("figure")?.querySelector("figcaption");
      zoom = 1;
      applyZoom(lightbox, stage, 1, 0);
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      caption.textContent = figcaption ? figcaption.textContent : "";
      caption.hidden = !figcaption;
      count.textContent = `${index + 1} / ${list.length}`;
      prev.disabled = index === 0;
      next.disabled = index === list.length - 1;
    };

    for (const button of openers) {
      button.addEventListener("click", () => {
        opener = button;
        list = openers.filter((item) => item.checkVisibility());
        show(list.indexOf(button));
        lightbox.showModal();
        close.focus();
      });
    }
    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    close.addEventListener("click", () => lightbox.close());
    lightbox.querySelector('[data-tool="in"]').addEventListener("click", () => setZoom(zoom * ZOOM_STEP));
    lightbox.querySelector('[data-tool="out"]').addEventListener("click", () => setZoom(zoom / ZOOM_STEP));
    lightbox.querySelector('[data-tool="fit"]').addEventListener("click", () => setZoom(1));
    for (const [name, [x, y]] of Object.entries(panBy)) {
      lightbox
        .querySelector(`[data-tool="${name}"]`)
        .addEventListener("click", () => stage.scrollBy(x * PAN_STEP, y * PAN_STEP));
    }
    enableDrag(stage);
    // キー: ＋・－・0 で倍率、矢印キーは拡大中なら動かし、全体が収まる倍率なら ← → で前後へ送る
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") setZoom(zoom * ZOOM_STEP);
      else if (event.key === "-") setZoom(zoom / ZOOM_STEP);
      else if (event.key === "0") setZoom(1);
      else if (event.key in arrowPan && zoom > 1) {
        const [x, y] = panBy[arrowPan[event.key]];
        stage.scrollBy(x * PAN_STEP, y * PAN_STEP);
        event.preventDefault();
      } else if (event.key === "ArrowLeft") show(index - 1);
      else if (event.key === "ArrowRight") show(index + 1);
    });
    // 後ろを押したら閉じる（closedby を持たないブラウザの代わり）
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox && !("closedBy" in HTMLDialogElement.prototype)) lightbox.close();
    });
    // 閉じたら開いたボタンへフォーカスを戻す
    lightbox.addEventListener("close", () => opener?.focus());
  }

  // ---------- GIF の止める・再生する ----------

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const holder of document.querySelectorAll(".mdmark-gif")) {
    const img = holder.querySelector("img");
    const button = holder.querySelector(".mdmark-gif-toggle");

    /** 止めた・再生しているの状態を当てる（止めた間は最初のフレームの絵を重ねる）。ラベルは変えず、押された状態で止めたことを示す */
    const setPaused = (canvas, paused) => {
      canvas.hidden = !paused;
      img.style.visibility = paused ? "hidden" : "";
      button.setAttribute("aria-pressed", String(paused));
    };

    img.decode().then(() => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      canvas.hidden = true;
      img.after(canvas);
      // 動きを減らす設定と、モックで止めた状態を見せる見本は、止めた状態で始める
      setPaused(canvas, reduceMotion || holder.hasAttribute("data-mock-paused"));
      button.addEventListener("click", () => setPaused(canvas, canvas.hidden));
    });
  }
}
