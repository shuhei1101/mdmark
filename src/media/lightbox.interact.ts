import {
  openStepMenu,
  type StepMenuHandle,
  type StepMenuItem,
} from "../shared/step-menu.interact.ts";
import { attachZoom, type ZoomControl } from "../shared/zoom.interact.ts";
import { renderImageOpener } from "./image.part.ts";
import { renderLightbox } from "./lightbox.part.ts";

/** 拡大のボタンで包む画像 */
export const LIGHTBOX_IMAGE_SELECTOR =
  "figure.mdmark-image img:not([data-nolightbox])";

// 拡大のボタン
const OPENER_SELECTOR = "button.mdmark-image-open";

// 押した所から離した所までがこの距離（px）以下なら、つかんで動かしたのではなく押したとみなす
const CLICK_SLOP = 4;

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

/** 移動のメニューの項目: 文言・アイコン・押したキー・動かせるか */
const MOVE_ITEMS = [
  {
    label: "上へ移す",
    icon: "chevron-up",
    key: "ArrowUp",
    can: (stage: HTMLElement) => stage.scrollTop > 0,
  },
  {
    label: "下へ移す",
    icon: "chevron-down",
    key: "ArrowDown",
    can: (stage: HTMLElement) =>
      stage.scrollTop < stage.scrollHeight - stage.clientHeight - 1,
  },
  {
    label: "左へ移す",
    icon: "chevron-left",
    key: "ArrowLeft",
    can: (stage: HTMLElement) => stage.scrollLeft > 0,
  },
  {
    label: "右へ移す",
    icon: "chevron-right",
    key: "ArrowRight",
    can: (stage: HTMLElement) =>
      stage.scrollLeft < stage.scrollWidth - stage.clientWidth - 1,
  },
] as const;

/** HTML 文字列の最初の要素を作る */
function elementFrom<T extends Element>(html: string): T {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as T;
}

/** `root` の中の拡大のボタンを文書の順に並べ、今の配色で隠れている図の中のものを除いて返却する */
export function collectLightboxImages(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(OPENER_SELECTOR)].filter(
    (opener) => {
      const figure = opener.closest("figure");
      return figure === null || getComputedStyle(figure).display !== "none";
    },
  );
}

/** 本文の画像を包む `figure` のキャプションの文字。無ければ空 */
function captionOf(source: HTMLImageElement | null): string {
  return (
    source?.closest("figure")?.querySelector("figcaption")?.textContent ?? ""
  );
}

/** 本文の画像の URL・代替テキスト・キャプションを、拡大の画像とキャプションに写す */
function copyImage(
  source: HTMLImageElement | null,
  target: { img: HTMLImageElement; caption: HTMLElement },
): void {
  const { img, caption } = target;
  img.src = source?.currentSrc || source?.src || "";
  img.alt = source?.alt ?? "";
  const text = captionOf(source);
  caption.textContent = text;
  caption.hidden = text === "";
}

/** 画像を拡大のボタンで包み、押すとライトボックスで開いて切り替え・拡大・縮小・移動を付ける。削除する関数を返却する */
export function attachLightbox(root: HTMLElement): () => void {
  const controller = new AbortController();
  const wrapped: Array<{ opener: HTMLButtonElement; img: HTMLImageElement }> =
    [];
  for (const img of root.querySelectorAll<HTMLImageElement>(
    LIGHTBOX_IMAGE_SELECTOR,
  )) {
    const opener = elementFrom<HTMLButtonElement>(
      renderImageOpener({
        alt: img.alt,
        img: "",
        icon: !img.hasAttribute("data-gif"),
      }),
    );
    img.replaceWith(opener);
    opener.prepend(img);
    wrapped.push({ opener, img });
  }

  let closeOpen: (() => void) | undefined;

  /** 押した拡大のボタンの画像からライトボックスを開く */
  const open = (opener: HTMLButtonElement): void => {
    const items = collectLightboxImages(root);
    let index = Math.max(0, items.indexOf(opener));
    const scroll = { x: window.scrollX, y: window.scrollY };
    const dialog = elementFrom<HTMLDialogElement>(
      renderLightbox({
        src: "",
        alt: "",
        index: index + 1,
        total: items.length,
      }),
    );
    dialog.setAttribute("closedby", "any");
    const head = dialog.querySelector<HTMLElement>(".mdmark-lightbox-head");
    const stage = dialog.querySelector<HTMLElement>(".mdmark-lightbox-stage");
    const sizer = dialog.querySelector<HTMLElement>(".mdmark-lightbox-sizer");
    const img = dialog.querySelector<HTMLImageElement>("img");
    const caption = dialog.querySelector<HTMLElement>(
      ".mdmark-lightbox-caption",
    );
    const count = dialog.querySelector<HTMLElement>(".mdmark-lightbox-count");
    const moveButton = dialog.querySelector<HTMLButtonElement>(
      ".mdmark-lightbox-move",
    );
    const zoomButton = dialog.querySelector<HTMLButtonElement>(
      ".mdmark-lightbox-zoom",
    );
    const prev = dialog.querySelector<HTMLButtonElement>('[data-tool="prev"]');
    const next = dialog.querySelector<HTMLButtonElement>('[data-tool="next"]');
    if (!head || !stage || !sizer || !img || !caption) {
      return;
    }
    const dialogController = new AbortController();
    const { signal } = dialogController;
    const view = { scale: 1, fit: 1, loading: 0 };
    let zoom: ZoomControl | undefined;
    let moveMenu: StepMenuHandle | undefined;

    /** 移動のメニューを閉じる。メニューかボタンにフォーカスがあったときは倍率のボタンへ移す */
    const hideMove = (): void => {
      const focused =
        document.activeElement instanceof Element &&
        (document.activeElement === moveButton ||
          document.activeElement.closest(".mdmark-step-menu") !== null);
      moveMenu?.close({ restoreFocus: false });
      moveMenu = undefined;
      if (moveButton) {
        moveButton.hidden = true;
      }
      if (focused) {
        zoomButton?.focus({ preventScroll: true });
      }
    };

    /** 全体が収まる倍率で確認しているか */
    const atFit = (): boolean =>
      zoom === undefined || view.scale <= view.fit + ZOOM_EPSILON;

    /** 今の位置の画像・キャプション・枚数・切り替えのボタンを当て、読み込めたら全体が収まる倍率で拡大・縮小をもう一度付ける */
    const show = (): void => {
      hideMove();
      zoom?.detach();
      zoom = undefined;
      sizer.removeAttribute("style");
      img.removeAttribute("style");
      copyImage(items[index]?.querySelector("img") ?? null, { img, caption });
      if (count) {
        count.textContent = `${index + 1} / ${items.length}`;
      }
      if (prev) {
        prev.disabled = index <= 0;
      }
      if (next) {
        next.disabled = index >= items.length - 1;
      }
      view.loading += 1;
      const loading = view.loading;
      img
        .decode()
        .then(() => {
          if (loading !== view.loading || signal.aborted) {
            return;
          }
          const size = { width: img.naturalWidth, height: img.naturalHeight };
          img.style.width = `${size.width}px`;
          img.style.height = `${size.height}px`;
          zoom = attachZoom({
            viewport: stage,
            content: img,
            size,
            tools: head,
            keyTargets: [stage, head],
            onChange: (scale, fit) => {
              view.scale = scale;
              view.fit = fit;
              const zoomed = scale > fit + ZOOM_EPSILON;
              stage.classList.toggle("is-zoomed", zoomed);
              if (zoomed) {
                if (moveButton) {
                  moveButton.hidden = false;
                }
                moveMenu?.refresh();
              } else {
                hideMove();
              }
            },
          });
        })
        .catch(() => {});
    };

    /** 前後の画像へ送信する（端では切り替えない） */
    const go = (step: number): void => {
      const target = index + step;
      if (target < 0 || target >= items.length) {
        return;
      }
      index = target;
      show();
    };

    /** 受け取りと拡大・縮小を削除して `dialog` を削除し、フォーカスとスクロールの位置を開く前に戻す */
    const finish = (): void => {
      if (signal.aborted) {
        return;
      }
      dialogController.abort();
      moveMenu?.close({ restoreFocus: false });
      zoom?.detach();
      dialog.remove();
      closeOpen = undefined;
      opener.focus({ preventScroll: true });
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) {
        window.scrollTo(scroll.x, scroll.y);
      }
    };

    // 移動のボタン: 拡大中だけ出し、矢印キーと同じだけ動かすメニューを開く
    moveButton?.addEventListener(
      "click",
      () => {
        if (moveMenu) {
          moveMenu.close({ restoreFocus: false });
          moveMenu = undefined;
          return;
        }
        const items: StepMenuItem[] = MOVE_ITEMS.map((item) => ({
          label: item.label,
          icon: item.icon,
          enabled: () => item.can(stage),
          run: () => {
            stage.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: item.key,
                bubbles: true,
                cancelable: true,
              }),
            );
          },
        }));
        const opened = openStepMenu({
          opener: moveButton,
          label: "拡大した画像の移動",
          items,
          avoid: () => [head.getBoundingClientRect()],
        });
        const close = opened.close;
        opened.close = (options) => {
          close(options);
          if (moveMenu === opened) {
            moveMenu = undefined;
          }
        };
        moveMenu = opened;
      },
      { signal },
    );
    prev?.addEventListener("click", () => go(-1), { signal });
    next?.addEventListener("click", () => go(1), { signal });
    dialog
      .querySelector('[data-tool="close"]')
      ?.addEventListener("click", () => dialog.close(), { signal });
    // 全体が収まる倍率のときの左右の矢印キーで送信する。拡大中に動かした矢印キーは送信しない
    dialog.addEventListener(
      "keydown",
      (event) => {
        if (
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !atFit()
        ) {
          return;
        }
        const step =
          event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        if (step !== 0) {
          event.preventDefault();
          go(step);
        }
      },
      { signal },
    );
    // 画像の外の背景を押したら閉じる（`closedby` を持たないブラウザの `dialog` 自身も含む）。つかんで動かしたときは閉じない
    let down: { target: EventTarget | null; x: number; y: number } | undefined;
    dialog.addEventListener(
      "pointerdown",
      (event) => {
        down = { target: event.target, x: event.clientX, y: event.clientY };
      },
      { capture: true, signal },
    );
    dialog.addEventListener(
      "click",
      (event) => {
        const background = [dialog, stage, sizer];
        if (
          down !== undefined &&
          background.includes(down.target as HTMLElement) &&
          Math.hypot(event.clientX - down.x, event.clientY - down.y) <=
            CLICK_SLOP
        ) {
          dialog.close();
        }
        down = undefined;
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
    show();
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
    for (const { opener, img } of wrapped) {
      opener.replaceWith(img);
    }
  };
}
