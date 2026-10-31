import type { TooltipPlacement } from "../config.ts";
import { fitScale, ZOOM } from "../diagram/geometry.ts";
import { iconSvg } from "../parts/icons.ts";
import { attachDiagramTips } from "./diagram-tips.ts";

export { ZOOM };

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// 文字を選べる所（ここではドラッグを始めない）と、押せる所
const TEXT_SELECTOR =
  ".mdmark-diagram-node-kind, .mdmark-diagram-node-name, .mdmark-diagram-node-sub, .mdmark-diagram-label, .mdmark-diagram-frame-title, .mdmark-diagram-lane-label, .mdmark-diagram-axis-text, .mdmark-diagram-value-text, .mdmark-term";
const CONTROL_SELECTOR = "button, a, input";

// キーと操作の対応: 表示する枠にフォーカスがあるとき
const KEY_ACTIONS: Record<string, ViewAction> = {
  "+": "in",
  "=": "in",
  "-": "out",
  "0": "fit",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/** 表示の操作の名前（ボタンの `data-tool` と同じ） */
type ViewAction = "in" | "out" | "fit" | "left" | "right" | "up" | "down";

/** 矢印キーとボタンで動かす向き */
const PAN_ACTIONS = new Set<ViewAction>(["left", "right", "up", "down"]);

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
  const sizer = figure.querySelector<HTMLElement>(".mdmark-diagram-sizer");
  const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const zoomText = figure.querySelector<HTMLButtonElement>(
    ".mdmark-diagram-zoom",
  );
  const panGroup = figure.querySelector<HTMLElement>('[data-group="pan"]');
  const heads = figure.querySelector<HTMLElement>(".mdmark-diagram-seq-heads");
  const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
  if (!viewport || !sizer || !stage || !zoomText || !panGroup || !box) {
    return () => {};
  }
  const button = (name: string): HTMLButtonElement | null =>
    figure.querySelector<HTMLButtonElement>(`[data-tool="${name}"]`);
  const content = {
    width: Number.parseFloat(stage.style.width),
    height: Number.parseFloat(stage.style.height),
  };
  const state = { scale: 1, fit: 1, atFit: true };
  const controller = new AbortController();
  const { signal } = controller;

  /** シーケンス図の相手の名前の行を、表示する枠の上端に留める（図の座標で縦に動いた分だけ下げる） */
  const stickHeads = (): void => {
    if (!heads) {
      return;
    }
    heads.style.transform = `translateY(${viewport.scrollTop / state.scale}px)`;
    heads.classList.toggle("is-stuck", viewport.scrollTop > 0);
  };

  /** 枠に図の全体が収まる倍率。文書の中は幅だけ、モーダルの中は幅と高さで決める */
  const computeFit = (): number =>
    // 隠れた場所（閉じた節・選んでいないタブ）では枠の幅が 0 なので、表示されて大きさが変わるまで等倍にする
    viewport.clientWidth === 0
      ? 1
      : fitScale(content, {
          width: viewport.clientWidth,
          height: modal ? viewport.clientHeight : Number.POSITIVE_INFINITY,
        });

  /** 倍率を当て、ボタンの有効・無効と移動のボタンの有無を合わせる */
  const apply = (scale: number): void => {
    state.scale = scale;
    stage.style.transform = `scale(${scale})`;
    sizer.style.width = `${content.width * scale}px`;
    sizer.style.height = `${content.height * scale}px`;
    // 文書の中では、使う側が高さを変えたときに図の全体が収まる高さまで広げられるよう、上限を今の倍率の図の高さにする
    if (!modal) {
      viewport.style.maxHeight = `${content.height * scale}px`;
    }
    stickHeads();
    // 倍率のボタン: 今の倍率を出し、押すと開いたときの倍率と位置に戻ることを読み上げの名前に書く
    zoomText.textContent = `${Math.round(scale * 100)}%`;
    zoomText.setAttribute(
      "aria-label",
      `倍率 ${zoomText.textContent}。全体が収まる倍率に戻す`,
    );
    const out = button("out");
    const zoomIn = button("in");
    if (out) {
      out.disabled = scale <= state.fit + ZOOM_EPSILON;
    }
    if (zoomIn) {
      zoomIn.disabled = scale >= ZOOM.max - ZOOM_EPSILON;
    }
    // 図の全体が見えている間は、移動のボタンは何も動かさないので出さない
    panGroup.hidden =
      content.width * scale <= viewport.clientWidth + 1 &&
      content.height * scale <= viewport.clientHeight + 1;
    // 押したボタンが押せなくなった・消えたときは、フォーカスを表示する枠へ移して失わせない
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      figure.contains(active) &&
      ((active as HTMLButtonElement).disabled ||
        (panGroup.contains(active) && panGroup.hidden))
    ) {
      viewport.focus({ preventScroll: true });
    }
  };

  /** 開いたときの倍率（全体が収まる倍率）と位置に戻す。文書の中では表示する枠の高さを、全体が収まる高さと `--mdmark-diagram-max-height` の小さいほうにする */
  const reset = (): void => {
    state.fit = computeFit();
    state.atFit = true;
    if (!modal) {
      viewport.style.maxHeight = "";
      const cap = Number.parseFloat(getComputedStyle(viewport).maxHeight);
      const height = content.height * state.fit;
      viewport.style.height = `${Number.isNaN(cap) ? height : Math.min(height, cap)}px`;
    }
    apply(state.fit);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  };

  /** 表示する枠の中央を保ったまま倍率を変える */
  const zoomTo = (scale: number): void => {
    const next = Math.min(ZOOM.max, Math.max(state.fit, scale));
    const cx = (viewport.scrollLeft + viewport.clientWidth / 2) / state.scale;
    const cy = (viewport.scrollTop + viewport.clientHeight / 2) / state.scale;
    state.atFit = Math.abs(next - state.fit) < ZOOM_EPSILON;
    apply(next);
    viewport.scrollLeft = cx * next - viewport.clientWidth / 2;
    viewport.scrollTop = cy * next - viewport.clientHeight / 2;
    if (state.atFit) {
      reset();
    }
  };

  /** 図を動かす（右・下が正） */
  const pan = (dx: number, dy: number): void => {
    viewport.scrollLeft += dx;
    viewport.scrollTop += dy;
    state.atFit = false;
  };

  const actions: Record<ViewAction, () => void> = {
    in: () => zoomTo(state.scale * ZOOM.step),
    out: () => zoomTo(state.scale / ZOOM.step),
    fit: reset,
    left: () => pan(-ZOOM.pan, 0),
    right: () => pan(ZOOM.pan, 0),
    up: () => pan(0, -ZOOM.pan),
    down: () => pan(0, ZOOM.pan),
  };
  for (const name of Object.keys(actions) as ViewAction[]) {
    button(name)?.addEventListener("click", actions[name], { signal });
  }

  // キー: 表示の箱（右上のボタンと表示する枠）にフォーカスがあるとき、+・-・0 で拡大・縮小・戻す、矢印キーで動かす。動かせる向きがあるときだけ文書のスクロールを止める
  box.addEventListener(
    "keydown",
    (event) => {
      const name = KEY_ACTIONS[event.key];
      if (!name || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (PAN_ACTIONS.has(name) && panGroup.hidden) {
        return;
      }
      event.preventDefault();
      actions[name]();
    },
    { signal },
  );

  // ドラッグ: 文字と押せる所の外でつかんで動かす。ドラッグ中は文字を選ばせない
  let drag:
    | { x: number; y: number; left: number; top: number; id: number }
    | undefined;
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (
        event.button !== 0 ||
        (event.target as Element).closest(
          `${TEXT_SELECTOR}, ${CONTROL_SELECTOR}`,
        )
      ) {
        return;
      }
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        id: event.pointerId,
      };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    },
    { signal },
  );
  viewport.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
      if (event.clientX !== drag.x || event.clientY !== drag.y) {
        state.atFit = false;
      }
    },
    { signal },
  );
  const endDrag = (): void => {
    drag = undefined;
    viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", endDrag, { signal });
  viewport.addEventListener("pointercancel", endDrag, { signal });

  // スクロール: 相手の名前の行を上端に留め、Shift＋ホイールなどで動いたときも開いたときの位置から外れたことにする
  viewport.addEventListener(
    "scroll",
    () => {
      stickHeads();
      if (viewport.scrollLeft || viewport.scrollTop) {
        state.atFit = false;
      }
    },
    { passive: true, signal },
  );

  // 表示する枠の大きさが変わったとき（画面の幅・縦のスクロールバーの出入り・モーダルの高さ）: 全体が収まる倍率で見ていたなら、新しい大きさで収まる倍率に合わせ直す。文書の中では高さは reset が決めるので、幅の変化だけを見る
  const sizeOf = (): string =>
    `${viewport.clientWidth}x${modal ? viewport.clientHeight : 0}`;
  let lastSize = sizeOf();
  const observer = new ResizeObserver(() => {
    const size = sizeOf();
    if (size === lastSize) {
      return;
    }
    lastSize = size;
    if (state.atFit) {
      reset();
    } else {
      state.fit = computeFit();
      apply(Math.max(state.fit, state.scale));
    }
  });
  observer.observe(viewport);

  reset();

  return () => {
    observer.disconnect();
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
