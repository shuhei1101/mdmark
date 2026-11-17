// #660 のモックの案内・再生の帯: 手順のバー・この手順を再生・全て再生・速度を持つ帯の HTML と、帯で動かす実演の図

/** lucide のアイコン（chevron-left・square・play・list-video・pause・chevron-right） */
const ICONS = {
  prev: '<path d="m15 18-6-6 6-6"/>',
  stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
  one: '<polygon points="6 3 20 12 6 21 6 3"/>',
  all: '<path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 5 3-5 3v-6Z"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/** 単位ごとのボタンの名前（今の帯の名前を引き継ぐ） */
const UNITS = {
  walkthrough: { name: "手順", stop: "案内をやめる" },
  message: { name: "メッセージ", stop: "再生をやめる" },
  transition: { name: "遷移", stop: "再生をやめる" },
  task: { name: "タスク", stop: "再生をやめる" },
  commit: { name: "commit", stop: "再生をやめる" },
};

export const SPEEDS = [0.5, 1, 2];

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * 帯の HTML
 * state: { unit, total, index, title, text, titles, playing: "none" | "one" | "all", speed, speedUi: "radio" | "select", segUi: "slider" | "buttons", fill, label }
 */
export const renderBand = (state) => {
  const unit = UNITS[state.unit ?? "walkthrough"];
  const index = state.index;
  const started = index !== undefined;
  const tool = (action, label, icon, extra = "") =>
    `<button class="pb-tool" type="button" data-band="${action}" aria-label="${label}" title="${label}"${extra}>${svg(icon)}</button>`;
  const playingAll = state.playing === "all";
  const speed = state.speed ?? 1;
  const speedUi =
    state.speedUi === "select"
      ? `<select class="pb-speed-select" data-band="speed" aria-label="再生の速度" title="再生の速度">${SPEEDS.map((value) => `<option value="${value}"${value === speed ? " selected" : ""}>${value} 倍</option>`).join("")}</select>`
      : `<div class="pb-speed" role="radiogroup" aria-label="再生の速度">${SPEEDS.map((value) => `<button type="button" role="radio" data-band="speed" data-speed="${value}" aria-checked="${value === speed}" tabindex="${value === speed ? 0 : -1}" title="${value} 倍">${value}×</button>`).join("")}</div>`;
  const actions = [
    tool("prev", `前の${unit.name}`, "prev"),
    tool("stop", unit.stop, "stop", started ? "" : " disabled"),
    tool("one", `この${unit.name}を再生`, "one", ` aria-pressed="${state.playing === "one"}"`),
    tool("all", playingAll ? "一時停止" : "全て再生", playingAll ? "pause" : "all", ` aria-pressed="${playingAll}"`),
    tool("next", `次の${unit.name}`, "next"),
    '<span class="pb-sep" aria-hidden="true"></span>',
    speedUi,
  ].join("");
  const titles = state.titles ?? [];
  const segClass = (i) => ["pb-seg", started && i < index ? "is-done" : "", i === index ? "is-current" : ""].filter(Boolean).join(" ");
  const fill = (i) => (i === index ? `<span class="pb-fill" style="width:${Math.round((state.fill ?? 0) * 100)}%"></span>` : "");
  const steps =
    state.segUi === "buttons"
      ? `<div class="pb-steps" role="toolbar" aria-label="${unit.name}の一覧">${Array.from({ length: state.total }, (_, i) => `<button type="button" class="${segClass(i)}" data-band="seg" data-index="${i}" tabindex="${i === (index ?? 0) ? 0 : -1}" aria-label="${unit.name} ${i + 1}: ${escape(titles[i] ?? "")}"${i === index ? ' aria-current="step"' : ""} title="${i + 1}. ${escape(titles[i] ?? "")}"></button>`).join("")}</div>`
      : `<div class="pb-steps" role="slider" tabindex="0" data-band="steps" aria-label="${unit.name}" aria-valuemin="1" aria-valuemax="${state.total}" aria-valuenow="${started ? index + 1 : 0}" aria-valuetext="${started ? `${index + 1}/${state.total} ${escape(titles[index] ?? "")}` : "始める前"}">${Array.from({ length: state.total }, (_, i) => `<span class="${segClass(i)}" title="${i + 1}. ${escape(titles[i] ?? "")}">${fill(i)}</span>`).join("")}</div>`;
  const count = `${started ? index + 1 : "–"}/${state.total}`;
  const title = `<strong class="pb-title"${state.title ? "" : " hidden"}>${escape(state.title ?? "")}</strong>`;
  const text = `<p class="pb-text" aria-live="polite"${state.text ? "" : " hidden"}>${escape(state.text ?? "")}</p>`;
  return `<div class="pb-band" role="region" aria-label="${escape(state.label ?? "図の案内")}"><div class="pb-head"><span class="pb-count">${count}</span>${title}<div class="pb-actions">${actions}</div></div>${steps}${text}</div>`;
};

/** 帯を描き、押した操作で手順を進める。figure は手順の移動で呼ぶ（無ければ帯だけ） */
export const createBand = (host, options, figure) => {
  const state = { playing: "none", speed: 1, fill: 0, ...options };
  const steps = options.steps;
  state.total = steps.length;
  state.titles = steps.map((step) => step.title);
  let timer;
  let started = 0;
  const duration = () => (options.interval ?? 2) * 1000 / state.speed;
  const draw = () => {
    const focused = host.contains(document.activeElement) ? document.activeElement.dataset : undefined;
    const step = state.index === undefined ? undefined : steps[state.index];
    host.innerHTML = renderBand({ ...state, title: step?.title, text: step?.text });
    if (focused) host.querySelector(`[data-band="${focused.band}"]${focused.index ? `[data-index="${focused.index}"]` : ""}${focused.speed ? `[data-speed="${focused.speed}"]` : ""}`)?.focus();
  };
  const go = (index) => {
    state.index = (index + state.total) % state.total;
    state.fill = 0;
    started = performance.now();
    figure?.show(steps[state.index]);
    draw();
  };
  const tick = () => {
    if (state.playing === "none") return;
    state.fill = Math.min(1, (performance.now() - started) / duration());
    const fillEl = host.querySelector(".pb-fill");
    if (fillEl) fillEl.style.width = `${Math.round(state.fill * 100)}%`;
    if (state.fill >= 1) {
      if (state.playing === "one") {
        state.playing = "none";
        draw();
        return;
      }
      go(state.index + 1);
    }
    timer = requestAnimationFrame(tick);
  };
  const play = (kind) => {
    cancelAnimationFrame(timer);
    if (state.playing === kind) {
      state.playing = "none";
      draw();
      return;
    }
    state.playing = kind;
    if (state.index === undefined) go(0);
    else {
      started = performance.now() - state.fill * duration();
      if (state.fill >= 1) go(state.index);
      figure?.show(steps[state.index]);
    }
    draw();
    timer = requestAnimationFrame(tick);
  };
  host.addEventListener("click", (event) => {
    const target = event.target.closest("[data-band]");
    if (!target) return;
    const action = target.dataset.band;
    figure?.resume();
    if (action === "prev") go((state.index ?? 0) - 1);
    if (action === "next") go(state.index === undefined ? 0 : state.index + 1);
    if (action === "stop") {
      cancelAnimationFrame(timer);
      Object.assign(state, { index: undefined, playing: "none", fill: 0 });
      figure?.reset();
      draw();
    }
    if (action === "one") play("one");
    if (action === "all") play("all");
    if (action === "seg") go(Number(target.dataset.index));
    if (action === "steps") {
      const rect = target.getBoundingClientRect();
      go(Math.min(state.total - 1, Math.floor(((event.clientX - rect.left) / rect.width) * state.total)));
    }
    if (action === "speed" && target.dataset.speed) {
      state.speed = Number(target.dataset.speed);
      started = performance.now() - state.fill * duration();
      draw();
    }
  });
  host.addEventListener("change", (event) => {
    if (event.target.dataset.band !== "speed") return;
    state.speed = Number(event.target.value);
    started = performance.now() - state.fill * duration();
  });
  host.addEventListener("keydown", (event) => {
    const target = event.target;
    figure?.resume();
    if (target.dataset.band === "steps" || target.closest(".pb-steps")) {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        go(state.index === undefined ? 0 : state.index + (event.key === "ArrowRight" ? 1 : -1));
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        go(event.key === "Home" ? 0 : state.total - 1);
      }
    }
    if (target.dataset.speed && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      const next = SPEEDS[(SPEEDS.indexOf(state.speed) + (event.key === "ArrowRight" ? 1 : SPEEDS.length - 1)) % SPEEDS.length];
      state.speed = next;
      started = performance.now() - state.fill * duration();
      draw();
      host.querySelector(`[data-speed="${next}"]`)?.focus();
    }
  });
  draw();
  return { go };
};

/** 実演の図: 手順で強調するノードを囲む範囲が表示する枠に収まる倍率と位置へ、図をなめらかに移す */
export const createFigure = (host, { title, nodes }) => {
  host.innerHTML = `<div class="pb-figure"><div class="pb-figure-title">${escape(title)}</div><div class="pb-viewport"><div class="pb-content is-animated">${nodes.map((node) => `<div class="pb-node" data-node="${node.id}" style="left:${node.x}px;top:${node.y}px">${escape(node.label)}</div>`).join("")}</div><span class="pb-zoom"></span></div></div>`;
  const viewport = host.querySelector(".pb-viewport");
  const content = host.querySelector(".pb-content");
  const zoom = host.querySelector(".pb-zoom");
  const MARGIN = 32;
  const MAX = 2;
  const fitScale = () => Math.min(viewport.clientWidth / 960, viewport.clientHeight / 560);
  let touched = false;
  viewport.addEventListener("pointerdown", () => { touched = true; });
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
    const scale = Math.max(fitScale(), Math.min(MAX * fitScale(), viewport.clientWidth / (right - left), viewport.clientHeight / (bottom - top)));
    apply(scale, viewport.clientWidth / 2 - ((left + right) / 2) * scale, viewport.clientHeight / 2 - ((top + bottom) / 2) * scale);
  };
  reset();
  return { show, reset, resume: () => { touched = false; } };
};
