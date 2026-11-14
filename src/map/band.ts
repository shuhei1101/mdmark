import { renderMapBand } from "../parts/map.ts";

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
  /** ノードか参加者の中心へ表示する枠をスクロールする（読者が触った後は resume まで何もしない） */
  reveal: (ids: string[]) => void;
  /** 読者が触って止めたスクロールを再開する */
  resume: () => void;
  /** 表示する枠のイベントを外す */
  destroy: () => void;
};

/** 読者が表示する枠を触ったとみなすイベント */
const TOUCH_EVENTS = ["wheel", "pointerdown", "keydown", "touchstart"] as const;

/** 図の枠の表示する枠を、指定したノードか参加者の中心へスクロールし、読者が表示する枠を触ったら resume まで止める */
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
      const elements = ids
        .map((id) =>
          figure.querySelector<HTMLElement>(
            `[data-node="${CSS.escape(id)}"], [data-participant="${CSS.escape(id)}"]`,
          ),
        )
        .filter((element): element is HTMLElement => element !== null);
      const view = viewport.getBoundingClientRect();
      let left = viewport.scrollLeft;
      let top = viewport.scrollTop;
      if (elements.length > 0) {
        const rects = elements.map((element) =>
          element.getBoundingClientRect(),
        );
        const cx =
          (Math.min(...rects.map((r) => r.left)) +
            Math.max(...rects.map((r) => r.right))) /
          2;
        const cy =
          (Math.min(...rects.map((r) => r.top)) +
            Math.max(...rects.map((r) => r.bottom))) /
          2;
        left = Math.max(
          0,
          viewport.scrollLeft + cx - view.left - viewport.clientWidth / 2,
        );
        top = Math.max(
          0,
          viewport.scrollTop + cy - view.top - viewport.clientHeight / 2,
        );
      }
      viewport.scrollTo({
        left,
        top,
        behavior: reducedMotion ? "auto" : "smooth",
      });
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

/** 画面に入ったら 1 回呼ぶ関数を登録し、外す関数を返す（既定は IntersectionObserver） */
export type ObserveEnter = (target: Element, onEnter: () => void) => () => void;

/** IntersectionObserver で、要素が画面に入ったら 1 回だけ呼ぶ */
export const observeEnter: ObserveEnter = (target, onEnter) => {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      onEnter();
    }
  });
  observer.observe(target);
  return () => observer.disconnect();
};

/** 図の枠の下に案内の帯を配置し、前へ・次へ・停止・自動で進めると、強調・スクロールを付ける */
export const attachBand = (options: {
  figure: HTMLElement;
  mode: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message。状態遷移図は transition） */
  unit?: "message" | "transition";
  steps: BandStep[];
  /** 自動で進める間隔（秒） */
  interval: number;
  /** マーカーの play が autoplay か */
  autoplay: boolean;
  apply: (step: BandStep | undefined) => void;
  reducedMotion: boolean;
  observe?: ObserveEnter;
  label?: string;
  /** 自動で進め始めたとき（start）と、自動で次の手順へ進めたとき（step）に呼ぶ関数 */
  follow?: { start: () => void; step: (step: BandStep) => void };
}): BandHandle => {
  const { figure, mode, apply } = options;
  let steps = options.steps;
  const observe = options.observe ?? observeEnter;
  const label =
    options.label ??
    `${figure.querySelector(".mdmark-diagram-title")?.textContent ?? ""}の${mode === "playback" ? "再生" : "案内"}`;
  const follower = createFollow(figure, options.reducedMotion);
  let index: number | undefined;
  let auto = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const holder = document.createElement("div");
  holder.className = "map-band-holder";
  (figure.querySelector(".mdmark-diagram-box") ?? figure).after(holder);

  const render = () => {
    const step = index === undefined ? undefined : steps[index];
    // 描き直す前にフォーカスしていたボタンへ、描き直した後もフォーカスを戻す
    const focused =
      document.activeElement instanceof HTMLElement &&
      holder.contains(document.activeElement)
        ? document.activeElement.dataset.band
        : undefined;
    holder.innerHTML = renderMapBand({
      mode,
      unit: options.unit,
      total: steps.length,
      index,
      title: step?.title ?? "",
      text: step?.text ?? "",
      auto,
      label,
    });
    if (focused !== undefined)
      holder
        .querySelector<HTMLElement>(`[data-band="${CSS.escape(focused)}"]`)
        ?.focus();
  };
  const go = (next: number | undefined) => {
    index = next;
    apply(next === undefined ? undefined : steps[next]);
    render();
  };
  const stopAuto = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    auto = false;
  };
  const startAuto = () => {
    stopAuto();
    auto = true;
    follower.resume();
    options.follow?.start();
    go(index ?? 0);
    timer = setInterval(() => {
      go(index === undefined ? 0 : (index + 1) % steps.length);
      const step = index === undefined ? undefined : steps[index];
      if (step === undefined) return;
      follower.reveal(step.nodes);
      options.follow?.step(step);
    }, options.interval * 1000);
  };
  const stop = () => {
    stopAuto();
    go(undefined);
  };
  const onClick = (event: Event) => {
    const action = (
      event.target instanceof Element
        ? event.target.closest("[data-band]")
        : null
    )?.getAttribute("data-band");
    if (action === "prev")
      go(index === undefined || index === 0 ? steps.length - 1 : index - 1);
    else if (action === "next")
      go(index === undefined ? 0 : (index + 1) % steps.length);
    else if (action === "stop") stop();
    else if (action === "auto") {
      if (auto) {
        stopAuto();
        render();
      } else startAuto();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight")
      go(index === undefined ? 0 : (index + 1) % steps.length);
    if (event.key === "ArrowLeft")
      go(index === undefined || index === 0 ? steps.length - 1 : index - 1);
  };
  holder.addEventListener("click", onClick);
  holder.addEventListener("keydown", onKey);
  let unobserve = () => {};
  if (options.autoplay) {
    unobserve = observe(figure, () => {
      if (!options.reducedMotion) startAuto();
    });
  }
  render();
  return {
    stop,
    update: (next) => {
      stopAuto();
      steps = next;
      index = undefined;
      render();
    },
    destroy: () => {
      stopAuto();
      unobserve();
      holder.removeEventListener("click", onClick);
      holder.removeEventListener("keydown", onKey);
      follower.destroy();
      holder.remove();
    },
  };
};
