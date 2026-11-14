import type { ResolvedConfig } from "../config.ts";
import { DIAGRAM_REDRAW_EVENT } from "../interact/diagrams.ts";
import {
  type MapErFanout,
  renderMapErDiagram,
  renderMapErFanouts,
  rewireMapEr,
} from "../parts/map.ts";
import { parseMapData } from "./data.ts";
import {
  erColumnNotes,
  erFanouts,
  erOverrides,
  erPartRelations,
  erToFlowchart,
  parseErDiagram,
} from "./er.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";

/** `erDiagram` を構成図の入力にし、構成図と同じ配置と操作に、列の行・関連の端の付け替え・多重度・経路の選択・行が増える関連のマーカーを追加する */
export const attachMapEr = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const er = parseErDiagram(range.querySelector("code")?.textContent ?? "");
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const relations = erPartRelations(er);
  const tables = er.tables.map((table) => ({
    name: table.name,
    columns: table.columns,
    notes: erColumnNotes(table, data.notes),
  }));
  const ends = Object.fromEntries(
    Object.entries(data.layout).flatMap(([id, entry]) =>
      entry.ends === undefined ? [] : [[id, entry.ends]],
    ),
  );
  /** 分類の中のテーブルの数（入れ子の分類の中を含む） */
  const tablesUnder = (group: string): number =>
    er.tables.filter((table) => {
      let at = Object.entries(data.groups).find(([, item]) =>
        item.tables.includes(table.name),
      )?.[0];
      while (at !== undefined) {
        if (at === group) return true;
        at = data.groups[at]?.parent;
      }
      return false;
    }).length;
  const frameId = `map-${range.dataset.map ?? "1"}`;
  let fanouts: MapErFanout[] = [];
  return attachMapFlow(range, config, {
    args,
    extension: {
      chart: erToFlowchart(er, data.groups),
      overrides: ({ collapsed }) => erOverrides(er, collapsed),
      collapsibles: er.tables.map((table) => table.name),
      collapsedTag: (group) => `テーブル ${tablesUnder(group)} 件`,
      rewire: (layout, view) =>
        rewireMapEr({
          layout,
          tables,
          relations,
          collapsed: view.collapsed,
          ends,
        }),
      render: (flowArgs) =>
        renderMapErDiagram({ ...flowArgs, tables, relations, fanouts: [] }),
      selectionOf: (selected) => {
        fanouts = [];
        const picked = [...selected];
        if (picked.length === 1) {
          const only = picked[0] as string;
          const near = er.relations.filter(
            (item) => item.from === only || item.to === only,
          );
          return {
            nodes: new Set([
              only,
              ...near.flatMap((item) => [item.from, item.to]),
            ]),
            wires: new Set(near.map((item) => item.id)),
          };
        }
        if (picked.length !== 2) return undefined;
        const path = erFanouts(
          er.relations,
          picked[0] as string,
          picked[1] as string,
        );
        if (!path) return { nodes: new Set(picked), wires: new Set() };
        fanouts = path.fanouts.map((item) => ({
          wire: item.relation,
          from: item.from,
          to: item.to,
        }));
        return { nodes: new Set(path.tables), wires: new Set(path.relations) };
      },
      afterRender: (figure, layout, view) => {
        const stage = figure.querySelector(".mdmark-diagram-stage");
        const box = figure.querySelector(".mdmark-diagram-box");
        if (!stage || !box) return;
        const old = figure.querySelectorAll(
          `.map-er-fanout, .mdmark-diagram-tip[id^="${frameId}-fanout-tip-"]`,
        );
        for (const element of old) element.remove();
        if (view.selected.size !== 2) fanouts = [];
        const part = renderMapErFanouts({ layout, fanouts, id: frameId });
        stage.insertAdjacentHTML("beforeend", part.html);
        box.insertAdjacentHTML("beforeend", part.tips);
        // 図のツールチップを、追加・削除したマーカーの説明に付け替える
        if (old.length > 0 || fanouts.length > 0)
          figure.dispatchEvent(new Event(DIAGRAM_REDRAW_EVENT));
      },
    },
  });
};
