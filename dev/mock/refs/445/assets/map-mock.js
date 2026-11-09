// map の図のモック: Mermaid と補足を PoC の自動配置で配置し、今のフロー図・シーケンス図の部品（配布物の mount）で描く。
// 入れ子のグループ・中へ入る・開閉・案内・再生は、描いた図の上に足す。実装の mount が描く構造の案

import { mount } from "../../../../../dist/index.js";
import { layoutMap, parseFlowchart, parseSequence } from "./map-layout.js";

/** 自動の再生でメッセージを進める間隔の選択肢（秒）と既定 */
const AUTOPLAY_SECONDS = [1, 2, 3, 5];
const DEFAULT_AUTOPLAY_SECONDS = 2;
/** 1 通のメッセージの印が線を 1 往復する時間（秒） */
const PLAY_LOOP_SECONDS = 1.2;
/** 開閉と中へ入った状態をタブの中で保つ sessionStorage のキーの頭 */
const STORAGE_PREFIX = "mdmark-map:";

/** Mermaid のクラスと、今のフロー図のノードの種類の対応 */
const KINDS = { llm: "llm", script: "script", data: "data", external: "external", mcp: "mcp", dm: "dm" };
/** Mermaid の矢印と、今のフロー図の線の種類の対応 */
const LINES = { solid: "flow", dotted: "read", thick: "write" };

/** 今の図のボタンと同じ Lucide のアイコン */
const ICONS = {
  back: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  first: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  collapse: '<path d="m6 9 6 6 6-6"/>',
  expand: '<path d="m9 18 6-6-6-6"/>',
};

const icon = (name) =>
  `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/** 今の図のツールの見た目のアイコンのボタン。名前はツールチップと読み上げに出す */
const toolButton = (name, label, onClick, attrs = {}) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mdmark-diagram-tool";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon(name);
  for (const [key, value] of Object.entries(attrs)) button.setAttribute(key, value);
  button.addEventListener("click", onClick);
  return button;
};

/** 補足の layout の色（mdmark の色の名前）を、面と文字の CSS 変数にする */
const colorStyle = (color) =>
  color ? `--map-fill: var(--mdmark-color-accent-${color}-bg); --map-ink: var(--mdmark-color-accent-${color}-text);` : "";

/**
 * map の構成図を 1 つ作る。host の中に描き、操作のたびに描き直す（描き直しても文書と図の中のスクロールを保つ）。
 * spec: { id, title, flow, data: { notes, walkthroughs, layout, colors }, sequence?: { title, source } }
 * initial: { enter, collapsed, step, play, paused }
 */
export const createMap = (host, spec, initial = {}) => {
  const chart = parseFlowchart(spec.flow);
  const sequence = spec.sequence ? parseSequence(spec.sequence.source) : undefined;
  const nodeById = new Map(chart.nodes.map((node) => [node.id, node]));
  const boxById = new Map(chart.boxes.map((box) => [box.id, box]));
  const labelOf = (id) => nodeById.get(id)?.label ?? boxById.get(id)?.title ?? id;
  const storageKey = `${STORAGE_PREFIX}${spec.id}`;
  const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
  const state = {
    enter: initial.enter ?? saved.enter,
    collapsed: new Set(initial.collapsed ?? saved.collapsed ?? []),
    step: initial.step,
    play: initial.play,
    autoplay: initial.paused ? false : initial.play !== undefined,
    seconds: DEFAULT_AUTOPLAY_SECONDS,
  };
  const start = { enter: undefined };
  let timer;

  const save = () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ enter: state.enter, collapsed: [...state.collapsed] }));
  };

  const isUnder = (id, ancestor) => {
    let parent = nodeById.get(id)?.parent ?? boxById.get(id)?.parent;
    while (parent) {
      if (parent === ancestor) return true;
      parent = boxById.get(parent)?.parent;
    }
    return id === ancestor;
  };
  const visibleOf = (id) => [...state.collapsed].find((closed) => isUnder(id, closed)) ?? id;

  /** PoC の配置を、今のフロー図の部品の定義にする */
  const toFlowDefinition = (layout) => ({
    title: spec.title,
    scope: state.enter ? `${labelOf(state.enter)}の中` : "全体",
    updated: "2026-11-09",
    width: layout.width,
    height: layout.height,
    nodes: layout.leaves.map((leaf) => {
      const node = nodeById.get(leaf.id);
      const box = boxById.get(leaf.id);
      const kind = KINDS[node?.classes.find((cls) => KINDS[cls])] ?? "script";
      const note = spec.data.notes?.[leaf.id];
      return {
        id: leaf.id,
        kind,
        ...(box ? { tag: "グループ" } : {}),
        x: leaf.x,
        y: leaf.y,
        w: leaf.w,
        h: leaf.h,
        name: box ? `${box.title}（${chart.nodes.filter((item) => isUnder(item.id, box.id)).length}）` : leaf.lines.join(""),
        ...(note ? { hint: note } : {}),
      };
    }),
    wires: layout.edges.map((edge) => {
      const source = chart.edges.find((item) => item.id === edge.id);
      const merged = chart.edges.filter((item) => visibleOf(item.from) === edge.from && visibleOf(item.to) === edge.to);
      const label = edge.count > 1 ? `${edge.count} 本` : source?.label;
      const mid = longestMid(edge.points);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        line: LINES[source?.line ?? "solid"],
        points: edge.points,
        ...(label ? { label, labelAt: mid } : {}),
        ...(edge.count > 1 ? { tip: merged.map((item) => `${labelOf(item.from)} → ${labelOf(item.to)}`).join("、") } : {}),
      };
    }),
  });

  const longestMid = (points) => {
    let best = [points[0], points[0]];
    let bestLength = -1;
    points.slice(1).forEach((point, index) => {
      const length = Math.abs(point[0] - points[index][0]) + Math.abs(point[1] - points[index][1]);
      if (length > bestLength) {
        bestLength = length;
        best = [points[index], point];
      }
    });
    return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
  };

  const highlighted = () => {
    if (state.step !== undefined) return new Set(spec.data.walkthroughs[state.step].highlight ?? []);
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      return new Set([visibleOf(message.from), visibleOf(message.to)]);
    }
    return undefined;
  };

  const render = () => {
    // 描き直しても、文書と図の中のスクロールを保つ
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const layout = layoutMap(chart, { enter: state.enter, collapsed: [...state.collapsed] }, spec.data.layout ?? {});
    const definition = toFlowDefinition(layout);
    host.replaceChildren();
    mount(host, { markdown: `<!-- flow -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /flow -->\n` });
    const figure = host.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    decorateGroups(stage, layout);
    decorateNodes(stage, layout);
    decorateTools(figure);
    renderBand(figure);
    renderPlayDot(stage, layout);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
  };

  /** 入れ子のグループ: 図の線とノードの下に、色の面とタイトルと開閉のボタンを置く */
  const decorateGroups = (stage, layout) => {
    const wires = stage.querySelector(".mdmark-diagram-wires");
    for (const box of layout.boxes) {
      const info = boxById.get(box.id);
      const color = spec.data.colors?.[box.id];
      const group = document.createElement("div");
      group.className = "map-group";
      group.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;${colorStyle(color)}`;
      const title = document.createElement("button");
      title.type = "button";
      title.className = "map-group-title";
      title.textContent = info?.title ?? box.id;
      title.title = "ダブルクリックで中へ入る";
      title.addEventListener("dblclick", () => enterGroup(box.id));
      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter") enterGroup(box.id);
      });
      const toggle = toolButton("collapse", `${info?.title ?? box.id}を閉じる`, () => {
        state.collapsed.add(box.id);
        save();
        render();
      }, { "aria-expanded": "true" });
      toggle.classList.add("map-group-toggle");
      group.append(title, toggle);
      stage.insertBefore(group, wires);
    }
  };

  /** ノード: 閉じたグループは押すと開く。入ったグループの外は薄くする。案内と再生で強調する */
  const decorateNodes = (stage, layout) => {
    const hot = highlighted();
    for (const leaf of layout.leaves) {
      const element = stage.querySelector(`[data-node="${CSS.escape(leaf.id)}"]`);
      if (!element) continue;
      const color = spec.data.colors?.[leaf.id];
      if (color) element.style.cssText += colorStyle(color);
      if (color) element.classList.add("map-colored");
      if (leaf.faded) element.classList.add("map-faded");
      if (hot?.has(leaf.id)) element.classList.add("map-hot");
      else if (hot) element.classList.add("map-dim");
      if (boxById.has(leaf.id) && !leaf.faded) {
        element.classList.add("map-closed-group");
        const open = toolButton("expand", `${labelOf(leaf.id)}を開く`, () => {
          state.collapsed.delete(leaf.id);
          save();
          render();
        }, { "aria-expanded": "false" });
        open.classList.add("map-group-toggle");
        element.append(open);
      }
    }
    for (const wire of stage.querySelectorAll(".mdmark-diagram-wire")) {
      const color = spec.data.colors?.[wire.dataset.wire];
      if (color) wire.style.stroke = `var(--mdmark-color-accent-${color}-text)`;
      if (hot) {
        const edge = layout.edges.find((item) => item.id === wire.dataset.wire);
        if (!(edge && hot.has(edge.from) && hot.has(edge.to))) wire.classList.add("map-dim");
      }
    }
  };

  /** 図の右上のツール: 中にいるときの外へ戻る・案内・再生を、今のツールの並びに足す */
  const decorateTools = (figure) => {
    const tools = figure.querySelector(".mdmark-diagram-tools");
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    if (state.enter) group.append(toolButton("back", "グループの外へ戻る", () => leaveGroup()));
    if (spec.data.walkthroughs?.length) {
      group.append(toolButton("route", "案内", () => (state.step === undefined ? startWalkthrough() : endWalkthrough()), { "aria-pressed": String(state.step !== undefined) }));
    }
    tools.prepend(group);
  };

  /** 案内と再生の帯: 図の枠の下に、番号・文・アイコンのボタンを並べる */
  const renderBand = (figure) => {
    const box = figure.querySelector(".mdmark-diagram-box");
    const band = document.createElement("div");
    band.className = "map-band";
    if (state.step !== undefined) {
      const steps = spec.data.walkthroughs;
      band.setAttribute("role", "region");
      band.setAttribute("aria-label", `${spec.title}の案内`);
      band.append(
        text("map-band-count", `${state.step + 1} / ${steps.length}`),
        text("map-band-text", steps[state.step].text, true),
        buttons([
          toolButton("prev", "前の手順", () => applyStep(state.step - 1), state.step === 0 ? { disabled: "" } : {}),
          toolButton("next", "次の手順", () => applyStep(state.step + 1), state.step === steps.length - 1 ? { disabled: "" } : {}),
          toolButton("close", "案内を閉じる", () => endWalkthrough()),
        ]),
      );
      band.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" && state.step < steps.length - 1) applyStep(state.step + 1);
        if (event.key === "ArrowLeft" && state.step > 0) applyStep(state.step - 1);
      });
      box.after(band);
      return;
    }
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const total = sequence.messages.length;
      band.setAttribute("role", "region");
      band.setAttribute("aria-label", `${spec.title}の再生`);
      const seconds = document.createElement("select");
      seconds.className = "map-seconds";
      seconds.setAttribute("aria-label", "自動で進める間隔");
      for (const value of AUTOPLAY_SECONDS) {
        const option = new Option(`${value} 秒ごと`, String(value), false, value === state.seconds);
        seconds.append(option);
      }
      seconds.addEventListener("change", () => {
        state.seconds = Number(seconds.value);
        schedule();
      });
      band.append(
        text("map-band-count", `${state.play + 1} / ${total}`),
        text("map-band-text", `${labelOf(message.from)} → ${labelOf(message.to)}　${message.text}`, true),
        buttons([
          toolButton("prev", "前のメッセージ", () => playAt(state.play - 1), state.play === 0 ? { disabled: "" } : {}),
          toolButton(state.autoplay ? "pause" : "play", state.autoplay ? "一時停止" : "自動で進める", () => {
            state.autoplay = !state.autoplay;
            render();
            schedule();
          }),
          toolButton("next", "次のメッセージ", () => playAt(state.play + 1), state.play === total - 1 ? { disabled: "" } : {}),
          seconds,
          toolButton("close", "再生を終える", () => endPlay()),
        ]),
      );
      box.after(band);
    }
  };

  const text = (className, value, live = false) => {
    const p = document.createElement("p");
    p.className = className;
    p.textContent = value;
    if (live) p.setAttribute("aria-live", "polite");
    return p;
  };
  const buttons = (items) => {
    const wrap = document.createElement("div");
    wrap.className = "map-band-actions";
    wrap.append(...items);
    return wrap;
  };

  /** 再生の印: 今のメッセージの線に沿って、再生している間ずっと繰り返し動かす */
  const renderPlayDot = (stage, layout) => {
    if (state.play === undefined || !sequence) return;
    const message = sequence.messages[state.play];
    const from = visibleOf(message.from);
    const to = visibleOf(message.to);
    const edge = layout.edges.find((item) => item.from === from && item.to === to) ?? layout.edges.find((item) => item.from === to && item.to === from);
    if (!edge) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    const wire = wires.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
    wire.id = `map-play-${spec.id}`;
    wire.classList.remove("map-dim");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const reverse = edge.from !== from;
    wires.insertAdjacentHTML(
      "beforeend",
      `<circle class="map-play-dot" r="6"><animateMotion dur="${PLAY_LOOP_SECONDS}s" repeatCount="indefinite" keyPoints="${reverse ? "1;0" : "0;1"}" keyTimes="0;1" calcMode="linear"><mpath href="#${wire.id}"/></animateMotion></circle>`,
    );
  };

  const schedule = () => {
    clearInterval(timer);
    if (state.play === undefined || !state.autoplay || !sequence) return;
    timer = setInterval(() => {
      state.play += 1;
      // 最後のメッセージで自動で進めるのを止める
      if (state.play === sequence.messages.length - 1) {
        state.autoplay = false;
        clearInterval(timer);
      }
      render();
    }, state.seconds * 1000);
  };

  const enterGroup = (id) => {
    state.enter = id;
    save();
    render();
  };
  const leaveGroup = () => {
    state.enter = boxById.get(state.enter)?.parent;
    save();
    render();
  };
  const startWalkthrough = () => {
    start.enter = state.enter;
    applyStep(0);
  };
  const applyStep = (index) => {
    const step = spec.data.walkthroughs[index];
    state.step = index;
    state.enter = step.enter;
    render();
  };
  const endWalkthrough = () => {
    state.step = undefined;
    state.enter = start.enter;
    render();
  };
  const startPlay = () => {
    start.enter = state.enter;
    state.step = undefined;
    state.autoplay = true;
    playAt(0);
    schedule();
  };
  const playAt = (index) => {
    state.play = index;
    render();
    schedule();
  };
  const endPlay = () => {
    clearInterval(timer);
    state.play = undefined;
    state.enter = start.enter;
    render();
  };

  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.enter && state.step === undefined) {
      event.stopPropagation();
      leaveGroup();
    }
  });

  render();
  schedule();
  return { startPlay };
};

/** シーケンス図の map: 今のシーケンス図の部品で描き、右上のツールに「構成図の上で再生」を足す */
export const createSequence = (host, spec, kinds, onPlay) => {
  const sequence = parseSequence(spec.source);
  const definition = {
    title: spec.title,
    scope: "map のシーケンス図",
    updated: "2026-11-09",
    participants: sequence.participants.map((participant) => ({ id: participant.id, kind: kinds[participant.id] ?? "script", name: participant.label })),
    steps: sequence.messages.map((message) => ({ from: message.from, to: message.to, label: message.text, ...(message.reply ? { reply: true } : {}) })),
  };
  mount(host, { markdown: `<!-- sequence -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /sequence -->\n` });
  const tools = host.querySelector(".mdmark-diagram-tools");
  const group = document.createElement("div");
  group.className = "mdmark-diagram-tools-group";
  group.append(toolButton("play", "構成図の上で再生", onPlay));
  tools.prepend(group);
};
