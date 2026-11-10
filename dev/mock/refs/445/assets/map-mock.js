// map の図のモック: Mermaid と補足を PoC の自動配置で配置し、今のフロー図・シーケンス図の部品（配布物の mount）で描く。
// 入れ子のグループ・中へ入る・開閉・案内・再生は、描いた図の上に足す。実装の mount が描く構造の案

import { mount } from "../../../../../dist/index.js";
import { layoutMap, parseFlowchart, parseSequence } from "./map-layout.js";

/** 自動で進める間隔の既定（秒）。文書ではマーカーの引数 `interval` で指定し、画面からは変えない */
const DEFAULT_AUTOPLAY_SECONDS = 2;
/** データの印の速さ（px/秒）・印どうしの間隔（px）・1 本の線に同時に流す印の数の上限 */
const PACKET_SPEED = 120;
const PACKET_GAP = 60;
const PACKET_MAX = 6;
/** データの印の既定。補足の layout の packet（図全体）と、線の ID ごとの packet で上書きする */
const DEFAULT_PACKET = { color: "line", shape: "dot" };
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
  expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
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
 * 線の上にデータの印を流す。印は線の長さに応じた数を間をあけて元から先へ繰り返し動かし、両向きの線は先から元へも流す。
 * packet: { color: line（線の色）| source（元のノードの色）| target（先のノードの色）| 色の名前, shape: dot | square | diamond }
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const addPackets = (svg, path, { reverse = false, both = false, packet = DEFAULT_PACKET, nodeColor = {} } = {}) => {
  const color =
    packet.color === "line"
      ? getComputedStyle(path).stroke
      : packet.color === "source"
        ? (nodeColor.source ?? getComputedStyle(path).stroke)
        : packet.color === "target"
          ? (nodeColor.target ?? getComputedStyle(path).stroke)
          : `var(--mdmark-color-accent-${packet.color}-text)`;
  const shapeOf = () => {
    if (packet.shape === "square") {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", "-6");
      rect.setAttribute("y", "-6");
      rect.setAttribute("width", "12");
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "2");
      return rect;
    }
    if (packet.shape === "diamond") {
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", "0,-8 8,0 0,8 -8,0");
      return polygon;
    }
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", "7");
    return circle;
  };
  // 線の長さによらず同じ速さで動かし、長い線ほど印を多く流す
  const length = path.getTotalLength();
  const seconds = Math.max(0.6, length / PACKET_SPEED);
  const count = Math.max(1, Math.min(PACKET_MAX, Math.floor(length / PACKET_GAP)));
  const directions = both ? [reverse, !reverse] : [reverse];
  for (const backward of directions) {
    for (let index = 0; index < count; index += 1) {
      const shape = shapeOf();
      shape.setAttribute("class", "map-packet");
      shape.style.fill = color;
      const motion = document.createElementNS(SVG_NS, "animateMotion");
      motion.setAttribute("dur", `${seconds}s`);
      motion.setAttribute("begin", `${-(seconds / count) * index}s`);
      motion.setAttribute("repeatCount", "indefinite");
      motion.setAttribute("keyPoints", backward ? "1;0" : "0;1");
      motion.setAttribute("keyTimes", "0;1");
      motion.setAttribute("calcMode", "linear");
      const mpath = document.createElementNS(SVG_NS, "mpath");
      mpath.setAttribute("href", `#${path.id}`);
      motion.append(mpath);
      shape.append(motion);
      svg.append(shape);
    }
  }
};

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
    // 補足の layout でグループごとに最初に閉じるかを指定できる（既定は開く）
    collapsed: new Set(
      initial.collapsed ??
        saved.collapsed ??
        Object.entries(spec.data.layout ?? {})
          .filter(([, value]) => value.collapsed)
          .map(([id]) => id),
    ),
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

  /** 線のツールチップの文: 補足の notes に説明を持つ元の線だけを「元 → 先：説明」で並べる。説明が無ければ空 */
  const wireTip = (edge) => {
    const lines = sourcesOf(edge).filter((item) => notes[item.id]);
    if (lines.length === 1 && sourcesOf(edge).length === 1) return notes[lines[0].id];
    return lines.map((item) => `${labelOf(item.from)} → ${labelOf(item.to)}：${notes[item.id]}`).join("\n");
  };

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
    renderPackets(stage, layout);
    keepScaleAndHeight(figure, layout);
    animateFrom(stage, before);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
    revealHot(viewport, stage, layout);
    if (state.play !== undefined) spec.onPlay?.(state.play);
  };

  /** 案内と再生で強調するノードが図の枠の外にあるときだけ、枠の中をそのノードが入るまでスクロールする（文書のスクロールと倍率は変えない） */
  const revealHot = (viewport, stage, layout) => {
    const hot = highlighted();
    if (!hot) return;
    const rects = layout.leaves.filter((leaf) => hot.has(leaf.id));
    if (rects.length === 0) return;
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    const view = { left: viewport.scrollLeft, right: viewport.scrollLeft + viewport.clientWidth, top: viewport.scrollTop, bottom: viewport.scrollTop + viewport.clientHeight };
    if (left >= view.left && right <= view.right && top >= view.top && bottom <= view.bottom) return;
    viewport.scrollTo({
      left: Math.max(0, (left + right) / 2 - viewport.clientWidth / 2),
      top: Math.max(0, (top + bottom) / 2 - viewport.clientHeight / 2),
      behavior: reduced ? "auto" : "smooth",
    });
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
      // 今の部品は倍率に合わせて高さと高さの上限を書き換えるため、両方を見て戻す
      const height = `${state.height}px`;
      if (viewport.style.height !== height || viewport.style.maxHeight !== height) {
        viewport.style.height = height;
        viewport.style.maxHeight = height;
      }
      syncZoomText(figure, stage);
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
        disclosure(true, title, (event) => {
          // Shift を押しながらだと、このグループと中のグループを全て閉じる
          for (const id of event.shiftKey ? groupsUnder(box.id) : [box.id]) state.collapsed.add(id);
          save();
          render();
        }),
        // 今入っているグループのタイトルは押せない文字にする（それ以上は入れない）
        box.id === state.enter ? plainTitle(title) : groupTitle(title, box.id),
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

  /** グループのタイトル: 押すとそのグループの中へ入るボタン */
  const groupTitle = (title, id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-group-title";
    button.textContent = title;
    button.title = "中へ入る";
    button.addEventListener("click", () => enterGroup(id));
    return button;
  };
  const plainTitle = (title) => {
    const span = document.createElement("span");
    span.className = "map-group-title is-current";
    span.textContent = title;
    return span;
  };
  /** グループと、その中の全てのグループの ID */
  const groupsUnder = (id) => chart.boxes.filter((box) => isUnder(box.id, id)).map((box) => box.id);

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
          disclosure(false, labelOf(leaf.id), (event) => {
            // Shift を押しながらだと、このグループと中のグループを全て開く
            for (const id of event.shiftKey ? groupsUnder(leaf.id) : [leaf.id]) state.collapsed.delete(id);
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
    const stage = figure.querySelector(".mdmark-diagram-stage");
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
      const ends = [edge.from, edge.to].map((id) => stage.querySelector(`[data-node="${CSS.escape(id)}"]`)).filter(Boolean);
      hit.addEventListener("pointerenter", () => {
        // 線を太くし、つながるノードを強調する（ほかは薄くしない）。説明が無い線はツールチップを出さない
        wire.classList.add("map-wire-hover");
        for (const end of ends) end.classList.add("map-wire-end");
        tip.textContent = wireTip(edge);
        tip.hidden = tip.textContent === "";
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
        for (const end of ends) end.classList.remove("map-wire-end");
        tip.hidden = true;
      });
      svg.append(hit);
    }
  };

  /**
   * 図の右上のツール: 外へ戻る・全て開く・全て閉じるを、今のツールの並びの先頭に常に同じ位置で置く。
   * 全体の図では戻るは押せない状態で出す。図を動かす矢印のボタンは出さない（枠の中のスクロールで動かす）
   */
  const decorateTools = (figure) => {
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    group.append(
      toolButton("back", "グループの外へ戻る", () => leaveGroup(), state.enter ? {} : { disabled: "" }),
      toolButton("expandAll", "全てのグループを開く", () => {
        state.collapsed.clear();
        save();
        render();
      }),
      toolButton("collapseAll", "全てのグループを閉じる", () => {
        for (const box of chart.boxes) if (!state.enter || !isUnder(state.enter, box.id)) state.collapsed.add(box.id);
        state.collapsed.delete(state.enter);
        save();
        render();
      }),
    );
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
      // 前へ・次へは常に押せ、端では反対の端へ回る（始める前の前へは最後へ）
      toolButton("prev", playing ? "前のメッセージ" : "前の手順", () => go(index === undefined || index === 0 ? total - 1 : index - 1)),
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
      if (event.key === "ArrowLeft") go(index === undefined || index === 0 ? total - 1 : index - 1);
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
   * データの流れ: 再生では今のメッセージの線、案内では強調するノードどうしの線を太くし、
   * データの印を元から先へ流し続ける（両向きの線は両方へ）。動きを減らす設定では線の強調だけにする
   */
  const renderPackets = (stage, layout) => {
    const hot = highlighted();
    if (!hot) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    const routes = [];
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const from = visibleOf(message.from);
      const to = visibleOf(message.to);
      const edge = layout.edges.find((item) => item.from === from && item.to === to) ?? layout.edges.find((item) => item.from === to && item.to === from);
      if (edge) routes.push({ edge, reverse: edge.from !== from, both: false });
    } else {
      for (const edge of layout.edges) {
        if (hot.has(edge.from) && hot.has(edge.to)) routes.push({ edge, reverse: false, both: sourcesOf(edge).some((item) => item.both) });
      }
    }
    const nodeColorOf = (id) => {
      const element = stage.querySelector(`[data-node="${CSS.escape(id)}"]`);
      return element ? getComputedStyle(element).borderTopColor : undefined;
    };
    routes.forEach(({ edge, reverse, both }, index) => {
      const wire = wires.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
      const path = wire.matches("path") ? wire : wire.querySelector("path");
      path.id = `map-packet-${spec.id}-${index}`;
      wire.classList.remove("map-dim");
      wire.classList.add("map-flowing");
      // データの流れは読者が次へ・再生を押して始め、停止で止められる動きのため、動きを減らす設定でも流す
      const packet = { ...DEFAULT_PACKET, ...spec.data.layout?.packet, ...spec.data.layout?.[edge.id]?.packet };
      addPackets(wires, path, { reverse, both, packet, nodeColor: { source: nodeColorOf(reverse ? edge.to : edge.from), target: nodeColorOf(reverse ? edge.from : edge.to) } });
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
    spec.onPlay?.(undefined);
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

/** 倍率の文字を、下限を当てた後の実際の倍率に合わせる */
const syncZoomText = (root, stage) => {
  const text = root.querySelector('[data-tool="fit"]');
  const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
  const value = `${Math.round(scale * 100)}%`;
  if (text && text.textContent !== value) text.textContent = value;
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
    if (viewport.style.height !== frame || viewport.style.maxHeight !== frame) {
      viewport.style.height = frame;
      viewport.style.maxHeight = frame;
    }
    syncZoomText(host, stage);
  };
  const observer = new MutationObserver(enforce);
  observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
  observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
  enforce();
};

/**
 * シーケンス図の map: 今のシーケンス図の部品で描き、次を足す。
 * - 右上のツール: 構成図の上で再生・参加者（表示と非表示・並び順）
 * - 参加者の箱を押すと、その参加者が送る・受けるメッセージとライフラインを強調し、ほかを薄くする（2 人以上なら選んだ参加者のあいだ）
 * - メッセージの線にポインターを当てると線を太くして両端の参加者を強調し、補足の notes に説明があればツールチップに出す
 * - 構成図の上で再生している間は、今のメッセージの線にもデータの印を流す
 * spec: { id, title, source, notes }
 */
export const createSequence = (host, spec, kinds, onPlay) => {
  const sequence = parseSequence(spec.source);
  const notes = spec.notes ?? {};
  const state = {
    selected: new Set(),
    hidden: new Set(),
    order: sequence.participants.map((participant) => participant.id),
    current: undefined,
    menuOpen: false,
  };
  const labelOf = (id) => sequence.participants.find((participant) => participant.id === id)?.label ?? id;

  const render = () => {
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const visible = state.order.filter((id) => !state.hidden.has(id));
    // 非表示の参加者に関わるメッセージは隠す。描いたメッセージの番号から元のメッセージの番号を引けるようにする
    const shown = sequence.messages.map((message, index) => ({ message, index })).filter(({ message }) => visible.includes(message.from) && visible.includes(message.to));
    const definition = {
      title: spec.title,
      scope: "map のシーケンス図",
      updated: "2026-11-09",
      participants: visible.map((id) => ({ id, kind: kinds[id] ?? "script", name: labelOf(id) })),
      steps: shown.map(({ message }) => ({ from: message.from, to: message.to, label: message.text, ...(message.reply ? { reply: true } : {}) })),
    };
    host.replaceChildren();
    mount(host, { markdown: `<!-- sequence -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /sequence -->\n` });
    const figure = host.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const svg = stage.querySelector(".mdmark-diagram-wires");
    const wires = [...svg.querySelectorAll(".mdmark-diagram-wire")];
    const lifelines = [...svg.querySelectorAll(".mdmark-diagram-lifeline")];
    const heads = (id) => stage.querySelector(`[data-node="${CSS.escape(id)}"]`);

    // 参加者を選んだときの強調
    const related = (message) =>
      state.selected.size === 0
        ? undefined
        : state.selected.size === 1
          ? state.selected.has(message.from) || state.selected.has(message.to)
          : state.selected.has(message.from) && state.selected.has(message.to);
    shown.forEach(({ message }, at) => {
      const hit = related(message);
      if (hit === false) {
        wires[at]?.classList.add("map-dim");
        stage.querySelectorAll(".mdmark-diagram-label")[at]?.classList.add("map-dim");
      }
    });
    visible.forEach((id, at) => {
      const head = heads(id);
      head.classList.add("map-participant");
      head.tabIndex = 0;
      head.setAttribute("role", "button");
      head.setAttribute("aria-pressed", String(state.selected.has(id)));
      head.title = "この参加者のメッセージを強調する";
      if (state.selected.has(id)) {
        head.classList.add("map-hot");
        lifelines[at]?.classList.add("map-lifeline-hot");
      } else if (state.selected.size) head.classList.add("map-dim");
      const toggle = () => {
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.add(id);
        render();
      };
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
    });

    // メッセージの線のホバー
    const box = figure.querySelector(".mdmark-diagram-box");
    const tip = document.createElement("div");
    tip.className = "map-wire-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    box.append(tip);
    shown.forEach(({ message, index }, at) => {
      const wire = wires[at];
      if (!wire) return;
      const hit = document.createElementNS(SVG_NS, "path");
      hit.setAttribute("d", wire.getAttribute("d"));
      hit.setAttribute("class", "map-wire-hit");
      const ends = [heads(message.from), heads(message.to)].filter(Boolean);
      hit.addEventListener("pointerenter", () => {
        wire.classList.add("map-wire-hover");
        for (const end of ends) end.classList.add("map-wire-end");
        tip.textContent = notes[index + 1] ?? "";
        tip.hidden = tip.textContent === "";
      });
      hit.addEventListener("pointermove", (event) => {
        const rect = box.getBoundingClientRect();
        const x = event.clientX - rect.left + 12;
        const y = event.clientY - rect.top + 12;
        tip.style.left = `${x + tip.offsetWidth > rect.width ? Math.max(0, x - 24 - tip.offsetWidth) : x}px`;
        tip.style.top = `${y + tip.offsetHeight > rect.height ? Math.max(0, y - 24 - tip.offsetHeight) : y}px`;
      });
      hit.addEventListener("pointerleave", () => {
        wire.classList.remove("map-wire-hover");
        for (const end of ends) end.classList.remove("map-wire-end");
        tip.hidden = true;
      });
      svg.append(hit);
      // 構成図の上で再生している今のメッセージ
      if (index === state.current) {
        wire.classList.add("map-flowing");
        for (const end of ends) end.classList.add("map-hot");
        wire.id = `map-seq-packet-${spec.id}`;
        addPackets(svg, wire, { reverse: false });
      }
    });

    // 右上のツール
    const tools = figure.querySelector(".mdmark-diagram-tools");
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    const menuButton = toolButton("users", "参加者", () => {
      state.menuOpen = !state.menuOpen;
      render();
    }, { "aria-expanded": String(state.menuOpen), "aria-controls": `map-participants-${spec.id}` });
    group.append(toolButton("play", "構成図の上で再生", onPlay), menuButton);
    tools.prepend(group);
    if (state.menuOpen) tools.after(participantMenu());

    keepSequenceScale(host);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
  };

  /** 参加者の表示と非表示・並び順を変える一覧。図の右上のツールの下に重ねる */
  const participantMenu = () => {
    const menu = document.createElement("div");
    menu.className = "map-participant-menu";
    menu.id = `map-participants-${spec.id}`;
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", "参加者の表示と並び順");
    state.order.forEach((id, at) => {
      const row = document.createElement("div");
      row.className = "map-participant-row";
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = !state.hidden.has(id);
      check.addEventListener("change", () => {
        if (check.checked) state.hidden.delete(id);
        else state.hidden.add(id);
        state.selected.delete(id);
        render();
      });
      label.append(check, document.createTextNode(labelOf(id)));
      const move = (delta) => {
        const next = [...state.order];
        [next[at], next[at + delta]] = [next[at + delta], next[at]];
        state.order = next;
        render();
      };
      row.append(
        label,
        toolButton("up", `${labelOf(id)}を前へ`, () => move(-1), at === 0 ? { disabled: "" } : {}),
        toolButton("down", `${labelOf(id)}を後ろへ`, () => move(1), at === state.order.length - 1 ? { disabled: "" } : {}),
      );
      menu.append(row);
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        state.menuOpen = false;
        render();
      }
    });
    return menu;
  };

  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selected.size) {
      state.selected.clear();
      render();
    }
  });

  render();
  return {
    /** 構成図の上で再生している今のメッセージの番号（再生していないときは undefined） */
    setCurrent: (index) => {
      if (state.current === index) return;
      state.current = index;
      render();
    },
  };
};
