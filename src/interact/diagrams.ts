import type { TooltipPlacement } from "../config.ts";
import { ZOOM } from "../diagram/geometry.ts";
import { iconSvg } from "../parts/icons.ts";
import { attachDiagramTips } from "./diagram-tips.ts";
import { attachZoom } from "./zoom.ts";

export { ZOOM };

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// 文字を選べる所（ここではドラッグを始めない）
const TEXT_SELECTOR =
  ".mdmark-diagram-node-kind, .mdmark-diagram-node-name, .mdmark-diagram-node-sub, .mdmark-diagram-label, .mdmark-diagram-frame-title, .mdmark-diagram-lane-label, .mdmark-diagram-axis-text, .mdmark-diagram-value-text, .mdmark-term";

// 操作を付けた回数の通し番号。`id` を重ならせないために使う
let attachCounter = 0;

/** 図の `id` の頭 `from` を `to` に振り直し、それを指す属性も合わせて直す */
export function renumberIds(
  scope: HTMLElement,
  from: string,
  to: string,
): void {
  if (from === "") {
    return;
  }
  const head = `${from}-`;
  const swap = (value: string): string =>
    value.startsWith(head) ? `${to}-${value.slice(head.length)}` : value;
  for (const element of scope.querySelectorAll("[id]")) {
    element.id = swap(element.id);
  }
  if (scope.id) {
    scope.id = swap(scope.id);
  }
  for (const name of ["aria-describedby", "aria-labelledby", "for"]) {
    for (const element of [scope, ...scope.querySelectorAll(`[${name}]`)]) {
      const value = element.getAttribute(name);
      if (value !== null) {
        element.setAttribute(name, value.split(/\s+/).map(swap).join(" "));
      }
    }
  }
  // 矢じりと塗りの模様の参照
  for (const name of ["marker-end", "fill"]) {
    for (const element of scope.querySelectorAll(`[${name}]`)) {
      const value = element.getAttribute(name) ?? "";
      element.setAttribute(name, value.replace(`url(#${head}`, `url(#${to}-`));
    }
  }
}

/** 図 1 つの倍率と位置の操作（右上のボタン・キー・ドラッグ）を付け、操作と監視を外す関数を返す */
function attachView(
  figure: HTMLElement,
  options: { modal: boolean },
): () => void {
  const { modal } = options;
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );
  const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const heads = figure.querySelector<HTMLElement>(".mdmark-diagram-seq-heads");
  const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
  if (!viewport || !stage || !box) {
    return () => {};
  }
  const content = {
    width: Number.parseFloat(stage.style.width),
    height: Number.parseFloat(stage.style.height),
  };
  let scale = 1;

  /** シーケンス図の相手の名前の行を、表示する枠の上端に留める（図の座標で縦に動いた分だけ下げる） */
  const stickHeads = (): void => {
    if (!heads) {
      return;
    }
    heads.style.transform = `translateY(${viewport.scrollTop / scale}px)`;
    heads.classList.toggle("is-stuck", viewport.scrollTop > 0);
  };

  /** 倍率が変わったとき: 文書の中では表示する枠の高さを合わせ、相手の名前の行を留め直す */
  const onChange = (zoom: number, fit: number): void => {
    scale = zoom;
    if (!modal) {
      // 全体が収まる倍率では、高さを全体が収まる高さと `--mdmark-diagram-max-height` の小さいほうにする
      if (Math.abs(zoom - fit) < ZOOM_EPSILON) {
        viewport.style.maxHeight = "";
        const cap = Number.parseFloat(getComputedStyle(viewport).maxHeight);
        const height = content.height * fit;
        viewport.style.height = `${Number.isNaN(cap) ? height : Math.min(height, cap)}px`;
      }
      // 使う側が高さを変えたときに図の全体が収まる高さまで広げられるよう、上限を今の倍率の図の高さにする
      viewport.style.maxHeight = `${content.height * zoom}px`;
    }
    stickHeads();
  };

  const controller = new AbortController();
  viewport.addEventListener("scroll", stickHeads, {
    passive: true,
    signal: controller.signal,
  });
  const zoom = attachZoom({
    viewport,
    content: stage,
    size: content,
    tools: figure,
    onChange,
    fitHeight: modal,
    dragIgnore: TEXT_SELECTOR,
    keyTargets: [box],
  });

  return () => {
    zoom.detach();
    controller.abort();
  };
}

/** 全画面の枠に写した図を、モーダルの図にする: 開いている状態を外し、`id` を写しと重ならない値にし、全画面のボタンを閉じるボタンにする */
function prepareModalFigure(figure: HTMLElement): HTMLElement {
  const copy = figure.cloneNode(true) as HTMLElement;
  const title = copy.querySelector(".mdmark-diagram-head")?.id ?? "";
  const from = title.replace(/-title$/, "");
  renumberIds(copy, from, `${from}-modal`);
  for (const tip of copy.querySelectorAll<HTMLElement>(".mdmark-diagram-tip")) {
    tip.hidden = true;
    tip.style.left = "";
    tip.style.top = "";
  }
  for (const wire of copy.querySelectorAll(".mdmark-diagram-wire.is-active")) {
    wire.classList.remove("is-active");
  }
  const viewport = copy.querySelector<HTMLElement>(".mdmark-diagram-viewport");
  if (viewport) {
    viewport.style.height = "";
    viewport.style.maxHeight = "";
  }
  const opener = copy.querySelector<HTMLButtonElement>(
    '[data-tool="fullscreen"]',
  );
  if (opener) {
    opener.dataset.tool = "close";
    opener.setAttribute("aria-label", "全画面を閉じる");
    opener.innerHTML = iconSvg("x");
  }
  return copy;
}

/** 図を全画面のモーダルで開き、開いた全画面を閉じる関数を返す。閉じるボタンか Esc で閉じたら、付けた操作と監視を外して `dialog` を消し、フォーカスを全画面のボタンへ戻す */
export function openDiagramDialog(options: {
  /** 開く図 */
  figure: HTMLElement;
  /** 全画面のボタン */
  opener: HTMLButtonElement;
  /** モーダルの中のツールチップを先に出す側 */
  placement: TooltipPlacement;
}): () => void {
  const { figure, opener, placement } = options;
  const host = figure.closest<HTMLElement>(".mdmark") ?? document.body;
  const dialog = document.createElement("dialog");
  dialog.className = "mdmark-diagram-dialog";
  const modalFigure = prepareModalFigure(figure);
  dialog.append(modalFigure);
  host.append(dialog);
  dialog.showModal();
  const detachView = attachView(modalFigure, { modal: true });
  const tips = attachDiagramTips({ figure: modalFigure, placement });
  const heading = modalFigure.querySelector(".mdmark-diagram-head");
  if (heading) {
    dialog.setAttribute("aria-labelledby", heading.id);
  }
  const closeButton = modalFigure.querySelector<HTMLButtonElement>(
    '[data-tool="close"]',
  );
  closeButton?.addEventListener("click", () => dialog.close());
  // ツールチップを開いている間の Esc は、ツールチップだけを閉じる（close request を起こさない）
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tips.closeOpen()) {
      event.preventDefault();
    }
  });
  modalFigure.querySelector<HTMLElement>(".mdmark-diagram-viewport")?.focus();
  dialog.addEventListener(
    "close",
    () => {
      tips.detach();
      detachView();
      dialog.remove();
      opener.focus();
    },
    { once: true },
  );
  return () => {
    if (dialog.open) {
      dialog.close();
    }
  };
}

/** `root` の中の図ごとに、開いたときの倍率を当て、拡大・縮小・移動・全画面のボタンとキー・ドラッグ、ツールチップを付ける。付けた操作と監視を外し、開いている全画面を閉じる関数を返す */
export function attachDiagrams(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 図のツールチップを先に出す側（`attachDiagramTips` と `openDiagramDialog` へ渡す） */
  placement: TooltipPlacement;
}): () => void {
  const { root, placement } = options;
  attachCounter += 1;
  const detachers: Array<() => void> = [];
  const figures = [
    ...root.querySelectorAll<HTMLElement>("figure.mdmark-diagram"),
  ].filter((figure) => !figure.closest("dialog"));
  figures.forEach((figure, index) => {
    const title = figure.querySelector(".mdmark-diagram-head")?.id ?? "";
    // 同じページに文書を 2 つ以上描いても `id` が重ならないよう振り直す
    renumberIds(
      figure,
      title.replace(/-title$/, ""),
      `mdmark-diagram-${attachCounter}-${index}`,
    );
    detachers.push(attachView(figure, { modal: false }));
    const tips = attachDiagramTips({ figure, placement });
    detachers.push(tips.detach);
    const opener = figure.querySelector<HTMLButtonElement>(
      '[data-tool="fullscreen"]',
    );
    let closeDialog: (() => void) | undefined;
    const onOpen = (): void => {
      if (opener) {
        closeDialog = openDiagramDialog({ figure, opener, placement });
      }
    };
    opener?.addEventListener("click", onOpen);
    detachers.push(() => {
      opener?.removeEventListener("click", onOpen);
      closeDialog?.();
    });
  });
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
