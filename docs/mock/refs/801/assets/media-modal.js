// 動画・音声の再生のダイアログ（#801 で共有するアセット）: その場に出すものを押すと開いて再生し、閉じると止めて押したボタンへフォーカスを戻す
(() => {
  const dialog = document.querySelector("dialog.mdmark-media-modal:not(.is-sample)");
  if (!dialog) return;
  const title = dialog.querySelector(".mdmark-media-modal-title");
  const stage = dialog.querySelector(".mdmark-media-modal-stage");
  const caption = dialog.querySelector(".mdmark-media-modal-caption");
  let opener = null;

  // [data-media-open]: 押したボタンの data-src・data-kind・data-label・data-caption で再生する要素を作る
  for (const button of document.querySelectorAll("[data-media-open]")) {
    button.addEventListener("click", () => {
      opener = button;
      const kind = button.dataset.kind === "audio" ? "audio" : "video";
      const media = document.createElement(kind);
      media.src = button.dataset.src;
      media.controls = true;
      media.autoplay = true;
      if (kind === "video") media.playsInline = true;
      media.setAttribute("aria-label", button.dataset.label);
      stage.replaceChildren(media);
      title.textContent = button.dataset.label;
      caption.textContent = button.dataset.caption ?? "";
      caption.hidden = !button.dataset.caption;
      dialog.showModal();
    });
  }

  dialog.querySelector('[data-tool="close"]').addEventListener("click", () => dialog.close());

  // closedby を持たないブラウザ: 背景を押したら閉じる
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  // 閉じたら再生を止めて要素を外し、押したボタンへフォーカスを戻す
  dialog.addEventListener("close", () => {
    stage.querySelector("video, audio")?.pause();
    stage.replaceChildren();
    opener?.focus();
  });
})();
