// #660 のモックの案内・再生の帯: 手順のバーと、手順のタイトル・説明の文だけを持つ帯の HTML と、帯で動かす実演の図
// 区切りを押すとその手順を最初から繰り返し再生し、もう一度押すと最初から再生し直す。バー以外（帯の中・図の空いた場所）を押すと停止する。何もしていないときはバーだけを出す

/** 単位ごとの名前（バーの読み上げの名前に使用する） */
const UNITS = { walkthrough: "手順", message: "メッセージ", transition: "遷移", task: "タスク", commit: "commit" };

/** 1 つの手順を 1 周再生する時間（ミリ秒）。マーカーの引数 interval は廃止し、固定にする */
export const STEP_MS = 2000;

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 帯の HTML
 * state: { unit, total, index, title, text, titles, playing, fill, label, many: "fit" | "wrap" | "scroll" | "arrows", page }
 */
export const renderBand = (state) => {
  const unit = UNITS[state.unit ?? "walkthrough"];
  const index = state.index;
  const started = index !== undefined;
  const titles = state.titles ?? [];
  const segClass = (i) => ["pb-seg", started && i < index ? "is-done" : "", i === index ? "is-current" : "", i === index && state.playing ? "is-playing" : ""].filter(Boolean).join(" ");
  const fill = (i) => (i === index ? `<span class="pb-fill" style="width:${Math.round((state.fill ?? 0) * 100)}%"></span>` : "");
  const many = state.many ?? "fit";
  // 案 D（矢印）: 10 個ずつの区切りを出し、左右の矢印で前後の 10 個へ送る
  const PAGE = 10;
  const page = state.page ?? Math.floor((index ?? 0) / PAGE);
  const shown = many === "arrows" ? Array.from({ length: Math.min(PAGE, state.total - page * PAGE) }, (_, k) => page * PAGE + k) : Array.from({ length: state.total }, (_, i) => i);
  const segs = shown.map((i) => `<span class="${segClass(i)}" data-index="${i}" title="${i + 1}. ${escape(titles[i] ?? "")}">${fill(i)}</span>`).join("");
  const arrow = (dir, label, path, disabled) => `<button type="button" class="pb-page" data-band="page" data-dir="${dir}" aria-label="${label}" title="${label}"${disabled ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg></button>`;
  const steps = `${many === "arrows" ? `<div class="pb-paged">${arrow(-1, `前の ${PAGE} 個の${unit}`, "m15 18-6-6 6-6", page === 0)}` : ""}<div class="pb-steps is-${many}" role="slider" tabindex="0" data-band="steps" aria-label="${unit}" aria-valuemin="0" aria-valuemax="${state.total}" aria-valuenow="${started ? index + 1 : 0}" aria-valuetext="${started ? `${unit} ${index + 1}/${state.total} ${escape(titles[index] ?? "")}` : "始める前"}" aria-keyshortcuts="ArrowLeft ArrowRight Escape">${segs}</div>${many === "arrows" ? `${arrow(1, `次の ${PAGE} 個の${unit}`, "m9 18 6-6-6-6", (page + 1) * PAGE >= state.total)}</div>` : ""}`;
  const title = `<strong class="pb-title"${state.title ? "" : " hidden"}>${escape(state.title ?? "")}</strong>`;
  const text = `<p class="pb-text" aria-live="polite"${state.text ? "" : " hidden"}>${escape(state.text ?? "")}</p>`;
  return `<div class="pb-band${started ? "" : " is-idle"}" role="region" aria-label="${escape(state.label ?? "図の案内")}">${steps}${title}${text}</div>`;
};

/** 帯を描き、押した区切りの手順を再生する。figure は手順の移動と停止で呼ぶ（無ければ帯だけ） */
export const createBand = (host, options, figure) => {
  const state = { playing: false, fill: 0, ...options };
  const steps = options.steps;
  state.total = steps.length;
  state.titles = steps.map((step) => step.title);
  let timer;
  let started = 0;
  const draw = () => {
    const focused = host.contains(document.activeElement);
    const step = state.index === undefined ? undefined : steps[state.index];
    host.innerHTML = renderBand({ ...state, title: step?.title, text: step?.text });
    if (focused) host.querySelector(".pb-steps")?.focus();
  };
  const tick = () => {
    state.fill = Math.min(1, (performance.now() - started) / STEP_MS);
    const fillEl = host.querySelector(".pb-fill");
    if (fillEl) fillEl.style.width = `${Math.round(state.fill * 100)}%`;
    // 停止するまで、同じ手順を最初から繰り返し再生する
    if (state.fill >= 1) {
      started = performance.now();
      figure?.show(steps[state.index]);
    }
    timer = requestAnimationFrame(tick);
  };
  /** その手順を最初から繰り返し再生する（再生中の手順でも最初から） */
  const play = (index) => {
    cancelAnimationFrame(timer);
    state.index = (index + state.total) % state.total;
    state.fill = 0;
    state.playing = true;
    started = performance.now();
    figure?.resume();
    figure?.show(steps[state.index]);
    draw();
    timer = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (state.index === undefined) return;
    cancelAnimationFrame(timer);
    Object.assign(state, { index: undefined, playing: false, fill: 0 });
    figure?.reset();
    draw();
  };
  host.addEventListener("click", (event) => {
    const bar = event.target.closest(".pb-steps");
    if (!bar) {
      stop();
      return;
    }
    const seg = event.target.closest("[data-index]");
    if (seg) {
      play(Number(seg.dataset.index));
      return;
    }
    const rect = bar.getBoundingClientRect();
    play(Math.min(state.total - 1, Math.floor(((event.clientX - rect.left) / rect.width) * state.total)));
  });
  host.addEventListener("keydown", (event) => {
    if (!event.target.closest(".pb-steps")) return;
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    if (event.key in moves) {
      event.preventDefault();
      play(state.index === undefined ? (event.key === "ArrowRight" ? 0 : state.total - 1) : state.index + moves[event.key]);
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      play(event.key === "Home" ? 0 : state.total - 1);
    }
    if (event.key === "Escape") stop();
  });
  figure?.onBlankClick(stop);
  draw();
  return { play, stop };
};

/** 実演の図: 手順で強調するノードを囲む範囲が表示する枠に収まる倍率と位置へ、図をなめらかに移す */
export const createFigure = (host, { title, nodes }) => {
  host.innerHTML = `<div class="pb-figure"><div class="pb-figure-title">${escape(title)}</div><div class="pb-viewport"><div class="pb-content is-animated">${nodes.map((node) => `<div class="pb-node" data-node="${node.id}" style="left:${node.x}px;top:${node.y}px">${escape(node.label)}</div>`).join("")}</div><span class="pb-zoom"></span></div></div>`;
  const viewport = host.querySelector(".pb-viewport");
  const content = host.querySelector(".pb-content");
  const zoom = host.querySelector(".pb-zoom");
  const MARGIN = 32;
  // 倍率の上限は読者の拡大の上限（src/diagram/geometry.ts の ZOOM.max）と同じ絶対の倍率
  const MAX = 3;
  const fitScale = () => Math.min(viewport.clientWidth / 960, viewport.clientHeight / 560);
  let touched = false;
  let down;
  const blankHandlers = [];
  viewport.addEventListener("pointerdown", (event) => {
    touched = true;
    down = { x: event.clientX, y: event.clientY, blank: !event.target.closest(".pb-node") };
  });
  // ノード以外の空いた場所を押して離したら停止。4px 以上動かしたらドラッグとして止めない
  viewport.addEventListener("pointerup", (event) => {
    if (down?.blank && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 4) for (const handler of blankHandlers) handler();
    down = undefined;
  });
  const apply = (scale, x, y) => {
    content.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    zoom.textContent = `${Math.round((scale / fitScale()) * 100)}%`;
  };
  const reset = () => {
    for (const node of content.children) node.classList.remove("is-dim", "is-hit");
    const scale = fitScale();
    apply(scale, (viewport.clientWidth - 960 * scale) / 2, 0);
  };
  const show = (step) => {
    const ids = new Set(step.nodes);
    for (const node of content.children) {
      node.classList.toggle("is-hit", ids.has(node.dataset.node));
      node.classList.toggle("is-dim", !ids.has(node.dataset.node));
    }
    if (touched) return;
    const boxes = nodes.filter((node) => ids.has(node.id));
    const left = Math.min(...boxes.map((n) => n.x)) - MARGIN;
    const top = Math.min(...boxes.map((n) => n.y)) - MARGIN;
    const right = Math.max(...boxes.map((n) => n.x + 156)) + MARGIN;
    const bottom = Math.max(...boxes.map((n) => n.y + 40)) + MARGIN;
    const scale = Math.max(fitScale(), Math.min(MAX, viewport.clientWidth / (right - left), viewport.clientHeight / (bottom - top)));
    apply(scale, viewport.clientWidth / 2 - ((left + right) / 2) * scale, viewport.clientHeight / 2 - ((top + bottom) / 2) * scale);
  };
  reset();
  return { show, reset, resume: () => { touched = false; }, onBlankClick: (handler) => blankHandlers.push(handler) };
};
