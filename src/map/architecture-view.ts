import type { ResolvedConfig } from "../config.ts";
import { renderMapArchitecture, rewireMapArchitecture } from "../parts/map.ts";
import {
  ARCH_LUCIDE_ICONS,
  architectureToFlowchart,
  MAP_ARCH_KINDS,
  parseArchitecture,
} from "./architecture.ts";
import { parseMapData } from "./data.ts";
import {
  attachMapFlow,
  type MapFlowHandle,
  shortestPathKept,
} from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";

/** `architecture-beta` を構成図の入力にし、構成図と同じ配置と操作に、アイコン・junction の点・辺の指定どおりの線を追加する */
export const attachMapArchitecture = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const diagram = parseArchitecture(
    range.querySelector("code")?.textContent ?? "",
  );
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const { chart, overrides } = architectureToFlowchart(diagram);
  const ends = Object.fromEntries(
    Object.entries(data.layout).flatMap(([id, entry]) =>
      entry.ends === undefined ? [] : [[id, entry.ends]],
    ),
  );
  const junctions = diagram.services
    .filter((service) => service.junction)
    .map((service) => service.id);
  const services = new Set(
    diagram.services
      .filter((service) => !service.junction)
      .map((service) => service.id),
  );
  const groupIcons = Object.fromEntries(
    diagram.groups.flatMap((group) =>
      group.icon === undefined
        ? []
        : [[group.id, ARCH_LUCIDE_ICONS[group.icon]]],
    ),
  );
  /** 構成図の線の向きで見た矢じり（線の元と先を入れ替えた線は、始点と終点を入れ替える） */
  const heads = Object.fromEntries(
    diagram.edges.map((edge) => {
      const swapped =
        chart.edges.find((item) => item.id === edge.id)?.from !== edge.from;
      const head =
        swapped && edge.head === "end"
          ? "start"
          : swapped && edge.head === "start"
            ? "end"
            : edge.head;
      return [edge.id, head];
    }),
  );
  /** group の中の service の数（入れ子の group の中を含む） */
  const servicesUnder = (group: string): number =>
    diagram.services.filter((service) => {
      if (service.junction) return false;
      for (
        let at = service.parent;
        at !== undefined;
        at = diagram.groups.find((item) => item.id === at)?.parent
      )
        if (at === group) return true;
      return false;
    }).length;
  return attachMapFlow(range, config, {
    args,
    extension: {
      chart,
      kinds: MAP_ARCH_KINDS,
      overrides: () => overrides,
      collapsedTag: (group) => `service ${servicesUnder(group)} 件`,
      rewire: (layout, view) =>
        rewireMapArchitecture({
          layout,
          edges: diagram.edges,
          collapsed: view.collapsed,
          ends,
        }),
      render: (flowArgs) =>
        renderMapArchitecture({ ...flowArgs, groupIcons, junctions, heads }),
      // junction は選ばない
      selectable: (id) => services.has(id),
      selectionOf: (selected) => {
        const picked = [...selected].filter((id) => services.has(id));
        if (picked.length !== 2) return undefined;
        return shortestPathKept(chart.edges, [
          picked[0] as string,
          picked[1] as string,
        ]);
      },
    },
  });
};
