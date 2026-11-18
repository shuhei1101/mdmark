import { fitScale, ZOOM } from "../diagram/geometry.ts";

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

// ドラッグを始めない、押せる所
const CONTROL_SELECTOR = "button, a, input";

// 押せる所のうち、上からもドラッグを始めるリンク先を持つノードのリンク
const NODE_LINK_SELECTOR = ".mdmark-diagram-node-link";

/** 押した位置からこの px を超えて動いたときだけ図を動かしたことにし、リンク先を開かない。超えないうちはグラフの項目のツールチップを優先する */
export const DRAG_THRESHOLD = 4;

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

/** `attachZoom` が返却する操作 */
export type ZoomControl = {
  /** 全体が収まる倍率と位置に戻す */
  reset(): void;
  /** 今の全体が収まる倍率を返却する */
  fit(): number;
  /** 今の倍率と位置を保ったまま、全体が収まる倍率とボタンの状態をもう一度求める */
  refit(): void;
  /** 中身の座標の矩形と周りの余白が表示する枠に収まる倍率と位置へ、`duration` ミリ秒かけて移す */
  focusRect(
    rect: FocusRect,
    options: { margin: number; duration: number },
  ): void;
  /** 付けた操作と監視を解除する */
  detach(): void;
};

/** 倍率を掛ける前の中身の座標の矩形 */
export type FocusRect = { x: number; y: number; width: number; height: number };

// 付けた表示する枠ごとの操作
const controls = new WeakMap<HTMLElement, ZoomControl>();

/** `attachZoom` を付けた表示する枠の操作を返却する（付けていなければ `undefined`） */
export const zoomControlOf = (viewport: HTMLElement): ZoomControl | undefined =>
  controls.get(viewport);

// 読者が操作したとみなすイベント（矩形へ移している途中で止める）
const STOP_EVENTS = ["wheel", "pointerdown", "keydown", "touchstart"] as const;

/** 表示する枠の操作とツールのボタン（`data-tool`）の押下で `stop` を呼ぶ（帯の区切りなど、ほかの押下では止めない） */
const listenStops = (options: {
  viewport: HTMLElement;
  tools: HTMLElement;
  stop: () => void;
  signal: AbortSignal;
}): void => {
  const { viewport, tools, stop, signal } = options;
  for (const type of STOP_EVENTS)
    viewport.addEventListener(type, stop, { passive: true, signal });
  tools.addEventListener(
    "click",
    (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-tool]")
      )
        stop();
    },
    { signal },
  );
};

/** 表示する枠と中身に、全体が収まる倍率から `ZOOM.max` までの拡大・縮小と、拡大中の移動（ボタン・キー・ドラッグ）を付ける */
export function attachZoom(options: {
  /** 表示する枠 */
  viewport: HTMLElement;
  /** 倍率を掛ける中身（親の要素を倍率を掛けた大きさのノードにする） */
  content: HTMLElement;
  /** 中身の大きさ */
  size: { width: number; height: number };
  /** `data-tool` のボタンと `data-group="pan"` のまとまりを持つ要素 */
  tools: HTMLElement;
  /** 倍率が変わったときに呼ぶ関数（ボタンの状態を書き換える前に呼ぶ） */
  onChange?: ZoomChange;
  /** ドラッグで動かし始めたときに呼ぶ関数 */
  onPanStart?: () => void;
  /** 全体が収まる倍率を高さでも決めるか（既定 `true`。文書の中の図は幅だけで決める）。関数のときは倍率を求めるたびに呼ぶ */
  fitHeight?: boolean | (() => boolean);
  /** ドラッグを始めない要素のセレクタ（押せる所に加える） */
  dragIgnore?: string;
  /** キーを受ける要素（既定は表示する枠とボタンを持つ要素） */
  keyTargets?: HTMLElement[];
  /** 倍率の文字の基準（`fit` は全体が収まる倍率、`content` は中身の大きさを 100% とする。既定 `content`） */
  percentBase?: "fit" | "content";
  /** 全体が収まる倍率の下限（既定は下限なし） */
  fitMin?: number;
}): ZoomControl {
  const {
    viewport,
    content,
    size,
    tools,
    onChange,
    onPanStart,
    fitHeight = true,
    dragIgnore,
    keyTargets = [viewport, tools],
    percentBase = "content",
    fitMin = 0,
  } = options;
  const sizer = content.parentElement ?? content;
  const zoomText = tools.querySelector<HTMLElement>('[data-tool="fit"]');
  const panGroup = tools.querySelector<HTMLElement>('[data-group="pan"]');
  const button = (name: ZoomAction): HTMLButtonElement | null =>
    tools.querySelector<HTMLButtonElement>(`[data-tool="${name}"]`);
  const state = { scale: 1, fit: 1, atFit: true };
  /** 全体が収まる倍率を高さでも決めるか */
  const useHeight = (): boolean =>
    typeof fitHeight === "function" ? fitHeight() : fitHeight;
  const controller = new AbortController();
  const { signal } = controller;

  /** 枠に中身の全体が収まる倍率 */
  const computeFit = (): number =>
    // 隠れた場所（閉じたセクション・選んでいないタブ）では枠の幅が 0 なので、表示されて大きさが変わるまで等倍にする
    viewport.clientWidth === 0
      ? 1
      : Math.max(
          fitMin,
          fitScale(size, {
            width: viewport.clientWidth,
            height: useHeight()
              ? viewport.clientHeight
              : Number.POSITIVE_INFINITY,
          }),
        );

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
    showZoomText(scale);
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
    keepFocus();
  };
  /** 倍率の文字とスクリーンリーダー向けの名前を合わせる */
  const showZoomText = (scale: number): void => {
    if (!zoomText) {
      return;
    }
    const base = percentBase === "fit" ? state.fit : 1;
    zoomText.textContent = `${Math.round((scale / base) * 100)}%`;
    zoomText.setAttribute(
      "aria-label",
      `倍率 ${zoomText.textContent}。全体が収まる倍率に戻す`,
    );
  };
  /** 押したボタンが押せなくなった・消えたときは、フォーカスを表示する枠へ移して失わせない */
  const keepFocus = (): void => {
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

  // ドラッグ: 押せる所（と `dragIgnore`）の外と、ノードのリンクの上でつかんで動かす。`DRAG_THRESHOLD` を超えて動いたときだけ動かしたことにし、ドラッグ中は文字を選ばせない
  const ignore = dragIgnore
    ? `${dragIgnore}, ${CONTROL_SELECTOR}`
    : CONTROL_SELECTOR;
  let drag:
    | {
        x: number;
        y: number;
        left: number;
        top: number;
        id: number;
        moved: boolean;
      }
    | undefined;
  // 動かした後の次の 1 回の `click` を止める受け取り（リンク先を開かない）
  let releaseClick: (() => void) | undefined;
  const suppressNextClick = (): void => {
    releaseClick?.();
    const onClick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      release();
    };
    const timer = setTimeout(() => release(), 0);
    const release = (): void => {
      window.removeEventListener("click", onClick, true);
      clearTimeout(timer);
      releaseClick = undefined;
    };
    window.addEventListener("click", onClick, true);
    releaseClick = release;
  };
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Element;
      if (
        event.button !== 0 ||
        (!target.closest(NODE_LINK_SELECTOR) && target.closest(ignore))
      ) {
        return;
      }
      drag = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        id: event.pointerId,
        moved: false,
      };
    },
    { signal },
  );
  // ノードのリンクの上の押下で、ブラウザのリンクのドラッグを始めない（図のドラッグを `pointercancel` で止めさせない）
  viewport.addEventListener(
    "dragstart",
    (event) => {
      if ((event.target as Element).closest?.(NODE_LINK_SELECTOR)) {
        event.preventDefault();
      }
    },
    { signal },
  );
  viewport.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) {
        return;
      }
      if (!drag.moved) {
        // しきい値までは動かさない（グラフの項目の上で押したときのツールチップを優先する）
        const distance = Math.hypot(
          event.clientX - drag.x,
          event.clientY - drag.y,
        );
        if (distance <= DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add("is-dragging");
        onPanStart?.();
        state.atFit = false;
      }
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    },
    { signal },
  );
  const endDrag = (event: PointerEvent): void => {
    if (event.type === "pointerup" && drag?.moved) {
      suppressNextClick();
    }
    drag = undefined;
    viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", endDrag, { signal });
  viewport.addEventListener("pointercancel", endDrag, { signal });

  // スクロール: Shift＋ホイールなどで動いたときも、全体が収まる位置から削除されたことにする
  viewport.addEventListener(
    "scroll",
    () => {
      if (viewport.scrollLeft || viewport.scrollTop) {
        state.atFit = false;
      }
    },
    { passive: true, signal },
  );

  // 表示する枠の大きさが変わったとき: 全体が収まる倍率で確認していたなら、新しい大きさで収まる倍率にもう一度合わせる
  const sizeOf = (): string =>
    `${viewport.clientWidth}x${useHeight() ? viewport.clientHeight : 0}`;
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

  /** 今の倍率と位置を保ったまま、全体が収まる倍率をもう一度求める（倍率が新しい下限より小さいときは下限にする） */
  const refit = (): void => {
    state.fit = computeFit();
    const scale = Math.max(state.fit, state.scale);
    state.atFit = Math.abs(scale - state.fit) < ZOOM_EPSILON;
    apply(scale);
  };

  // 矩形へ移している途中のアニメーション（読者の操作で止める）
  let moving: number | undefined;
  const stopMoving = (): void => {
    if (moving !== undefined) {
      cancelAnimationFrame(moving);
      moving = undefined;
    }
  };
  listenStops({ viewport, tools, stop: stopMoving, signal });

  /** 倍率と、表示する枠の中央に来る中身の座標を当てる */
  const place = (scale: number, cx: number, cy: number): void => {
    state.atFit = Math.abs(scale - state.fit) < ZOOM_EPSILON;
    apply(scale);
    viewport.scrollLeft = cx * scale - viewport.clientWidth / 2;
    viewport.scrollTop = cy * scale - viewport.clientHeight / 2;
  };

  const focusRect = (
    rect: FocusRect,
    { margin, duration }: { margin: number; duration: number },
  ): void => {
    stopMoving();
    const fit = Math.min(
      (viewport.clientWidth - margin * 2) / Math.max(rect.width, 1),
      (viewport.clientHeight - margin * 2) / Math.max(rect.height, 1),
    );
    const target = Math.min(ZOOM.max, Math.max(state.fit, fit));
    const to = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    if (duration <= 0) {
      place(target, to.x, to.y);
      return;
    }
    const from = {
      scale: state.scale,
      x: (viewport.scrollLeft + viewport.clientWidth / 2) / state.scale,
      y: (viewport.scrollTop + viewport.clientHeight / 2) / state.scale,
    };
    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration);
      // 始めと終わりをゆるやかにする
      const eased =
        progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2;
      place(
        from.scale + (target - from.scale) * eased,
        from.x + (to.x - from.x) * eased,
        from.y + (to.y - from.y) * eased,
      );
      moving = progress < 1 ? requestAnimationFrame(step) : undefined;
    };
    moving = requestAnimationFrame(step);
  };

  const control: ZoomControl = {
    reset,
    fit: () => state.fit,
    refit,
    focusRect,
    detach: () => {
      stopMoving();
      releaseClick?.();
      observer.disconnect();
      controller.abort();
      controls.delete(viewport);
    },
  };
  controls.set(viewport, control);
  return control;
}
