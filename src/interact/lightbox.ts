import { renderImageOpener } from "../parts/image.ts";
import { renderLightbox } from "../parts/lightbox.ts";
import { attachZoom, type ZoomControl } from "./zoom.ts";

/** 拡大のボタンで包む画像 */
export const LIGHTBOX_IMAGE_SELECTOR =
  "figure.mdmark-image img:not([data-nolightbox])";

// 拡大のボタン
const OPENER_SELECTOR = "button.mdmark-image-open";

// 押した所から離した所までがこの距離（px）以下なら、つかんで動かしたのではなく押したとみなす
const CLICK_SLOP = 4;

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

/** HTML 文字列の最初の要素を作る */
function elementFrom<T extends Element>(html: string): T {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as T;
}

/** `root` の中の拡大のボタンを文書の順に並べ、今の配色で隠れている図の中のものを除いて返す */
export function collectLightboxImages(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(OPENER_SELECTOR)].filter(
    (opener) => {
      const figure = opener.closest("figure");
      return figure === null || getComputedStyle(figure).display !== "none";
    },
  );
}

/** 画像を拡大のボタンで包み、押すとライトボックスで開いて送り・拡大・縮小・移動を付ける。外す関数を返す */
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
    const prev = dialog.querySelector<HTMLButtonElement>('[data-tool="prev"]');
    const next = dialog.querySelector<HTMLButtonElement>('[data-tool="next"]');
    if (!head || !stage || !sizer || !img || !caption) {
      return;
    }
    const dialogController = new AbortController();
    const { signal } = dialogController;
    const view = { scale: 1, fit: 1, loading: 0 };
    let zoom: ZoomControl | undefined;

    /** 全体が収まる倍率で見ているか */
    const atFit = (): boolean =>
      zoom === undefined || view.scale <= view.fit + ZOOM_EPSILON;

    /** 今の位置の画像・キャプション・枚数・送りのボタンを当て、読めたら全体が収まる倍率で拡大・縮小を付け直す */
    const show = (): void => {
      zoom?.detach();
      zoom = undefined;
      const source = items[index]?.querySelector("img");
      sizer.removeAttribute("style");
      img.removeAttribute("style");
      img.src = source?.currentSrc || source?.src || "";
      img.alt = source?.alt ?? "";
      const text =
        source?.closest("figure")?.querySelector("figcaption")?.textContent ??
        "";
      caption.textContent = text;
      caption.hidden = text === "";
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
              stage.classList.toggle("is-zoomed", scale > fit + ZOOM_EPSILON);
            },
          });
        })
        .catch(() => {});
    };

    /** 前後の画像へ送る（端では送らない） */
    const go = (step: number): void => {
      const target = index + step;
      if (target < 0 || target >= items.length) {
        return;
      }
      index = target;
      show();
    };

    /** 受け取りと拡大・縮小を外して `dialog` を消し、フォーカスとスクロールの位置を開く前に戻す */
    const finish = (): void => {
      if (signal.aborted) {
        return;
      }
      dialogController.abort();
      zoom?.detach();
      dialog.remove();
      closeOpen = undefined;
      opener.focus({ preventScroll: true });
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y) {
        window.scrollTo(scroll.x, scroll.y);
      }
    };

    prev?.addEventListener("click", () => go(-1), { signal });
    next?.addEventListener("click", () => go(1), { signal });
    dialog
      .querySelector('[data-tool="close"]')
      ?.addEventListener("click", () => dialog.close(), { signal });
    // 全体が収まる倍率のときの左右の矢印キーで送る。拡大中に動かした矢印キーは送らない
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
