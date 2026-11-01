import { renderGifToggle } from "../parts/gif.ts";

// 拡大のボタン（GIF を包むときはボタンごと包む）
const OPENER_SELECTOR = "button.mdmark-image-open";

/** 止める・再生するボタンの状態を、`renderGifToggle` が出す属性に合わせる */
function applyToggleState(toggle: HTMLButtonElement, paused: boolean): void {
  const template = document.createElement("template");
  template.innerHTML = renderGifToggle({ paused });
  const rendered = template.content.firstElementChild;
  for (const name of ["aria-pressed", "aria-label", "title"]) {
    toggle.setAttribute(name, rendered?.getAttribute(name) ?? "");
  }
}

/** GIF の画像を包み、最初のフレームの絵と止める・再生するボタンを付ける。外す関数を返す */
export function attachGifs(root: HTMLElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const wrapped: Array<{
    wrapper: HTMLElement;
    target: HTMLElement;
    img: HTMLImageElement;
  }> = [];
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  for (const img of root.querySelectorAll<HTMLImageElement>("img[data-gif]")) {
    img
      .decode()
      .then(() => {
        if (signal.aborted || !img.isConnected) {
          return;
        }
        const opener = img.parentElement?.closest<HTMLElement>(OPENER_SELECTOR);
        const target = opener?.contains(img) ? opener : img;
        // 止めたときに見せる最初のフレーム
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        canvas.setAttribute("aria-hidden", "true");
        canvas.hidden = true;
        const wrapper = document.createElement("span");
        wrapper.className = "mdmark-gif";
        const template = document.createElement("template");
        template.innerHTML = renderGifToggle({ paused: false });
        const toggle = template.content.firstElementChild as HTMLButtonElement;
        target.replaceWith(wrapper);
        wrapper.append(target, canvas, toggle);
        wrapped.push({ wrapper, target, img });

        /** 止めるか再生するかを、絵・画像・ボタンに当てる */
        const setPaused = (paused: boolean): void => {
          canvas.hidden = !paused;
          img.style.visibility = paused ? "hidden" : "";
          applyToggleState(toggle, paused);
        };
        toggle.addEventListener(
          "click",
          () => setPaused(toggle.getAttribute("aria-pressed") !== "true"),
          { signal },
        );
        if (reduceMotion) {
          setPaused(true);
        }
      })
      .catch(() => {});
  }
  return () => {
    controller.abort();
    for (const { wrapper, target, img } of wrapped) {
      img.style.visibility = "";
      wrapper.replaceWith(target);
    }
  };
}
