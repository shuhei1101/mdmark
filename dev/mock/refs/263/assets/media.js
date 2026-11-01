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

  const lightbox = document.querySelector("dialog.mdmark-lightbox");
  // 同じ文書のライトボックスの画像（nolightbox の画像は開くボタンを持たない）
  const openers = [...document.querySelectorAll("[data-lightbox-open]")];

  if (lightbox) {
    const image = lightbox.querySelector(".mdmark-lightbox-stage img");
    const caption = lightbox.querySelector(".mdmark-lightbox-caption");
    const count = lightbox.querySelector(".mdmark-lightbox-count");
    const prev = lightbox.querySelector('[data-tool="prev"]');
    const next = lightbox.querySelector('[data-tool="next"]');
    const close = lightbox.querySelector('[data-tool="close"]');
    // 開いたときに見えている画像（今の配色に合わないテーマごとの画像を除く）
    let list = [];
    let index = 0;
    let opener = null;

    /** index 番目の画像・キャプション・何枚目かを出し、端の前・次を押せなくする。 */
    const show = (to) => {
      index = Math.min(Math.max(to, 0), list.length - 1);
      const source = list[index].querySelector("img");
      const figcaption = list[index].closest("figure")?.querySelector("figcaption");
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
    // 左右の矢印キーで前後へ送る
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
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
