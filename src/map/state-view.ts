import type { ResolvedConfig } from "../config.ts";
import { renderMapState } from "../parts/map.ts";
import { type MapStep, parseMapData } from "./data.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import type { MapOverride } from "./layout.ts";
import type { MapArgs } from "./spec.ts";
import {
  parseStateDiagram,
  STATE_NOTE_CLASS,
  type StateKind,
  stateToFlowchart,
} from "./state-diagram.ts";

/** 開始・終了のノードの幅（px） */
const POINT_WIDTH = 32;
/** 分岐のノードの幅（px） */
const CHOICE_WIDTH = 40;
/** 形状と、読み上げる名前 */
const SHAPE_NAMES: Partial<Record<StateKind, string>> = {
  start: "開始",
  end: "終了",
  choice: "分岐",
};

/** `stateDiagram-v2`・`stateDiagram` を構成図の入力にし、構成図と同じ配置と操作に、開始・終了・分岐の形状・同じ状態への遷移・注記・遷移の再生を足す */
export const attachMapState = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const diagram = parseStateDiagram(
    range.querySelector("code")?.textContent ?? "",
  );
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const { chart, loops } = stateToFlowchart(diagram);
  const kinds = new Map(
    chart.nodes.map((node) => [node.id, node.classes[0] ?? "state"]),
  );
  const nameOf = (id: string): string => {
    const kind = kinds.get(id);
    if (kind === "start" || kind === "end") return SHAPE_NAMES[kind] as string;
    return chart.nodes.find((node) => node.id === id)?.label ?? id;
  };
  const overrides: Record<string, MapOverride> = Object.fromEntries(
    chart.nodes.flatMap((node) =>
      node.classes[0] === "start" || node.classes[0] === "end"
        ? [[node.id, { width: POINT_WIDTH }]]
        : node.classes[0] === "choice"
          ? [[node.id, { width: CHOICE_WIDTH }]]
          : [],
    ),
  );
  /** 遷移を記載順に 1 本ずつ進める再生の手順（構成図の線に付け替えた端で強調する） */
  const endsOf = new Map(
    chart.edges.map((edge) => [edge.id, [edge.from, edge.to] as const]),
  );
  const playback: MapStep[] = diagram.transitions.map((transition) => {
    const [from, to] = endsOf.get(transition.id) ?? [
      transition.from,
      transition.to,
    ];
    return {
      title: `${nameOf(transition.from)} → ${nameOf(transition.to)}${transition.label === undefined ? "" : `：${transition.label}`}`,
      text: data.notes[transition.id]?.text ?? "",
      nodes: [from, to],
      edges: [transition.id],
      enter: undefined,
    };
  });
  const walkthroughs = data.walkthroughs.length > 0 ? undefined : playback;
  const composites = new Set(diagram.composites.map((item) => item.id));
  const statesUnder = (composite: string): number =>
    diagram.states.filter((state) => {
      if (state.kind !== "state") return false;
      for (
        let at = state.parent;
        at !== undefined;
        at = diagram.composites.find((item) => item.id === at)?.parent
      )
        if (at === composite) return true;
      return false;
    }).length;
  return attachMapFlow(range, config, args, undefined, {
    chart,
    overrides,
    walkthroughs,
    bandMode: walkthroughs === undefined ? "walkthrough" : "playback",
    ...(walkthroughs === undefined ? {} : { bandUnit: "transition" as const }),
    collapsedTag: (group) =>
      composites.has(group) ? `状態 ${statesUnder(group)} 件` : undefined,
    decorateNode: (element, id) => {
      const kind = kinds.get(id);
      if (kind === "start" || kind === "end" || kind === "choice") {
        element.dataset.shape = kind;
        element.removeAttribute("tabindex");
        element.removeAttribute("role");
        element.setAttribute("aria-label", SHAPE_NAMES[kind] as string);
      } else if (kind === STATE_NOTE_CLASS) {
        const head = element.querySelector(".mdmark-diagram-node-kind");
        if (head) {
          head.textContent = "注記";
          head.classList.remove("is-empty");
        }
        element.dataset.shape = "note";
      }
    },
    selectionOf: (selected) => {
      const picked = [...selected].filter((id) => kinds.get(id) === "state");
      if (picked.length !== 1) return undefined;
      const only = picked[0] as string;
      const near = chart.edges.filter(
        (edge) =>
          !edge.id.startsWith("n") && (edge.from === only || edge.to === only),
      );
      return {
        nodes: new Set([only, ...near.flatMap((edge) => [edge.from, edge.to])]),
        wires: new Set(near.map((edge) => edge.id)),
      };
    },
    afterRender: (figure, layout, view) => {
      const svg = figure.querySelector(".mdmark-diagram-stage svg");
      if (!svg) return;
      for (const old of figure.querySelectorAll("[data-loop]")) old.remove();
      const step =
        view.step === undefined ? undefined : walkthroughs?.[view.step];
      for (const loop of loops) {
        const node = layout.nodes.find((item) => item.id === loop.from);
        if (!node) continue;
        const active = step?.edges?.includes(loop.id) === true;
        const dim =
          view.selected.size > 0
            ? !view.selected.has(loop.from)
            : step !== undefined && !active;
        svg.insertAdjacentHTML(
          "beforeend",
          renderMapState({
            wire: loop.id,
            x: node.x,
            y: node.y,
            width: node.w,
            label: loop.label,
            active,
            dim,
          }),
        );
      }
    },
  });
};
