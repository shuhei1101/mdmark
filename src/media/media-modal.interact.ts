import { renderMediaModal } from "./media-modal.part.ts";

// 再生のボタン
const OPENER_SELECTOR = "button.mdmark-media-open";

// 開いたダイアログのタイトルの `id` の頭に付ける通し番号
let modalCount = 0;

/** HTML 文字列の最初の要素を作る */
const elementFrom = <T extends Element>(html: string): T => {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as T;
};

/** 再生のボタンのラベル（`aria-label`、無ければラベルの文字） */
const labelOf = (opener: HTMLButtonElement): string =>
  opener.getAttribute("aria-label") ??
  opener.querySelector(".mdmark-media-open-label")?.textContent ??
  "";

/** 再生のボタンの `data-media-*` から再生のダイアログの HTML を作る */
const modalHtmlOf = (opener: HTMLButtonElement): string => {
  const { dataset } = opener;
  modalCount += 1;
  return renderMediaModal({
    id: `mdmark-media-modal-${modalCount}`,
    kind: dataset.mediaKind === "audio" ? "audio" : "video",
    src: dataset.mediaSrc ?? "",
    label: labelOf(opener),
    ...(dataset.mediaCaption === undefined
      ? {}
      : { caption: dataset.mediaCaption }),
    ...(dataset.mediaPoster === undefined
      ? {}
      : { poster: dataset.mediaPoster }),
    muted: dataset.mediaMuted !== undefined,
    loop: dataset.mediaLoop !== undefined,
  });
};

/** 再生のボタンを押すと再生のダイアログを開いて再生し、閉じたら再生を止めて削除する。受け取りを解除する関数を返却する */
export const attachMediaModal = (root: HTMLElement): (() => void) => {
  const controller = new AbortController();
  let closeOpen: (() => void) | undefined;

  const open = (opener: HTMLButtonElement): void => {
    const dialog = elementFrom<HTMLDialogElement>(modalHtmlOf(opener));
    const dialogController = new AbortController();
    const { signal } = dialogController;
    const scroll = { x: window.scrollX, y: window.scrollY };
    const media = dialog.querySelector<HTMLMediaElement>("video, audio");

    /** 再生を止めて `dialog` を削除し、フォーカスとスクロールの位置を開く前に戻す */
    const finish = (): void => {
      if (signal.aborted) {
        return;
      }
      dialogController.abort();
      media?.pause();
      dialog.remove();
      closeOpen = undefined;
      opener.focus({ preventScroll: true });
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) {
        window.scrollTo(scroll.x, scroll.y);
      }
    };

    dialog
      .querySelector('[data-tool="close"]')
      ?.addEventListener("click", () => dialog.close(), { signal });
    // `closedby` を持たないブラウザ: `dialog` 自身（背景）を押したら閉じる
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      dialog.addEventListener(
        "click",
        (event) => {
          if (event.target === dialog) {
            dialog.close();
          }
        },
        { signal },
      );
    }
    // 左右の矢印キーはライトボックスの切り替えへ届けない
    dialog.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.stopPropagation();
        }
      },
      { signal },
    );
    dialog.addEventListener("close", finish, { signal });

    root.append(dialog);
    dialog.showModal();
    closeOpen = () => {
      dialog.close();
      finish();
    };
    // 再生を拒まれたときは、再生バーから再生できるままにする
    media?.play().catch(() => {});
  };

  root.addEventListener(
    "click",
    (event) => {
      const opener = (event.target as Element).closest<HTMLButtonElement>(
        OPENER_SELECTOR,
      );
      if (opener && root.contains(opener) && closeOpen === undefined) {
        open(opener);
      }
    },
    { signal: controller.signal },
  );

  return () => {
    closeOpen?.();
    controller.abort();
  };
};
