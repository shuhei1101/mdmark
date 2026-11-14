import type { ResolvedConfig } from "../config.ts";
import {
  mapStateLoopDim,
  renderMapStateDiagram,
  renderMapStateLoops,
} from "../parts/map.ts";
import { type MapStep, parseMapData } from "./data.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";
import {
  parseStateDiagram,
  statePartInputs,
  stateToFlowchart,
} from "./state-diagram.ts";

/** 開始・終了の、読み上げる名前 */
const POINT_NAMES = { start: "開始", end: "終了" } as const;

/** `stateDiagram-v2`・`stateDiagram` を構成図の入力にし、構成図と同じ配置と操作に、開始・終了・分岐の形状・同じ状態への遷移・注記・遷移の再生を追加する */
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
  const { chart, loops: selfLoops } = stateToFlowchart(diagram);
  const kinds = new Map(
    chart.nodes.map((node) => [node.id, node.classes[0] ?? "state"]),
  );
  const { shapes, loops, overrides } = statePartInputs(chart, selfLoops);
  const nameOf = (id: string): string => {
    const kind = kinds.get(id);
    if (kind === "start" || kind === "end") return POINT_NAMES[kind];
    return chart.nodes.find((node) => node.id === id)?.label ?? id;
  };
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
    overrides: () => overrides,
    walkthroughs,
    bandMode: walkthroughs === undefined ? "walkthrough" : "playback",
    ...(walkthroughs === undefined ? {} : { bandUnit: "transition" as const }),
    collapsedTag: (group) =>
      composites.has(group) ? `状態 ${statesUnder(group)} 件` : undefined,
    render: (flowArgs) => renderMapStateDiagram({ ...flowArgs, shapes, loops }),
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
      const old = figure.querySelector(".map-state-loops");
      if (!old) return;
      const step =
        view.step === undefined ? undefined : walkthroughs?.[view.step];
      const focus = step === undefined ? undefined : new Set(step.edges ?? []);
      old.outerHTML = renderMapStateLoops({
        layout,
        loops,
        active: focus ?? new Set(),
        dim: mapStateLoopDim({ loops, selected: view.selected, focus }),
      });
    },
  });
};
