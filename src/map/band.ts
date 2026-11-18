import { DRAG_THRESHOLD, zoomControlOf } from "../shared/zoom.interact.ts";
import { type MapBandUnit, renderMapBand } from "./map.part.ts";

/** 帯が進める 1 つの手順 */
export type BandStep = {
  title: string;
  text: string;
  /** 強調するノードか参加者 */
  nodes: string[];
  /** データの印を流す線 */
  wires: string[];
  /** その手順で中へ入るグループ */
  enter: string | undefined;
};

/** attachBand の戻り値 */
export type BandHandle = {
  /** 強調を解いて始める前に戻す */
  stop: () => void;
  /** 進める手順を差し替え、始める前の状態に戻す（強調は当て直さない） */
  update: (steps: BandStep[]) => void;
  /** 時計と操作を外す */
  destroy: () => void;
};

/** createFollow の戻り値 */
export type FollowHandle = {
  /** ノードか参加者を囲む矩形と余白が表示する枠に収まる倍率と位置へ図を移す（読者が触った後は resume まで何もしない） */
  reveal: (ids: string[]) => void;
  /** 読者が触って止めた移動を再開する */
  resume: () => void;
  /** 表示する枠のイベントを外す */
  destroy: () => void;
};

/** 手順を繰り返すときの 1 周の時間（ミリ秒）。今の区切りをこの時間で塗り、塗り終えたら最初から塗り直す */
export const STEP_MS = 2000;

/** 区切りの幅がこの px より細いとき、手順のバーに is-dense を付けて今の区切りを広げる */
export const BAND_DENSE_PX = 12;

/** 強調するノードを囲む矩形の周りに残す、表示する枠の中の余白（px） */
export const FOCUS_MARGIN_PX = 32;

/** 強調するノードへ図の倍率と位置を移す時間（ミリ秒）。動きを減らす設定では 0 */
export const FOCUS_MS = 300;

// 区切りの間（CSS の .map-band-steps の gap と同じ）
const SEGMENT_GAP_PX = 3;

/** 読者が表示する枠を触ったとみなすイベント */
const TOUCH_EVENTS = ["wheel", "pointerdown", "keydown", "touchstart"] as const;

/** 図の枠の中の、押しても停止しない要素 */
const NOT_BLANK_SELECTOR =
  "[data-node], [data-participant], .map-wire-hit, button, a, input";

/** 図の枠の中を、指定したノードか参加者を囲む矩形が収まる倍率と位置へ移し、読者が表示する枠を触ったら resume まで止める */
export const createFollow = (
  figure: HTMLElement,
  reducedMotion: boolean,
): FollowHandle => {
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );
  let follow = true;
  const touched = () => {
    follow = false;
  };
  for (const type of TOUCH_EVENTS)
    viewport?.addEventListener(type, touched, { passive: true });
  return {
    reveal: (ids) => {
      if (!viewport || !follow) return;
      const zoom = zoomControlOf(viewport);
      const elements = ids
        .map((id) =>
          figure.querySelector<HTMLElement>(
            `[data-node="${CSS.escape(id)}"], [data-participant="${CSS.escape(id)}"], .map-wire-hit[data-message="${CSS.escape(id)}"]`,
          ),
        )
        .filter((element): element is HTMLElement => element !== null);
      if (!zoom || elements.length === 0) return;
      // 倍率を掛ける前の中身の座標にする
      const scale =
        Number(
          /scale\(([^)]+)\)/.exec(
            viewport.querySelector<HTMLElement>("[style*='scale(']")?.style
              .transform ?? "",
          )?.[1] ?? "1",
        ) || 1;
      const view = viewport.getBoundingClientRect();
      const rects = elements.map((element) => element.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      zoom.focusRect(
        {
          x: (left - view.left + viewport.scrollLeft) / scale,
          y: (top - view.top + viewport.scrollTop) / scale,
          width: (right - left) / scale,
          height: (bottom - top) / scale,
        },
        { margin: FOCUS_MARGIN_PX, duration: reducedMotion ? 0 : FOCUS_MS },
      );
    },
    resume: () => {
      follow = true;
    },
    destroy: () => {
      for (const type of TOUCH_EVENTS)
        viewport?.removeEventListener(type, touched);
    },
  };
};

/** 図の枠の下に案内の帯を配置し、区切り・左右の矢印のボタン・キーで選んだ手順を停止するまで繰り返し、帯のバーと矢印のボタンの外・図の枠の空いた場所・Esc で停止する */
export const attachBand = (options: {
  figure: HTMLElement;
  mode: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message。状態遷移図は transition、ガントチャートとジャーニーは task、タイムラインは period、Git グラフは commit） */
  unit?: MapBandUnit;
  steps: BandStep[];
  apply: (step: BandStep | undefined) => void;
  /** 手順へ移ったときに呼ぶ関数（図の移動に使う） */
  onStep?: (step: BandStep, index: number) => void;
  label?: string;
}): BandHandle => {
  const { figure, mode, apply } = options;
  let steps = options.steps;
  const label =
    options.label ??
    `${figure.querySelector(".mdmark-diagram-title")?.textContent ?? ""}の${mode === "playback" ? "再生" : "案内"}`;
  let index: number | undefined;
  let started = 0;
  let frame: number | undefined;
  const holder = document.createElement("div");
  holder.className = "map-band-holder";
  (figure.querySelector(".mdmark-diagram-box") ?? figure).after(holder);
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );

  /** 区切りが細いときだけ手順のバーに is-dense を付ける */
  const applyDensity = () => {
    const bar = holder.querySelector<HTMLElement>(".map-band-steps");
    if (!bar) return;
    const count = steps.length;
    const width = (bar.clientWidth - SEGMENT_GAP_PX * (count - 1)) / count;
    bar.classList.toggle("is-dense", count > 0 && width < BAND_DENSE_PX);
  };
  const fill = () =>
    index === undefined
      ? 0
      : ((performance.now() - started) % STEP_MS) / STEP_MS;
  const render = () => {
    const step = index === undefined ? undefined : steps[index];
    // 描き直す前にフォーカスしていた要素（矢印のボタンかバー）へ、描き直した後もフォーカスを戻す
    const active =
      document.activeElement instanceof HTMLElement &&
      holder.contains(document.activeElement)
        ? document.activeElement
        : undefined;
    const dir = active?.dataset.dir;
    holder.innerHTML = renderMapBand({
      mode,
      unit: options.unit,
      total: steps.length,
      index,
      titles: steps.map((item) => item.title),
      title: step?.title ?? "",
      text: step?.text ?? "",
      playing: index !== undefined,
      fill: fill(),
      label,
    });
    applyDensity();
    if (active)
      (dir === undefined
        ? holder.querySelector<HTMLElement>(".map-band-steps")
        : holder.querySelector<HTMLElement>(
            `[data-band="step"][data-dir="${CSS.escape(dir)}"]`,
          )
      )?.focus();
  };
  /** 今の区切りの塗りだけを書き換える（描き直さない） */
  const paint = () => {
    const bar = holder.querySelector<HTMLElement>(".map-band-fill");
    if (bar) bar.style.width = `${Math.round(fill() * 100)}%`;
    frame = requestAnimationFrame(paint);
  };
  const stopFrame = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  const play = (next: number) => {
    stopFrame();
    index = next;
    started = performance.now();
    const step = steps[next];
    apply(step);
    render();
    if (step) options.onStep?.(step, next);
    frame = requestAnimationFrame(paint);
  };
  const stop = () => {
    stopFrame();
    index = undefined;
    apply(undefined);
    render();
  };
  /** 前の手順の位置（始めていないか先頭なら最後） */
  const prevIndex = () =>
    index === undefined || index === 0 ? steps.length - 1 : index - 1;
  /** 次の手順の位置（始めていなければ先頭、最後なら先頭へ戻る） */
  const nextIndex = () =>
    index === undefined ? 0 : (index + 1) % steps.length;
  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const segment = target?.closest<HTMLElement>(".map-band-seg");
    const arrow = target?.closest<HTMLElement>('[data-band="step"]');
    if (segment) play(Number(segment.dataset.index));
    else if (arrow)
      play(arrow.dataset.dir === "-1" ? prevIndex() : nextIndex());
    else if (
      index !== undefined &&
      !target?.closest(".map-band-steps") &&
      holder.contains(target)
    )
      stop();
  };
  const onKey = (event: KeyboardEvent) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest(".map-band-steps")
    )
      return;
    const keys: Record<string, () => void> = {
      ArrowRight: () => play(nextIndex()),
      ArrowLeft: () => play(prevIndex()),
      Home: () => play(0),
      End: () => play(steps.length - 1),
      Escape: () => {
        if (index !== undefined) stop();
      },
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  // 図の枠の空いた場所を押して DRAG_THRESHOLD 未満の動きで離したら停止する
  let down: { x: number; y: number } | undefined;
  const onDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    down =
      index !== undefined && target && !target.closest(NOT_BLANK_SELECTOR)
        ? { x: event.clientX, y: event.clientY }
        : undefined;
  };
  const onUp = (event: PointerEvent) => {
    if (
      down &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) <
        DRAG_THRESHOLD
    )
      stop();
    down = undefined;
  };
  holder.addEventListener("click", onClick);
  holder.addEventListener("keydown", onKey);
  viewport?.addEventListener("pointerdown", onDown);
  viewport?.addEventListener("pointerup", onUp);
  const resize = new ResizeObserver(applyDensity);
  resize.observe(holder);
  render();
  return {
    stop,
    update: (next) => {
      stopFrame();
      steps = next;
      index = undefined;
      render();
    },
    destroy: () => {
      stopFrame();
      resize.disconnect();
      holder.removeEventListener("click", onClick);
      holder.removeEventListener("keydown", onKey);
      viewport?.removeEventListener("pointerdown", onDown);
      viewport?.removeEventListener("pointerup", onUp);
      holder.remove();
    },
  };
};
