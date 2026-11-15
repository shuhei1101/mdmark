import type { ResolvedConfig } from "../config.ts";
import { renderMapClassDiagram, spreadMapEnds } from "../parts/map.ts";
import {
  classPartInputs,
  classToFlowchart,
  MAP_CLASS_KINDS,
  parseClassDiagram,
} from "./class-diagram.ts";
import {
  attachMapFlow,
  type MapFlowHandle,
  neighborKept,
  shortestPathKept,
} from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";

/** `classDiagram` を構成図の入力にし、構成図と同じ配置と操作に、メンバーの区画・注釈・関係の端の形と多重度・メンバーの開閉を追加する */
export const attachMapClass = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const diagram = parseClassDiagram(
    range.querySelector("code")?.textContent ?? "",
  );
  const chart = classToFlowchart(diagram);
  const classIds = new Set(diagram.classes.map((item) => item.id));
  const relations = chart.edges.filter((edge) => classIds.has(edge.to));
  /** namespace の中のクラスの数 */
  const classesUnder = (space: string): number =>
    diagram.classes.filter((item) => item.namespace === space).length;
  return attachMapFlow(range, config, {
    args,
    extension: {
      chart,
      kinds: MAP_CLASS_KINDS,
      overrides: ({ collapsed }) =>
        classPartInputs(diagram, collapsed).overrides,
      collapsibles: [...classIds],
      collapsedTag: (space) => `クラス ${classesUnder(space)} 件`,
      rewire: (layout) => spreadMapEnds(layout),
      render: (flowArgs) => {
        const inputs = classPartInputs(diagram, new Set(flowArgs.collapsed));
        return renderMapClassDiagram({
          ...flowArgs,
          classes: inputs.classes,
          ends: inputs.ends,
        });
      },
      // ノートは選ばない
      selectable: (id) => classIds.has(id),
      selectionOf: (selected) => {
        const picked = [...selected].filter((id) => classIds.has(id));
        if (picked.length === 1)
          return neighborKept(relations, picked[0] as string);
        if (picked.length !== 2) return undefined;
        return shortestPathKept(relations, [
          picked[0] as string,
          picked[1] as string,
        ]);
      },
    },
  });
};
