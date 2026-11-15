import type { ResolvedConfig } from "../config.ts";
import { renderMapC4Diagram, spreadMapEnds } from "../parts/map.ts";
import { c4ToFlowchart, MAP_C4_KINDS, parseC4Context } from "./c4.ts";
import {
  attachMapFlow,
  type MapFlowHandle,
  shortestPathKept,
} from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";

/** `C4Context` を構成図の入力にし、構成図と同じ配置と操作に、要素の説明・境界の破線の枠と種類・外部の要素の描き分けを追加する */
export const attachMapC4 = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const diagram = parseC4Context(
    range.querySelector("code")?.textContent ?? "",
  );
  const { chart, overrides } = c4ToFlowchart(diagram);
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
      kinds: MAP_C4_KINDS,
      title: diagram.title,
      overrides: () => overrides,
      collapsedTag: (boundary) => `要素 ${elementsUnder(boundary)} 件`,
      rewire: (layout) => spreadMapEnds(layout),
      render: (flowArgs) =>
        renderMapC4Diagram({ ...flowArgs, descriptions, boundaries }),
      selectionOf: (selected) => {
        const picked = [...selected];
        if (picked.length !== 2) return undefined;
        return shortestPathKept(chart.edges, [
          picked[0] as string,
          picked[1] as string,
        ]);
      },
    },
  });
};
