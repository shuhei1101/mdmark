import {
  DRAG_THRESHOLD,
  type FocusRect,
  zoomControlOf,
} from "../shared/zoom.interact.ts";
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
  /** ノードか参加者を囲む矩形が見える位置へ、倍率を変えずに図を移す（読者が触った後は resume まで何もしない） */
  reveal: (ids: string[]) => void;
  /** 読者が触って止めた移動を再開する */
  resume: () => void;
  /** 表示する枠のイベントを外す */
  destroy: () => void;
};

/** 区切りの幅がこの px より細いとき、手順のバーに is-dense を付けて今の区切りを広げる */
export const BAND_DENSE_PX = 12;

/** 強調するノードへ図の位置を移す時間（ミリ秒）。動きを減らす設定では 0 */
export const FOCUS_MS = 300;

// 区切りの間（CSS の .map-band-steps の gap と同じ）
const SEGMENT_GAP_PX = 3;

/** 読者が表示する枠を触ったとみなすイベント */
const TOUCH_EVENTS = ["wheel", "pointerdown", "keydown", "touchstart"] as const;

/** 図の枠の中の、押しても停止しない要素 */
const NOT_BLANK_SELECTOR =
  "[data-node], [data-participant], .map-wire-hit, button, a, input";

/** 倍率を掛けた中身（transform で倍率を掛けた要素）と、その倍率 */
const stageOf = (viewport: HTMLElement): { base: DOMRect; scale: number } => {
  const stage = viewport.querySelector<HTMLElement>("[style*='scale(']");
  const base = (stage ?? viewport).getBoundingClientRect();
  return {
    base,
    scale: stage && stage.offsetWidth > 0 ? base.width / stage.offsetWidth : 1,
  };
};

/** 表示する枠に見えている範囲（倍率を掛ける前の中身の座標） */
const visibleRectOf = (viewport: HTMLElement): FocusRect => {
  const { base, scale } = stageOf(viewport);
  const view = viewport.getBoundingClientRect();
  return {
    x: (view.left - base.left) / scale,
    y: (view.top - base.top) / scale,
    width: viewport.clientWidth / scale,
    height: viewport.clientHeight / scale,
  };
};

/** 図の枠の中を、指定したノードか参加者を囲む矩形が見える位置へ、倍率を変えずに移し、読者が表示する枠を触ったら resume まで止める */
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
      // 倍率を掛ける前の中身の座標にする（倍率を掛けた中身の矩形を基準にする）
      const { base, scale } = stageOf(viewport);
      const rects = elements.map((element) => element.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      zoom.centerRect(
        {
          x: (left - base.left) / scale,
          y: (top - base.top) / scale,
          width: (right - left) / scale,
          height: (bottom - top) / scale,
        },
        { duration: reducedMotion ? 0 : FOCUS_MS },
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
  /** 帯の中でフォーカスしている要素 */
  const focusedInBand = (): HTMLElement | undefined =>
    document.activeElement instanceof HTMLElement &&
    holder.contains(document.activeElement)
      ? document.activeElement
      : undefined;
  /** 描き直した後に、矢印のボタンなら同じ向きのボタンへ、それ以外ならバーへフォーカスを戻す（文書をスクロールしない） */
  const restoreFocus = (dir: string | undefined) =>
    (dir === undefined
      ? holder.querySelector<HTMLElement>(".map-band-steps")
      : holder.querySelector<HTMLElement>(
          `[data-band="step"][data-dir="${CSS.escape(dir)}"]`,
        )
    )?.focus({ preventScroll: true });
  const render = () => {
    const step = index === undefined ? undefined : steps[index];
    // 描き直す前にフォーカスしていた要素（矢印のボタンかバー）へ、描き直した後もフォーカスを戻す
    const active = focusedInBand();
    holder.innerHTML = renderMapBand({
      mode,
      unit: options.unit,
      total: steps.length,
      index,
      titles: steps.map((item) => item.title),
      title: step?.title ?? "",
      text: step?.text ?? "",
      playing: index !== undefined,
      label,
    });
    applyDensity();
    if (active) restoreFocus(active.dataset.dir);
  };
  // 始めたときに表示していた範囲（停止でその倍率と位置へ戻す）
  let shown: FocusRect | undefined;
  const play = (next: number) => {
    if (index === undefined && viewport) shown = visibleRectOf(viewport);
    index = next;
    const step = steps[next];
    apply(step);
    render();
    if (step) options.onStep?.(step, next);
  };
  const stop = () => {
    index = undefined;
    apply(undefined);
    render();
    if (viewport && shown)
      zoomControlOf(viewport)?.focusRect(shown, { margin: 0, duration: 0 });
    shown = undefined;
  };
  /** 前の手順の位置（始めていないか先頭なら最後） */
  const prevIndex = () =>
    index === undefined || index === 0 ? steps.length - 1 : index - 1;
  /** 次の手順の位置（始めていなければ先頭、最後なら先頭へ戻る） */
  const nextIndex = () =>
    index === undefined ? 0 : (index + 1) % steps.length;
  /** 押した区切りか矢印のボタンが指す手順（どちらでもなければ無し） */
  const pressedIndex = (target: Element): number | undefined => {
    const segment = target.closest<HTMLElement>(".map-band-seg");
    if (segment) return Number(segment.dataset.index);
    const arrow = target.closest<HTMLElement>('[data-band="step"]');
    if (!arrow) return undefined;
    return arrow.dataset.dir === "-1" ? prevIndex() : nextIndex();
  };
  const onClick = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const next = pressedIndex(event.target);
    if (next !== undefined) play(next);
    else if (index !== undefined && !event.target.closest(".map-band-steps"))
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
      steps = next;
      index = undefined;
      render();
    },
    destroy: () => {
      resize.disconnect();
      holder.removeEventListener("click", onClick);
      holder.removeEventListener("keydown", onKey);
      viewport?.removeEventListener("pointerdown", onDown);
      viewport?.removeEventListener("pointerup", onUp);
      holder.remove();
    },
  };
};
