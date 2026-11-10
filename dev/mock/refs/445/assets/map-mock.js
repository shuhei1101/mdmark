// map の図のモック: Mermaid と補足を PoC の自動配置で配置し、今のフロー図・シーケンス図の部品（配布物の mount）で描く。
// 入れ子のグループ・中へ入る・開閉・案内・再生は、描いた図の上に足す。実装の mount が描く構造の案

import { mount } from "../../../../../dist/index.js";
import { layoutMap, parseFlowchart, parseSequence } from "./map-layout.js";

/** 自動で進める間隔の既定（秒）。文書ではマーカーの引数 `interval` で指定し、画面からは変えない */
const DEFAULT_AUTOPLAY_SECONDS = 2;
/** 1 通のメッセージの印が線を 1 往復する時間（秒） */
const PLAY_LOOP_SECONDS = 1.2;
/** 図を縮める下限（確認ログ: 等倍より縮めない）。24px のボタンを 24px 未満に縮めない */
const MIN_SCALE = 1;
/** 開いたときの表示する枠の高さの上限（px）。以降は読む人がリサイズハンドルで変えるまで変えない */
const MAX_INITIAL_HEIGHT = 560;
/** 中へ入る・開閉・手順の切り替えで、ノードとグループを前の位置から動かす時間（ms） */
const MOVE_MS = 350;
/** 開閉と中へ入った状態をタブの中で保つ sessionStorage のキーの頭 */
const STORAGE_PREFIX = "mdmark-map:";

/** Mermaid のクラスと、今のフロー図のノードの種類の対応 */
const KINDS = { llm: "llm", script: "script", data: "data", external: "external", mcp: "mcp", dm: "dm" };
/** Mermaid の矢印と、今のフロー図の線の種類の対応 */
const LINES = { solid: "flow", dotted: "read", thick: "write" };

/** 今の図のボタンと同じ Lucide のアイコン */
const ICONS = {
  back: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
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
 * map の構成図を 1 つ作る。host の中に描き、操作のたびに描き直す。
 * 描き直しても、文書と図の中のスクロール・表示する枠の高さを保ち、ノードとグループは前の位置から動かす。
 * spec: { id, title, interval, flow, data: { notes, walkthroughs, layout, colors }, sequence?: { title, source } }
 * initial: { enter, collapsed, step, play, auto }
 */
export const createMap = (host, spec, initial = {}) => {
  const chart = parseFlowchart(spec.flow);
  const sequence = spec.sequence ? parseSequence(spec.sequence.source) : undefined;
  const steps = spec.data.walkthroughs ?? [];
  const notes = spec.data.notes ?? {};
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
    auto: initial.auto ?? false,
    seconds: spec.interval ?? DEFAULT_AUTOPLAY_SECONDS,
    height: undefined,
  };
  const start = { enter: state.enter };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  /** 表示している 1 本の線にまとまった元の線 */
  const sourcesOf = (edge) => chart.edges.filter((item) => visibleOf(item.from) === edge.from && visibleOf(item.to) === edge.to);

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
      const note = notes[leaf.id];
      return {
        id: leaf.id,
        kind,
        ...(box ? { tag: "グループ" } : {}),
        x: leaf.x,
        y: leaf.y,
        w: leaf.w,
        h: leaf.h,
        name: box ? box.title : leaf.lines.join(""),
        ...(note ? { hint: note } : {}),
      };
    }),
    wires: layout.edges.map((edge) => {
      const sources = sourcesOf(edge);
      // まとめた線は本数もラベルも出さず、元の線はポインターを当てたときのツールチップに出す
      const label = sources.length === 1 ? sources[0].label : undefined;
      const source = chart.edges.find((item) => item.id === edge.id);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        line: LINES[source?.line ?? "solid"],
        points: edge.points,
        ...(label ? { label, labelAt: longestMid(edge.points) } : {}),
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

  /** 線のツールチップの文: 元の線ごとに「元 → 先」と、補足の notes の説明 */
  const wireTip = (edge) =>
    sourcesOf(edge)
      .map((item) => {
        const detail = notes[item.id] ?? item.label;
        return `${labelOf(item.from)} → ${labelOf(item.to)}${detail ? `：${detail}` : ""}`;
      })
      .join("\n");

  const highlighted = () => {
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      return new Set([visibleOf(message.from), visibleOf(message.to)]);
    }
    if (state.step !== undefined) return new Set((steps[state.step].highlight ?? []).map(visibleOf));
    return undefined;
  };

  /** 描き直す前のノードとグループの位置（中身の座標） */
  const positionsOf = () => {
    const positions = new Map();
    for (const element of host.querySelectorAll(".mdmark-diagram-stage [data-node], .mdmark-diagram-stage [data-group]")) {
      const key = element.dataset.node ?? element.dataset.group;
      positions.set(key, { x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight });
    }
    return positions;
  };

  const render = () => {
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const before = positionsOf();
    const layout = layoutMap(chart, { enter: state.enter, collapsed: [...state.collapsed] }, spec.data.layout ?? {});
    host.replaceChildren();
    mount(host, { markdown: `<!-- flow -->\n\n\`\`\`json\n${JSON.stringify(toFlowDefinition(layout))}\n\`\`\`\n\n<!-- /flow -->\n` });
    const figure = host.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    decorateGroups(stage, layout);
    decorateNodes(stage, layout);
    decorateWires(figure, layout);
    decorateTools(figure);
    renderBand(figure);
    renderDots(stage, layout);
    keepScaleAndHeight(figure, layout);
    animateFrom(stage, before);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
  };

  /**
   * 倍率は等倍より縮めず（実装では zoom の fitMin に 1 を渡す）、表示する枠の高さは開いたときの高さか、
   * 読む人がリサイズハンドルで変えた高さのまま保つ。操作で図の大きさが変わっても、枠の高さは変えない
   */
  const keepScaleAndHeight = (figure, layout) => {
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const sizer = figure.querySelector(".mdmark-diagram-sizer");
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    state.height ??= Math.min(layout.height * MIN_SCALE + 16, MAX_INITIAL_HEIGHT);
    const enforce = () => {
      const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
      if (scale < MIN_SCALE) {
        stage.style.transform = `scale(${MIN_SCALE})`;
        sizer.style.width = `${layout.width * MIN_SCALE}px`;
        sizer.style.height = `${layout.height * MIN_SCALE}px`;
      }
      const height = `${state.height}px`;
      if (viewport.style.height !== height) {
        viewport.style.height = height;
        viewport.style.maxHeight = height;
      }
    };
    const observer = new MutationObserver(enforce);
    observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
    observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
    // リサイズハンドルで変えた高さを、次に描き直すときの高さにする
    const handle = figure.querySelector(".mdmark-diagram-resize");
    const remember = () => {
      observer.disconnect();
      state.height = viewport.getBoundingClientRect().height;
      observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
      observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
    };
    handle?.addEventListener("pointerdown", () => observer.disconnect());
    handle?.addEventListener("keydown", () => observer.disconnect());
    handle?.addEventListener("pointerup", remember);
    handle?.addEventListener("keyup", remember);
    handle?.addEventListener("dblclick", remember);
    enforce();
  };

  /** ノードとグループを前の位置から今の位置へ動かし、線は動き終えてから出す */
  const animateFrom = (stage, before) => {
    if (reduced || before.size === 0) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    for (const element of stage.querySelectorAll("[data-node], [data-group]")) {
      const old = before.get(element.dataset.node ?? element.dataset.group);
      if (!old) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: "ease-out" });
        continue;
      }
      const dx = old.x - element.offsetLeft;
      const dy = old.y - element.offsetTop;
      const sx = old.w / element.offsetWidth;
      const sy = old.h / element.offsetHeight;
      if (dx === 0 && dy === 0 && sx === 1 && sy === 1) continue;
      element.style.transformOrigin = "0 0";
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
        { duration: MOVE_MS, easing: "ease-in-out" },
      );
    }
    wires.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: MOVE_MS * 1.6 });
  };

  /** 入れ子のグループ: 図の線とノードの下に、色の面と、開閉の山形と、タイトルを置く */
  const decorateGroups = (stage, layout) => {
    const wires = stage.querySelector(".mdmark-diagram-wires");
    for (const box of layout.boxes) {
      const title = boxById.get(box.id)?.title ?? box.id;
      const group = document.createElement("div");
      group.className = "map-group";
      group.dataset.group = box.id;
      group.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;${colorStyle(spec.data.colors?.[box.id])}`;
      const head = document.createElement("div");
      head.className = "map-group-head";
      head.append(
        disclosure(true, title, () => {
          state.collapsed.add(box.id);
          save();
          render();
        }),
        groupTitle(title, box.id),
      );
      group.append(head);
      stage.insertBefore(group, wires);
    }
  };

  /** 開閉の山形: 枠を持たない小さなアイコン。開いているときは下向き、閉じているときは右向き */
  const disclosure = (expanded, title, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-disclosure";
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `${title}を${expanded ? "閉じる" : "開く"}`);
    button.title = expanded ? "閉じる" : "開く";
    button.innerHTML = icon(expanded ? "collapse" : "expand");
    button.addEventListener("click", onClick);
    return button;
  };

  const groupTitle = (title, id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-group-title";
    button.textContent = title;
    button.title = "ダブルクリックで中へ入る";
    button.addEventListener("dblclick", () => enterGroup(id));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter") enterGroup(id);
    });
    return button;
  };

  /** ノード: 閉じたグループは山形で開く。入ったグループの外は薄くする。案内と再生で強調する */
  const decorateNodes = (stage, layout) => {
    const hot = highlighted();
    for (const leaf of layout.leaves) {
      const element = stage.querySelector(`[data-node="${CSS.escape(leaf.id)}"]`);
      if (!element) continue;
      const color = spec.data.colors?.[leaf.id];
      if (color) {
        element.style.cssText += colorStyle(color);
        element.classList.add("map-colored");
      }
      if (leaf.faded) element.classList.add("map-faded");
      if (hot?.has(leaf.id)) element.classList.add("map-hot");
      else if (hot) element.classList.add("map-dim");
      if (boxById.has(leaf.id) && !leaf.faded) {
        element.classList.add("map-closed-group");
        element.append(
          disclosure(false, labelOf(leaf.id), () => {
            state.collapsed.delete(leaf.id);
            save();
            render();
          }),
        );
      }
    }
  };

  /** 線: 色・強調と、ポインターを当てた線を太くしてツールチップに元の線と説明を出す */
  const decorateWires = (figure, layout) => {
    const hot = highlighted();
    const svg = figure.querySelector(".mdmark-diagram-wires");
    const box = figure.querySelector(".mdmark-diagram-box");
    const tip = document.createElement("div");
    tip.className = "map-wire-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    box.append(tip);
    for (const edge of layout.edges) {
      const wire = svg.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
      if (!wire) continue;
      const color = spec.data.colors?.[edge.id];
      if (color) wire.style.setProperty("--map-wire", `var(--mdmark-color-accent-${color}-text)`);
      if (color) wire.classList.add("map-colored-wire");
      if (hot && !(hot.has(edge.from) && hot.has(edge.to))) wire.classList.add("map-dim");
      const path = wire.matches("path") ? wire : wire.querySelector("path");
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.setAttribute("d", path.getAttribute("d"));
      hit.setAttribute("class", "map-wire-hit");
      hit.addEventListener("pointerenter", () => {
        wire.classList.add("map-wire-hover");
        tip.textContent = wireTip(edge);
        tip.hidden = false;
      });
      hit.addEventListener("pointermove", (event) => {
        const rect = box.getBoundingClientRect();
        // 図の枠の右端と下端からはみ出さないよう、ポインターの左上へ回す
        const x = event.clientX - rect.left + 12;
        const y = event.clientY - rect.top + 12;
        tip.style.left = `${x + tip.offsetWidth > rect.width ? Math.max(0, x - 24 - tip.offsetWidth) : x}px`;
        tip.style.top = `${y + tip.offsetHeight > rect.height ? Math.max(0, y - 24 - tip.offsetHeight) : y}px`;
      });
      hit.addEventListener("pointerleave", () => {
        wire.classList.remove("map-wire-hover");
        tip.hidden = true;
      });
      svg.append(hit);
    }
  };

  /** 図の右上のツール: 中にいるときだけ、外へ戻るボタンを今のツールの並びに足す */
  const decorateTools = (figure) => {
    if (!state.enter) return;
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    group.append(toolButton("back", "グループの外へ戻る", () => leaveGroup()));
    figure.querySelector(".mdmark-diagram-tools").prepend(group);
  };

  /** 図の枠の下の帯: 案内の手順を常に出し、再生している間は再生のメッセージに替える */
  const renderBand = (figure) => {
    const playing = state.play !== undefined && sequence;
    if (!playing && steps.length === 0) return;
    const total = playing ? sequence.messages.length : steps.length;
    const index = playing ? state.play : state.step;
    const band = document.createElement("div");
    band.className = "map-band";
    band.setAttribute("role", "region");
    band.setAttribute("aria-label", playing ? `${spec.title}の再生` : `${spec.title}の案内`);
    const message = playing ? sequence.messages[state.play] : undefined;
    const textValue = playing
      ? `${labelOf(message.from)} → ${labelOf(message.to)}　${message.text}`
      : index === undefined
        ? ""
        : steps[index].text;
    const go = (next) => (playing ? playAt(next) : applyStep(next));
    // ボタンは前へ・停止・再生（一時停止）・次への 4 つを常に同じ並びで出し、状態では押せるかだけを変える
    const actions = [
      toolButton("prev", playing ? "前のメッセージ" : "前の手順", () => go(index - 1), index === undefined || index === 0 ? { disabled: "" } : {}),
      toolButton("stop", playing ? "再生を終える" : "案内をやめる", () => (playing ? endPlay() : endWalkthrough()), index === undefined ? { disabled: "" } : {}),
      toolButton(state.auto ? "pause" : "play", state.auto ? "一時停止" : "自動で進める", () => {
        state.auto = !state.auto;
        if (state.auto && index === undefined) go(0);
        else render();
        schedule();
      }, { "aria-pressed": String(state.auto) }),
      toolButton("next", playing ? "次のメッセージ" : "次の手順", () => go(index === undefined ? 0 : (index + 1) % total)),
    ];
    band.append(text("map-band-count", `${index === undefined ? "–" : index + 1} / ${total}`), text("map-band-text", textValue, true), buttons(actions));
    band.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") go(index === undefined ? 0 : (index + 1) % total);
      if (event.key === "ArrowLeft" && index > 0) go(index - 1);
    });
    figure.querySelector(".mdmark-diagram-box").after(band);
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

  /**
   * 線の上を動く印: 再生では今のメッセージの線、案内では強調するノードどうしの線に、
   * 次へ進むまでずっと繰り返し動かす。動きを減らす設定では出さない
   */
  const renderDots = (stage, layout) => {
    const hot = highlighted();
    if (!hot || reduced) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    const routes = [];
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const from = visibleOf(message.from);
      const to = visibleOf(message.to);
      const edge = layout.edges.find((item) => item.from === from && item.to === to) ?? layout.edges.find((item) => item.from === to && item.to === from);
      if (edge) routes.push({ edge, reverse: edge.from !== from });
    } else {
      for (const edge of layout.edges) if (hot.has(edge.from) && hot.has(edge.to)) routes.push({ edge, reverse: false });
    }
    routes.forEach(({ edge, reverse }, index) => {
      const wire = wires.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
      const path = wire.matches("path") ? wire : wire.querySelector("path");
      path.id = `map-dot-${spec.id}-${index}`;
      // データが流れている線: 太くし、破線を元から先へ流す
      wire.classList.remove("map-dim");
      wire.classList.add("map-flowing");
      if (reverse) wire.classList.add("map-flowing-reverse");
      wires.insertAdjacentHTML(
        "beforeend",
        `<circle class="map-play-dot" r="7"><animateMotion dur="${PLAY_LOOP_SECONDS}s" repeatCount="indefinite" keyPoints="${reverse ? "1;0" : "0;1"}" keyTimes="0;1" calcMode="linear"><mpath href="#${path.id}"/></animateMotion></circle>`,
      );
    });
  };

  /** 自動で進める: 選んだ間隔ごとに次へ進み、最後の次は最初へ戻って繰り返す */
  const schedule = () => {
    clearInterval(timer);
    if (!state.auto) return;
    timer = setInterval(() => {
      if (state.play !== undefined && sequence) playAt((state.play + 1) % sequence.messages.length, false);
      else if (steps.length) applyStep(state.step === undefined ? 0 : (state.step + 1) % steps.length);
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
  const applyStep = (index) => {
    if (state.step === undefined) start.enter = state.enter;
    state.step = index;
    state.enter = steps[index].enter ?? start.enter;
    render();
  };
  const endWalkthrough = () => {
    clearInterval(timer);
    state.auto = false;
    state.step = undefined;
    state.enter = start.enter;
    render();
  };
  const startPlay = () => {
    if (state.play === undefined) start.enter = state.enter;
    state.step = undefined;
    state.auto = true;
    playAt(0);
  };
  const playAt = (index, reschedule = true) => {
    state.play = index;
    render();
    if (reschedule) schedule();
  };
  const endPlay = () => {
    clearInterval(timer);
    state.auto = false;
    state.play = undefined;
    state.enter = start.enter;
    render();
  };

  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.enter && state.step === undefined && state.play === undefined) {
      event.stopPropagation();
      leaveGroup();
    }
  });

  render();
  schedule();
  return { startPlay };
};

/** シーケンス図の map も構成図と同じく等倍より縮めず、表示する枠の高さを等倍の図の高さにする（実装では zoom の fitMin に 1 を渡す） */
const keepSequenceScale = (host) => {
  const stage = host.querySelector(".mdmark-diagram-stage");
  const sizer = host.querySelector(".mdmark-diagram-sizer");
  const viewport = host.querySelector(".mdmark-diagram-viewport");
  const enforce = () => {
    const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
    const width = stage.offsetWidth;
    const height = stage.offsetHeight;
    if (scale < MIN_SCALE) {
      stage.style.transform = `scale(${MIN_SCALE})`;
      sizer.style.width = `${width * MIN_SCALE}px`;
      sizer.style.height = `${height * MIN_SCALE}px`;
    }
    const frame = `${Math.max(scale, MIN_SCALE) * height + 16}px`;
    if (viewport.style.height !== frame) {
      viewport.style.height = frame;
      viewport.style.maxHeight = frame;
    }
  };
  const observer = new MutationObserver(enforce);
  observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
  observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
  enforce();
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
  host.querySelector("figure.mdmark-diagram").classList.add("map-figure");
  keepSequenceScale(host);
  const tools = host.querySelector(".mdmark-diagram-tools");
  const group = document.createElement("div");
  group.className = "mdmark-diagram-tools-group";
  group.append(toolButton("play", "構成図の上で再生", onPlay));
  tools.prepend(group);
};
