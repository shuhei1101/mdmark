import type { ResolvedConfig } from "../config.ts";
import { type C4Diagram, c4ToFlowchart, MAP_C4_KINDS, parseC4 } from "./c4.ts";
import { type MapNote, type MapStep, parseMapData } from "./data.ts";
import {
  attachMapFlow,
  type MapFlowHandle,
  neighborKept,
  shortestPathKept,
} from "./flow-view.ts";
import type { Flowchart } from "./flowchart.ts";
import { renderMapC4Diagram, spreadMapEnds } from "./map.part.ts";
import type { MapArgs } from "./spec.ts";

/** 再生している関係のために出したラベルと、隠したラベルの印 */
const PLAYING_LABEL = "map-c4-playing-label";
const HIDDEN_BY_PLAYING = "data-c4-hidden-by-playing";

/** `C4Dynamic` の線にした関係を、番号の順に 1 本ずつ進める再生の手順にする */
const relationSteps = (
  diagram: C4Diagram,
  chart: Flowchart,
  notes: Record<string, MapNote>,
): MapStep[] => {
  const names = new Map<string, string>([
    ...diagram.elements.map((item) => [item.id, item.label] as const),
    ...diagram.boundaries.map((item) => [item.id, item.label] as const),
  ]);
  const drawn = new Set(chart.edges.map((edge) => edge.id));
  return diagram.relations
    .filter((relation) => drawn.has(relation.id))
    .map((relation) => ({
      title: `${relation.index ?? ""}: ${names.get(relation.from) ?? relation.from} ${relation.both ? "↔" : "→"} ${names.get(relation.to) ?? relation.to}${relation.label === undefined ? "" : `：${relation.label}`}`,
      text: notes[relation.id]?.text ?? "",
      nodes: [relation.from, relation.to],
      edges: [relation.id],
      enter: undefined,
    }));
};

/** 再生のために出したラベルを外し、隠したラベルを戻す */
const clearPlayingLabel = (figure: HTMLElement) => {
  for (const item of figure.querySelectorAll(`.${PLAYING_LABEL}`))
    item.remove();
  for (const item of figure.querySelectorAll<HTMLElement>(
    `[${HIDDEN_BY_PLAYING}]`,
  )) {
    item.hidden = false;
    item.removeAttribute(HIDDEN_BY_PLAYING);
  }
};

/** 強調している線のうち、ラベルが描かれていない線（無ければ undefined） */
const unlabeledWireOf = (figure: HTMLElement): SVGPathElement | undefined => {
  const wire = figure.querySelector<SVGPathElement>(
    ".mdmark-diagram-wire[data-wire]:not(.map-dim)",
  );
  const id = wire?.getAttribute("data-wire") ?? "";
  if (!wire || id === "") return undefined;
  const labeled = figure.querySelector(
    `.mdmark-diagram-label[data-wire="${CSS.escape(id)}"]`,
  );
  return labeled ? undefined : wire;
};

/** 矩形と重なる薄くしたラベルを隠す */
const hideOverlapped = (figure: HTMLElement, box: DOMRect) => {
  for (const other of figure.querySelectorAll<HTMLElement>(
    ".mdmark-diagram-label.map-dim",
  )) {
    const rect = other.getBoundingClientRect();
    const apart =
      rect.right < box.left ||
      rect.left > box.right ||
      rect.bottom < box.top ||
      rect.top > box.bottom;
    if (apart) continue;
    other.hidden = true;
    other.setAttribute(HIDDEN_BY_PLAYING, "");
  }
};

/** 再生している関係の線のラベルが描かれていなければ、線の中ほどに出し、重なる薄くしたラベルを隠す */
const showPlayingLabel = (figure: HTMLElement, label: string | undefined) => {
  clearPlayingLabel(figure);
  if (label === undefined) return;
  const wire = unlabeledWireOf(figure);
  const stage = figure.querySelector(".mdmark-diagram-stage");
  if (!wire || !stage) return;
  const point = wire.getPointAtLength(wire.getTotalLength() / 2);
  const shown = document.createElement("span");
  shown.className = `mdmark-diagram-label ${PLAYING_LABEL}`;
  shown.dataset.wire = wire.getAttribute("data-wire") ?? "";
  shown.textContent = label;
  shown.style.left = `${point.x}px`;
  shown.style.top = `${point.y}px`;
  stage.append(shown);
  hideOverlapped(figure, shown.getBoundingClientRect());
};

/** C4 の 5 種類の図を構成図の入力にし、構成図と同じ配置と操作に、要素の説明・境界の破線の枠と種類・外部の要素の描き分けと、`C4Dynamic` の関係の再生を追加する */
export const attachMapC4 = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const diagram = parseC4(range.querySelector("code")?.textContent ?? "");
  const { chart, overrides, reversed, kinds } = c4ToFlowchart(diagram);
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const playback =
    diagram.kind === "C4Dynamic" && data.walkthroughs.length === 0
      ? relationSteps(diagram, chart, data.notes)
      : undefined;
  const labels = new Map(chart.edges.map((edge) => [edge.id, edge.label]));
  const externals = diagram.elements
    .filter((element) => element.external)
    .map((element) => element.id);
  const descriptions = Object.fromEntries(
    diagram.elements.map((element) => [element.id, element.description ?? ""]),
  );
  const boundaries = Object.fromEntries(
    diagram.boundaries.map((boundary) => [boundary.id, boundary.kind]),
  );
  /** 境界の中の要素の数（入れ子の境界の中を含む） */
  const elementsUnder = (boundary: string): number =>
    diagram.elements.filter((element) => {
      for (
        let at = element.parent;
        at !== undefined;
        at = diagram.boundaries.find((item) => item.id === at)?.parent
      )
        if (at === boundary) return true;
      return false;
    }).length;
  return attachMapFlow(range, config, {
    args,
    extension: {
      chart,
      kinds: { ...MAP_C4_KINDS, ...kinds },
      title: diagram.title,
      overrides: () => overrides,
      collapsedTag: (boundary) => `要素 ${elementsUnder(boundary)} 件`,
      ...(playback === undefined
        ? {}
        : {
            walkthroughs: playback,
            bandMode: "playback" as const,
            bandUnit: "relation" as const,
            afterRender: (figure, _layout, view) => {
              const edge =
                view.step === undefined
                  ? undefined
                  : playback[view.step]?.edges?.[0];
              showPlayingLabel(
                figure,
                edge === undefined ? undefined : labels.get(edge),
              );
            },
          }),
      rewire: (layout) => spreadMapEnds(layout),
      render: (flowArgs) =>
        renderMapC4Diagram({
          ...flowArgs,
          descriptions,
          boundaries,
          externals,
          reversed,
        }),
      selectionOf: (selected) => {
        const picked = [...selected];
        if (picked.length === 1)
          return neighborKept(chart.edges, picked[0] as string);
        if (picked.length !== 2) return undefined;
        return shortestPathKept(chart.edges, [
          picked[0] as string,
          picked[1] as string,
        ]);
      },
    },
  });
};
