// map の図のモック: PoC の自動配置で構成図を配置し、図の枠の中で中へ入る・開閉・ノードのページ・
// まとめた線の一覧・視点・巡回・シーケンスの再生を切り替える。実装の mount が描く構造の案

import { layoutMap, parseFlowchart, parseSequence } from "./map-layout.js";

/** 線の矢じりと、再生の印の大きさ（px） */
const ARROW = 8;
const PLAY_DOT = 6;
/** 全体が収まる倍率の下限。押す部品の 32px が 24px を下回らない */
const MIN_FIT_SCALE = 0.75;
/** 再生で 1 通のメッセージを動かす時間（ms） */
const PLAY_STEP_MS = 900;

const SVG_NS = "http://www.w3.org/2000/svg";

/** 種類のクラスの表示名 */
const KIND_LABELS = { llm: "LLM", script: "処理", data: "データ", external: "外部", mcp: "MCP" };

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
};

const svg = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

/**
 * map の図を 1 つ作る。
 * spec: { title, flow, data: { notes, relations, walkthroughs, links }, sequence?: { title, source } }
 * initial: { enter, collapsed, view, node, step, play, edgeList, dimmed }
 */
export const createMap = (spec, initial = {}) => {
  const chart = parseFlowchart(spec.flow);
  const sequence = spec.sequence ? parseSequence(spec.sequence.source) : undefined;
  const state = {
    path: initial.enter ? [initial.enter] : [],
    collapsed: new Set(initial.collapsed ?? []),
    view: initial.view ?? "",
    node: initial.node,
    step: initial.step,
    play: initial.play,
    edgeList: initial.edgeList,
  };
  const startState = { path: [], view: "" };
  const nodeById = new Map(chart.nodes.map((node) => [node.id, node]));
  const boxById = new Map(chart.boxes.map((box) => [box.id, box]));
  const relationEdges = (name) => {
    const pairs = spec.data.relations?.[name] ?? [];
    return chart.edges.filter((edge) => pairs.some((pair) => pair.from === edge.from && pair.to === edge.to)).map((edge) => edge.id);
  };
  const labelOf = (id) => nodeById.get(id)?.label ?? boxById.get(id)?.title ?? id;

  const frame = el("figure", { class: "map-frame" });
  const bar = el("div", { class: "map-bar" });
  const crumbs = el("nav", { class: "map-crumbs", "aria-label": "図の現在地" });
  const view = el("div", { class: "map-view", tabindex: "0", role: "group", "aria-label": `${spec.title}の図` });
  const band = el("div", { class: "map-band", hidden: true });
  const legend = el("div", { class: "map-legend" });
  frame.append(bar, crumbs, view, band, legend);

  const highlighted = () => {
    if (state.step !== undefined) return new Set(spec.data.walkthroughs[state.step].highlight ?? []);
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      return new Set([message.from, message.to]);
    }
    return undefined;
  };

  const renderBar = () => {
    bar.replaceChildren();
    bar.append(el("figcaption", { class: "map-title", text: spec.title }));
    const names = Object.keys(spec.data.relations ?? {});
    if (names.length > 0) {
      const group = el("div", { class: "map-segment", role: "radiogroup", "aria-label": "視点" });
      for (const name of ["", ...names]) {
        const checked = state.view === name;
        group.append(
          el("button", {
            type: "button",
            role: "radio",
            "aria-checked": checked ? "true" : "false",
            tabindex: checked ? "0" : "-1",
            class: "map-segment-item",
            text: name === "" ? "全ての線" : name,
            onclick: () => {
              state.view = name;
              state.node = undefined;
              render();
            },
          }),
        );
      }
      bar.append(group);
    }
    const tools = el("div", { class: "map-tools" });
    if (spec.data.walkthroughs?.length) {
      tools.append(
        el("button", {
          type: "button",
          class: "map-button",
          "aria-pressed": state.step !== undefined ? "true" : "false",
          text: "案内",
          onclick: () => {
            if (state.step === undefined) {
              startState.path = [...state.path];
              startState.view = state.view;
              applyStep(0);
            } else endWalkthrough();
          },
        }),
      );
    }
    for (const [label, icon] of [["縮小", "−"], ["倍率を戻す", "100%"], ["拡大", "+"]]) {
      tools.append(el("button", { type: "button", class: "map-icon-button", "aria-label": label, title: label, text: icon }));
    }
    bar.append(tools);
  };

  const renderCrumbs = () => {
    crumbs.replaceChildren();
    const items = [{ label: "全体", path: [] }];
    state.path.forEach((id, index) => items.push({ label: labelOf(id), path: state.path.slice(0, index + 1) }));
    if (state.node) items.push({ label: labelOf(state.node), node: true });
    crumbs.hidden = items.length === 1;
    const list = el("ol");
    items.forEach((item, index) => {
      const last = index === items.length - 1;
      list.append(
        el("li", {}, [
          last
            ? el("span", { "aria-current": "location", text: item.label })
            : el("button", {
                type: "button",
                class: "map-crumb",
                text: item.label,
                onclick: () => {
                  state.node = undefined;
                  state.path = item.path;
                  render();
                },
              }),
        ]),
      );
    });
    crumbs.append(list);
  };

  const legendItems = () => {
    const kinds = new Set(chart.nodes.flatMap((node) => node.classes).filter((cls) => KIND_LABELS[cls]));
    const lines = new Set(chart.edges.map((edge) => edge.line));
    const items = [];
    if (kinds.size >= 2) for (const kind of kinds) items.push(el("span", { class: `map-legend-item map-kind-${kind}` }, [el("span", { class: "map-legend-swatch" }), KIND_LABELS[kind]]));
    if (lines.size >= 2) for (const line of lines) items.push(el("span", { class: `map-legend-item map-line-${line}` }, [el("span", { class: "map-legend-line" }), { solid: "呼び出し", dotted: "通知", thick: "書き込み" }[line]]));
    return items;
  };

  const renderDiagram = () => {
    const enter = state.path.at(-1);
    const edges = state.view ? relationEdges(state.view) : undefined;
    const layout = layoutMap(chart, { enter, collapsed: [...state.collapsed], edges }, spec.data.layout ?? {});
    const stage = el("div", { class: "map-stage", style: `width:${layout.width}px;height:${layout.height}px` });
    const lines = svg("svg", { class: "map-lines", width: layout.width, height: layout.height, "aria-hidden": "true" });
    const defs = svg("defs");
    const marker = svg("marker", { id: `map-arrow-${frame.dataset.mapId}`, viewBox: `0 0 ${ARROW} ${ARROW}`, refX: ARROW, refY: ARROW / 2, markerWidth: ARROW, markerHeight: ARROW, orient: "auto-start-reverse" });
    marker.append(svg("path", { d: `M0,0 L${ARROW},${ARROW / 2} L0,${ARROW} z`, class: "map-arrowhead" }));
    defs.append(marker);
    lines.append(defs);
    const hot = highlighted();
    for (const box of layout.boxes) {
      const info = boxById.get(box.id);
      const head = el("div", { class: "map-group-head" }, [
        el("button", {
          type: "button",
          class: "map-group-title",
          text: info?.title ?? box.id,
          title: "ダブルクリックか Enter で中へ入る",
          ondblclick: () => enterGroup(box.id),
          onkeydown: (event) => {
            if (event.key === "Enter") enterGroup(box.id);
          },
        }),
        el("button", {
          type: "button",
          class: "map-icon-button map-toggle",
          "aria-expanded": "true",
          "aria-label": `${info?.title ?? box.id}を閉じる`,
          title: "閉じる",
          text: "−",
          onclick: () => {
            state.collapsed.add(box.id);
            render();
          },
        }),
      ]);
      stage.append(el("div", { class: "map-group", style: `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px` }, [head]));
    }
    for (const edge of layout.edges) {
      const source = chart.edges.find((item) => item.id === edge.id);
      const cls = ["map-line", `map-line-${source?.line ?? "solid"}`];
      if (hot && !(hot.has(edge.from) && hot.has(edge.to))) cls.push("is-dim");
      lines.append(svg("polyline", { points: edge.points.map((point) => point.join(",")).join(" "), class: cls.join(" "), "marker-end": `url(#map-arrow-${frame.dataset.mapId})`, "data-edge": edge.id, "data-from": edge.from, "data-to": edge.to }));
      // ラベルと件数は、いちばん長い区間の中点に置く（角に置くとノードに重なる）
      const mid = longestMid(edge.points);
      if (edge.count > 1) {
        stage.append(
          el("button", {
            type: "button",
            class: "map-edge-count",
            style: `left:${mid[0]}px;top:${mid[1]}px`,
            "aria-label": `まとめた線 ${edge.count} 本の一覧`,
            "aria-expanded": state.edgeList === edge.id ? "true" : "false",
            text: String(edge.count),
            onclick: () => {
              state.edgeList = state.edgeList === edge.id ? undefined : edge.id;
              render();
            },
          }),
        );
      } else if (source?.label) {
        stage.append(el("span", { class: "map-edge-label", style: `left:${mid[0]}px;top:${mid[1]}px`, text: source.label }));
      }
    }
    for (const leaf of layout.leaves) {
      const node = nodeById.get(leaf.id);
      const box = boxById.get(leaf.id);
      const kind = node?.classes.find((cls) => KIND_LABELS[cls]);
      const cls = ["map-node"];
      if (kind) cls.push(`map-kind-${kind}`);
      if (leaf.faded) cls.push("is-faded");
      if (box && !leaf.faded) cls.push("is-collapsed");
      if (hot?.has(leaf.id)) cls.push("is-hot");
      else if (hot) cls.push("is-dim");
      const note = spec.data.notes?.[leaf.id];
      const button = el(
        "button",
        {
          type: "button",
          class: cls.join(" "),
          style: `left:${leaf.x}px;top:${leaf.y}px;width:${leaf.w}px;height:${leaf.h}px`,
          "data-node": leaf.id,
          onclick: () => {
            if (box) {
              state.collapsed.delete(leaf.id);
            } else if (!leaf.faded) {
              state.node = leaf.id;
            }
            render();
          },
        },
        [
          el("span", { class: "map-node-kind", text: box && !leaf.faded ? "閉じたグループ" : kind ? KIND_LABELS[kind] : "" }),
          el("span", { class: "map-node-name", text: leaf.lines.join("\n") }),
          note ? el("span", { class: "map-node-hint", "aria-label": `説明: ${note}`, title: note, text: "i" }) : undefined,
        ],
      );
      if (box && !leaf.faded) button.setAttribute("aria-label", `${box.title}（${leaf.lines.join("")}）を開く`);
      stage.append(button);
    }
    stage.prepend(lines);
    if (state.edgeList) {
      const edge = layout.edges.find((item) => item.id === state.edgeList);
      if (edge) {
        // まとめた線の元の線: 端を閉じたグループへ読み替えると、この線の両端になる線
        const visible = (id) => [...state.collapsed].find((closed) => isUnder(id, closed)) ?? id;
        const members = chart.edges.filter((item) => visible(item.from) === edge.from && visible(item.to) === edge.to);
        const mid = longestMid(edge.points);
        const list = el("ul");
        for (const member of members) {
          list.append(
            el("li", {}, [
              el("button", {
                type: "button",
                text: `${labelOf(member.from)} → ${labelOf(member.to)}${member.label ? `（${member.label}）` : ""}`,
                onclick: () => {
                  state.edgeList = undefined;
                  state.node = member.from;
                  render();
                },
              }),
            ]),
          );
        }
        const listLeft = Math.max(8, Math.min(mid[0] - 120, layout.width - 288));
        stage.append(el("div", { class: "map-edge-list", role: "dialog", "aria-label": "まとめた線の一覧", style: `left:${listLeft}px;top:${mid[1] + 18}px` }, [el("p", { class: "map-edge-list-title", text: `まとめた線 ${members.length} 本` }), list]));
      }
    }
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const edge = layout.edges.find((item) => item.from === message.from && item.to === message.to) ?? layout.edges.find((item) => item.from === message.to && item.to === message.from);
      if (edge) {
        const points = message.reply && edge.from !== message.from ? [...edge.points].reverse() : edge.points;
        const dot = svg("circle", { r: PLAY_DOT, class: "map-play-dot", cx: points[0][0], cy: points[0][1] });
        lines.append(dot);
        animateAlong(dot, points);
      }
    }
    return stage;
  };

  const longestMid = (points) => {
    let best = [points[0], points[0]];
    let bestLength = -1;
    points.slice(1).forEach((point, index) => {
      const length = Math.hypot(point[0] - points[index][0], point[1] - points[index][1]);
      if (length > bestLength) {
        bestLength = length;
        best = [points[index], point];
      }
    });
    return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
  };

  const isUnder = (id, ancestor) => {
    if (id === ancestor) return true;
    let parent = nodeById.get(id)?.parent ?? boxById.get(id)?.parent;
    while (parent) {
      if (parent === ancestor) return true;
      parent = boxById.get(parent)?.parent;
    }
    return false;
  };

  const animateAlong = (dot, points) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || frame.dataset.paused === "true") {
      const end = points.at(-1);
      dot.setAttribute("cx", end[0]);
      dot.setAttribute("cy", end[1]);
      return;
    }
    const lengths = points.slice(1).map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
    const total = lengths.reduce((sum, value) => sum + value, 0);
    const start = performance.now();
    const tick = (now) => {
      if (!dot.isConnected) return;
      let left = Math.min(1, (now - start) / PLAY_STEP_MS) * total;
      let index = 0;
      while (index < lengths.length - 1 && left > lengths[index]) left -= lengths[index++];
      const from = points[index];
      const to = points[index + 1];
      const ratio = lengths[index] === 0 ? 0 : left / lengths[index];
      dot.setAttribute("cx", from[0] + (to[0] - from[0]) * ratio);
      dot.setAttribute("cy", from[1] + (to[1] - from[1]) * ratio);
      if (now - start < PLAY_STEP_MS) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const renderNodePage = () => {
    const id = state.node;
    const incoming = chart.edges.filter((edge) => edge.to === id);
    const outgoing = chart.edges.filter((edge) => edge.from === id);
    const perspectives = Object.entries(spec.data.relations ?? {}).filter(([, pairs]) => pairs.some((pair) => pair.from === id || pair.to === id)).map(([name]) => name);
    const sequences = sequence && sequence.participants.some((participant) => participant.id === id) ? [spec.sequence.title] : [];
    const links = spec.data.links?.[id] ?? [];
    const partner = (edge, other) =>
      el("li", {}, [
        el("button", {
          type: "button",
          class: "map-link",
          text: labelOf(other),
          onclick: () => {
            state.node = other;
            render();
          },
        }),
        edge.label ? el("span", { class: "map-page-sub", text: edge.label }) : undefined,
      ]);
    const section = (title, items, empty) =>
      el("section", { class: "map-page-section" }, [
        el("p", { class: "map-page-heading", text: title }),
        items.length ? el("ul", {}, items) : el("p", { class: "map-page-empty", text: empty }),
      ]);
    const note = spec.data.notes?.[id];
    return el("article", { class: "map-page", "aria-labelledby": `map-page-title-${frame.dataset.mapId}` }, [
      el("p", { id: `map-page-title-${frame.dataset.mapId}`, class: "map-page-title", text: labelOf(id) }),
      note ? el("p", { class: "map-page-note", text: note }) : undefined,
      el("div", { class: "map-page-grid" }, [
        section("入る線", incoming.map((edge) => partner(edge, edge.from)), "入る線はありません"),
        section("出る線", outgoing.map((edge) => partner(edge, edge.to)), "出る線はありません"),
        section(
          "出てくる視点",
          perspectives.map((name) =>
            el("li", {}, [
              el("button", {
                type: "button",
                class: "map-link",
                text: name,
                onclick: () => {
                  state.view = name;
                  state.node = undefined;
                  render();
                },
              }),
            ]),
          ),
          "出てくる視点はありません",
        ),
        section(
          "出てくるシーケンス",
          sequences.map((title) => el("li", {}, [el("button", { type: "button", class: "map-link", text: title, onclick: () => startPlay() })])),
          "出てくるシーケンスはありません",
        ),
        section("リンク先の図", links.map((title) => el("li", {}, [el("a", { class: "map-link", href: "#", text: title })])), "リンク先の図はありません"),
      ]),
    ]);
  };

  const renderBand = () => {
    band.replaceChildren();
    if (state.step !== undefined) {
      const steps = spec.data.walkthroughs;
      const step = steps[state.step];
      band.hidden = false;
      band.setAttribute("role", "region");
      band.setAttribute("aria-label", "案内");
      band.onkeydown = (event) => {
        if (event.key === "ArrowRight" && state.step < steps.length - 1) applyStep(state.step + 1);
        if (event.key === "ArrowLeft" && state.step > 0) applyStep(state.step - 1);
      };
      band.append(
        el("p", { class: "map-band-count", text: `${state.step + 1} / ${steps.length}` }),
        el("p", { class: "map-band-text", "aria-live": "polite", text: step.text }),
        el("div", { class: "map-band-actions" }, [
          el("button", { type: "button", class: "map-button", text: "最初から", onclick: () => applyStep(0) }),
          el("button", { type: "button", class: "map-button", text: "前へ", disabled: state.step === 0, onclick: () => applyStep(state.step - 1) }),
          el("button", { type: "button", class: "map-button is-primary", text: "次へ", disabled: state.step === steps.length - 1, onclick: () => applyStep(state.step + 1) }),
          el("button", { type: "button", class: "map-button", text: "巡回を終える", onclick: () => endWalkthrough() }),
        ]),
      );
      return;
    }
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const total = sequence.messages.length;
      const paused = frame.dataset.paused === "true";
      band.hidden = false;
      band.setAttribute("role", "region");
      band.setAttribute("aria-label", "シーケンスの再生");
      band.append(
        el("p", { class: "map-band-count", text: `${state.play + 1} / ${total}` }),
        el("p", { class: "map-band-text", "aria-live": "polite", text: `${labelOf(message.from)} → ${labelOf(message.to)}: ${message.text}` }),
        el("div", { class: "map-band-actions" }, [
          el("button", { type: "button", class: "map-button", text: "前へ", disabled: state.play === 0, onclick: () => playAt(state.play - 1) }),
          el("button", {
            type: "button",
            class: "map-button",
            text: paused ? "再生" : "一時停止",
            onclick: () => {
              frame.dataset.paused = paused ? "false" : "true";
              render();
            },
          }),
          el("button", { type: "button", class: "map-button is-primary", text: "次へ", disabled: state.play === total - 1, onclick: () => playAt(state.play + 1) }),
          el("button", { type: "button", class: "map-button", text: "再生を終える", onclick: () => endPlay() }),
        ]),
      );
      return;
    }
    band.hidden = true;
    band.removeAttribute("role");
  };

  const enterGroup = (id) => {
    state.node = undefined;
    state.path = [...state.path, id];
    render();
  };

  const applyStep = (index) => {
    const step = spec.data.walkthroughs[index];
    state.step = index;
    state.view = step.view ?? "";
    state.path = step.enter ? [step.enter] : [];
    state.node = undefined;
    render();
  };

  const endWalkthrough = () => {
    state.step = undefined;
    state.path = startState.path;
    state.view = startState.view;
    render();
  };

  const startPlay = () => {
    startState.path = [...state.path];
    startState.view = state.view;
    state.node = undefined;
    playAt(0);
  };

  const playAt = (index) => {
    state.play = index;
    render();
  };

  const endPlay = () => {
    state.play = undefined;
    state.path = startState.path;
    state.view = startState.view;
    render();
  };

  frame.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.edgeList) state.edgeList = undefined;
    else if (state.node) state.node = undefined;
    else if (state.path.length > 0) state.path = state.path.slice(0, -1);
    else return;
    event.stopPropagation();
    render();
  });

  const render = () => {
    renderBar();
    renderCrumbs();
    if (state.node) {
      view.replaceChildren(renderNodePage());
    } else {
      const stage = renderDiagram();
      const fit = el("div", { class: "map-fit" }, [stage]);
      view.replaceChildren(fit);
      applyFit();
    }
    renderBand();
    legend.replaceChildren(...legendItems());
    legend.hidden = legend.childElementCount === 0;
  };

  // 全体が収まる倍率で開く（拡大はしない）。表示する枠の幅が変わるたびに倍率を決め直す
  const applyFit = () => {
    const fit = view.querySelector(".map-fit");
    const stage = fit?.firstElementChild;
    if (!stage || view.clientWidth === 0) return;
    const width = parseFloat(stage.style.width);
    const height = parseFloat(stage.style.height);
    const scale = Math.max(MIN_FIT_SCALE, Math.min(1, view.clientWidth / width));
    stage.style.transform = `scale(${scale})`;
    stage.style.transformOrigin = "0 0";
    fit.style.width = `${width * scale}px`;
    fit.style.height = `${height * scale}px`;
  };
  new ResizeObserver(applyFit).observe(view);

  frame.dataset.mapId = Math.random().toString(36).slice(2, 8);
  if (initial.paused) frame.dataset.paused = "true";
  render();
  return { frame, startPlay };
};

/** シーケンス図の map の図: 相手を左から右、メッセージを上から下に並べ、構成図の上で再生するボタンを持つ */
export const createSequence = (spec, onPlay) => {
  const sequence = parseSequence(spec.source);
  const columnWidth = 150;
  const rowHeight = 44;
  const top = 56;
  const width = sequence.participants.length * columnWidth;
  const height = top + sequence.messages.length * rowHeight + 24;
  const frame = el("figure", { class: "map-frame" });
  frame.append(
    el("div", { class: "map-bar" }, [
      el("figcaption", { class: "map-title", text: spec.title }),
      el("div", { class: "map-tools" }, [el("button", { type: "button", class: "map-button", text: "構成図の上で再生", onclick: onPlay })]),
    ]),
  );
  const stage = el("div", { class: "map-stage", style: `width:${width}px;height:${height}px` });
  const lines = svg("svg", { class: "map-lines", width, height, "aria-hidden": "true" });
  const x = (id) => sequence.participants.findIndex((participant) => participant.id === id) * columnWidth + columnWidth / 2;
  sequence.participants.forEach((participant) => {
    stage.append(el("span", { class: `map-node map-seq-head${participant.actor ? " map-kind-external" : ""}`, style: `left:${x(participant.id) - 60}px;top:8px;width:120px;height:36px` }, [el("span", { class: "map-node-name", text: participant.label })]));
    lines.append(svg("line", { x1: x(participant.id), y1: 44, x2: x(participant.id), y2: height - 8, class: "map-lifeline" }));
  });
  sequence.messages.forEach((message, index) => {
    const y = top + index * rowHeight + 20;
    lines.append(svg("line", { x1: x(message.from), y1: y, x2: x(message.to), y2: y, class: `map-line ${message.reply ? "map-line-dotted" : "map-line-solid"}` }));
    stage.append(el("span", { class: "map-edge-label", style: `left:${(x(message.from) + x(message.to)) / 2}px;top:${y - 12}px`, text: message.text }));
  });
  stage.prepend(lines);
  frame.append(el("div", { class: "map-view", tabindex: "0", role: "group", "aria-label": `${spec.title}の図` }, [stage]));
  return frame;
};
