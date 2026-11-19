import type { ResolvedConfig } from "../config.ts";
import type { ResolveIdLink } from "../render/sanitize.ts";
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
import { MAP_LAYOUT } from "./layout.ts";
import { renderMapClassDiagram, spreadMapEnds } from "./map.part.ts";
import type { MapArgs } from "./spec.ts";

/** `classDiagram` を構成図の入力にし、構成図と同じ配置と操作に、メンバーの区画・注釈・関係の端の形と多重度・メンバーの開閉を追加する */
export const attachMapClass = (
  range: HTMLElement,
  config: ResolvedConfig,
  options: { args: MapArgs; resolveIdLink?: ResolveIdLink },
): MapFlowHandle => {
  const { args, resolveIdLink } = options;
  const diagram = parseClassDiagram(
    range.querySelector("code")?.textContent ?? "",
  );
  const chart = classToFlowchart(diagram);
  const classIds = new Set(diagram.classes.map((item) => item.id));
  const relations = chart.edges.filter((edge) => classIds.has(edge.to));
  /** namespace の中のクラスの数 */
  const classesUnder = (space: string): number =>
    diagram.classes.filter((item) => item.namespace === space).length;
  const maxWidth =
    config.map.node_fit === "width"
      ? MAP_LAYOUT.maxWidthWide
      : MAP_LAYOUT.maxWidth;
  /** 最後に配置したときの、補足の layout の幅（描くときも同じ幅でメンバーを折り返す） */
  let widths: Record<string, number> = {};
  return attachMapFlow(range, config, {
    args,
    resolveIdLink,
    extension: {
      chart,
      kinds: MAP_CLASS_KINDS,
      overrides: (view) => {
        widths = view.widths;
        return classPartInputs(diagram, { ...view, maxWidth }).overrides;
      },
      collapsibles: [...classIds],
      collapsedTag: (space) => `クラス ${classesUnder(space)} 件`,
      rewire: (layout) => spreadMapEnds(layout),
      render: (flowArgs) => {
        const inputs = classPartInputs(diagram, {
          collapsed: new Set(flowArgs.collapsed),
          widths,
          maxWidth,
        });
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
