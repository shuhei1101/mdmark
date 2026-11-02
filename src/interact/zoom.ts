import { fitScale, ZOOM } from "../diagram/geometry.ts";

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// ドラッグを始めない、押せる所
const CONTROL_SELECTOR = "button, a, input";

/** 表示の操作の名前（ボタンの `data-tool` と同じ） */
type ZoomAction = "in" | "out" | "fit" | "left" | "right" | "up" | "down";

// キーと操作の対応: 表示する枠かボタンにフォーカスがあるとき
const KEY_ACTIONS: Record<string, ZoomAction> = {
  "+": "in",
  "=": "in",
  "-": "out",
  "0": "fit",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/** 矢印キーとボタンで動かす向き */
const PAN_ACTIONS = new Set<ZoomAction>(["left", "right", "up", "down"]);

/** 倍率が変わったときに呼ぶ関数 */
export type ZoomChange = (zoom: number, fit: number) => void;

/** `attachZoom` が返す操作 */
export type ZoomControl = {
  /** 全体が収まる倍率と位置に戻す */
  reset(): void;
  /** 今の全体が収まる倍率を返す */
  fit(): number;
  /** 付けた操作と監視を外す */
  detach(): void;
};

/** 表示する枠と中身に、全体が収まる倍率から `ZOOM.max` までの拡大・縮小と、拡大中の移動（ボタン・キー・ドラッグ）を付ける */
export function attachZoom(options: {
  /** 表示する枠 */
  viewport: HTMLElement;
  /** 倍率を掛ける中身（親の要素を倍率を掛けた大きさの箱にする） */
  content: HTMLElement;
  /** 中身の大きさ */
  size: { width: number; height: number };
  /** `data-tool` のボタンと `data-group="pan"` のまとまりを持つ要素 */
  tools: HTMLElement;
  /** 倍率が変わったときに呼ぶ関数（ボタンの状態を書き換える前に呼ぶ） */
  onChange?: ZoomChange;
  /** 全体が収まる倍率を高さでも決めるか（既定 `true`。文書の中の図は幅だけで決める） */
  fitHeight?: boolean;
  /** ドラッグを始めない要素のセレクタ（押せる所に加える） */
  dragIgnore?: string;
  /** キーを受ける要素（既定は表示する枠とボタンを持つ要素） */
  keyTargets?: HTMLElement[];
}): ZoomControl {
  const {
    viewport,
    content,
    size,
    tools,
    onChange,
    fitHeight = true,
    dragIgnore,
    keyTargets = [viewport, tools],
  } = options;
  const sizer = content.parentElement ?? content;
  const zoomText = tools.querySelector<HTMLElement>('[data-tool="fit"]');
  const panGroup = tools.querySelector<HTMLElement>('[data-group="pan"]');
  const button = (name: ZoomAction): HTMLButtonElement | null =>
    tools.querySelector<HTMLButtonElement>(`[data-tool="${name}"]`);
  const state = { scale: 1, fit: 1, atFit: true };
  const controller = new AbortController();
  const { signal } = controller;

  /** 枠に中身の全体が収まる倍率 */
  const computeFit = (): number =>
    // 隠れた場所（閉じた節・選んでいないタブ）では枠の幅が 0 なので、表示されて大きさが変わるまで等倍にする
    viewport.clientWidth === 0
      ? 1
      : fitScale(size, {
          width: viewport.clientWidth,
          height: fitHeight ? viewport.clientHeight : Number.POSITIVE_INFINITY,
        });

  /** 中身が表示する枠からはみ出しているか */
  const overflows = (): boolean =>
    size.width * state.scale > viewport.clientWidth + 1 ||
    size.height * state.scale > viewport.clientHeight + 1;

  /** 倍率を当て、ボタンの有効・無効と倍率の文字と移動のボタンの有無を合わせる */
  const apply = (scale: number): void => {
    state.scale = scale;
    content.style.transform = `scale(${scale})`;
    sizer.style.width = `${size.width * scale}px`;
    sizer.style.height = `${size.height * scale}px`;
    onChange?.(scale, state.fit);
    if (zoomText) {
      zoomText.textContent = `${Math.round(scale * 100)}%`;
      zoomText.setAttribute(
        "aria-label",
        `倍率 ${zoomText.textContent}。全体が収まる倍率に戻す`,
      );
    }
    const out = button("out");
    const zoomIn = button("in");
    if (out) {
      out.disabled = scale <= state.fit + ZOOM_EPSILON;
    }
    if (zoomIn) {
      zoomIn.disabled = scale >= ZOOM.max - ZOOM_EPSILON;
    }
    // 全体が見えている間は、移動のボタンは何も動かさないので出さない
    if (panGroup) {
      panGroup.hidden = !overflows();
    }
    // 押したボタンが押せなくなった・消えたときは、フォーカスを表示する枠へ移して失わせない
    const active = document.activeElement;
    if (
      active instanceof HTMLButtonElement &&
      tools.contains(active) &&
      (active.disabled || (panGroup?.contains(active) && panGroup.hidden))
    ) {
      viewport.focus({ preventScroll: true });
    }
  };

  /** 全体が収まる倍率と位置に戻す */
  const reset = (): void => {
    state.fit = computeFit();
    state.atFit = true;
    apply(state.fit);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  };

  /** 表示する枠の中央を保ったまま倍率を変える */
  const zoomTo = (scale: number): void => {
    const next = Math.min(ZOOM.max, Math.max(state.fit, scale));
    if (Math.abs(next - state.fit) < ZOOM_EPSILON) {
      reset();
      return;
    }
    const cx = (viewport.scrollLeft + viewport.clientWidth / 2) / state.scale;
    const cy = (viewport.scrollTop + viewport.clientHeight / 2) / state.scale;
    state.atFit = false;
    apply(next);
    viewport.scrollLeft = cx * next - viewport.clientWidth / 2;
    viewport.scrollTop = cy * next - viewport.clientHeight / 2;
  };

  /** 中身を動かす（右・下が正） */
  const pan = (dx: number, dy: number): void => {
    viewport.scrollLeft += dx;
    viewport.scrollTop += dy;
    state.atFit = false;
  };

  const actions: Record<ZoomAction, () => void> = {
    in: () => zoomTo(state.scale * ZOOM.step),
    out: () => zoomTo(state.scale / ZOOM.step),
    fit: reset,
    left: () => pan(-ZOOM.pan, 0),
    right: () => pan(ZOOM.pan, 0),
    up: () => pan(0, -ZOOM.pan),
    down: () => pan(0, ZOOM.pan),
  };
  for (const name of Object.keys(actions) as ZoomAction[]) {
    button(name)?.addEventListener("click", actions[name], { signal });
  }

  // キー: +・-・0 で拡大・縮小・戻す、矢印キーで動かす。動かせるときだけ既定の動きを止める
  const onKey = (event: KeyboardEvent): void => {
    const name = KEY_ACTIONS[event.key];
    if (
      !name ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }
    if (PAN_ACTIONS.has(name) && !overflows()) {
      return;
    }
    event.preventDefault();
    actions[name]();
  };
  for (const target of new Set(keyTargets)) {
    target.addEventListener("keydown", onKey, { signal });
  }

  // ドラッグ: 押せる所（と `dragIgnore`）の外でつかんで動かす。ドラッグ中は文字を選ばせない
  const ignore = dragIgnore
    ? `${dragIgnore}, ${CONTROL_SELECTOR}`
    : CONTROL_SELECTOR;
  let drag:
    | { x: number; y: number; left: number; top: number; id: number }
    | undefined;
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || (event.target as Element).closest(ignore)) {
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

  // スクロール: Shift＋ホイールなどで動いたときも、全体が収まる位置から外れたことにする
  viewport.addEventListener(
    "scroll",
    () => {
      if (viewport.scrollLeft || viewport.scrollTop) {
        state.atFit = false;
      }
    },
    { passive: true, signal },
  );

  // 表示する枠の大きさが変わったとき: 全体が収まる倍率で見ていたなら、新しい大きさで収まる倍率に合わせ直す
  const sizeOf = (): string =>
    `${viewport.clientWidth}x${fitHeight ? viewport.clientHeight : 0}`;
  let lastSize = sizeOf();
  const observer = new ResizeObserver(() => {
    const current = sizeOf();
    if (current === lastSize) {
      return;
    }
    lastSize = current;
    if (state.atFit) {
      reset();
    } else {
      state.fit = computeFit();
      apply(Math.max(state.fit, state.scale));
    }
  });
  observer.observe(viewport);

  reset();

  return {
    reset,
    fit: () => state.fit,
    detach: () => {
      observer.disconnect();
      controller.abort();
    },
  };
}
