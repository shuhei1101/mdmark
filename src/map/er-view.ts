import type { ResolvedConfig } from "../config.ts";
import { DIAGRAM_REDRAW_EVENT } from "../interact/diagrams.ts";
import { renderDiagramTip } from "../parts/diagram.ts";
import { escapeHtml } from "../parts/escape.ts";
import { renderMapEr } from "../parts/map.ts";
import { parseMapData } from "./data.ts";
import {
  type ErFanout,
  type ErTable,
  erColumnFor,
  erFanouts,
  erToFlowchart,
  parseErDiagram,
} from "./er.ts";
import { attachMapFlow, type MapFlowHandle } from "./flow-view.ts";
import type { MapLayout } from "./layout.ts";
import type { MapArgs } from "./spec.ts";

/** ER 図のテーブルのノードの幅（px） */
const TABLE_WIDTH = 240;
/** 関連の端の、ノードの辺から外へ出す長さ（px） */
const END_OUT = 14;
/** 多重度の文字の、端からの離れ（px） */
const CARDINALITY_GAP = 4;
/** 行が増える関連のマーカーの、線からの離れ（px） */
const FANOUT_GAP = 22;
const SVG_NS = "http://www.w3.org/2000/svg";

type Point = [number, number];

/** ノードの図の中身の座標の矩形 */
type Rect = {
  element: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 図の中身の座標で、ノードの矩形（配置の結果）と描いた要素 */
const rectOf = (
  figure: HTMLElement,
  layout: MapLayout,
  id: string,
): Rect | undefined => {
  const node = layout.nodes.find((item) => item.id === id);
  const element = figure.querySelector<HTMLElement>(
    `.mdmark-diagram-stage > .mdmark-diagram-node[data-node="${CSS.escape(id)}"]`,
  );
  return node && element
    ? { element, x: node.x, y: node.y, w: node.w, h: node.h }
    : undefined;
};

/** 列の行の縦の中ほど（図の中身の座標）。行が無ければ undefined */
const rowMiddle = (rect: Rect, column: string): number | undefined => {
  const row = rect.element.querySelector<HTMLElement>(
    `[data-column="${CSS.escape(column)}"]`,
  );
  if (!row) return undefined;
  const nodeBox = rect.element.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  const scale = nodeBox.height / (rect.h || 1) || 1;
  return rect.y + (rowBox.top - nodeBox.top + rowBox.height / 2) / scale;
};

/**
 * 自動配置の経路の元の端を、高さ y の左右の辺へ付け替える。経路の残りは自動配置のまま使い、ノードを横切らない。
 * 上下の辺から出ていた端は、次の点がある側の辺から出して、ノードの外で元の経路へ戻す
 */
const reanchor = (
  points: Point[],
  rect: Rect,
  y: number,
  side: "left" | "right" | undefined,
): Point[] => {
  const [p0, p1] = points;
  if (!p0 || !p1) return points;
  const onSide = p0[0] === rect.x || p0[0] === rect.x + rect.w;
  const chosen =
    side ??
    (onSide
      ? p0[0] === rect.x
        ? "left"
        : "right"
      : p1[0] >= rect.x + rect.w / 2
        ? "right"
        : "left");
  const sx = chosen === "right" ? rect.x + rect.w : rect.x;
  const ox = sx + (chosen === "right" ? END_OUT : -END_OUT);
  const back = onSide && side === undefined ? p0[1] : p1[1];
  return [[sx, y], [ox, y], [ox, back], ...points.slice(1)];
};

/** 両端の区間を除いた最も長い区間（無ければ全体） */
const longestInner = (points: Point[]): [Point, Point] => {
  let best: [Point, Point] = [
    points[0] as Point,
    points[points.length - 1] as Point,
  ];
  let length = -1;
  for (let at = 1; at < points.length - 2; at++) {
    const a = points[at] as Point;
    const b = points[at + 1] as Point;
    const size = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (size > length) {
      length = size;
      best = [a, b];
    }
  }
  return best;
};

/** SVG の文字 */
const svgText = (
  svg: Element,
  options: {
    x: number;
    y: number;
    text: string;
    className: string;
    anchor: "start" | "middle" | "end";
  },
): void => {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("x", String(options.x));
  node.setAttribute("y", String(options.y));
  node.setAttribute("text-anchor", options.anchor);
  node.setAttribute("class", `map-er-extra ${options.className}`);
  node.textContent = options.text;
  svg.append(node);
};

/** `erDiagram` を構成図の入力にし、構成図と同じ配置と操作に、列の行・関連の端の付け替え・多重度・経路の選択・行が増える関連のマーカーを足す */
export const attachMapEr = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapFlowHandle => {
  const er = parseErDiagram(range.querySelector("code")?.textContent ?? "");
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const tables = new Map<string, ErTable>(
    er.tables.map((table) => [table.name, table]),
  );
  const relations = new Map(er.relations.map((item) => [item.id, item]));
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
  let fanouts: ErFanout[] = [];
  /** 引き直した線ごとの、ラベルとマーカーの置き場所 */
  const marks = new Map<
    string,
    { label: Point; mark: Point; vertical: boolean }
  >();
  const columnNotes = (table: ErTable): Record<string, string> =>
    Object.fromEntries(
      table.columns.flatMap((column) => {
        const text =
          data.notes[`${table.name}.${column.name}`]?.text ?? column.comment;
        return text === undefined ? [] : [[column.name, text]];
      }),
    );
  return attachMapFlow(range, config, args, undefined, {
    chart: erToFlowchart(er, data.groups),
    overrides: Object.fromEntries(
      er.tables.map((table) => [table.name, { width: TABLE_WIDTH }]),
    ),
    collapsibles: er.tables.map((table) => table.name),
    collapsedTag: (group) => `テーブル ${tablesUnder(group)} 件`,
    decorateNode: (element, id, view) => {
      const table = tables.get(id);
      if (!table || view.faded) return;
      const part = renderMapEr({
        name: table.name,
        columns: table.columns,
        notes: columnNotes(table),
        collapsed: view.collapsed.has(id),
        id: `${range.dataset.map ?? "1"}-er-${er.tables.indexOf(table)}`,
      });
      const head = element.querySelector(".mdmark-diagram-node-kind");
      head?.insertAdjacentHTML("beforeend", part.toggle);
      head?.classList.remove("is-empty");
      element.insertAdjacentHTML("beforeend", part.columns);
      element
        .closest("figure")
        ?.querySelector(".mdmark-diagram-box")
        ?.insertAdjacentHTML("beforeend", part.tips);
      element
        .querySelector("[data-er-toggle]")
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          view.toggle(id);
        });
    },
    rewire: (layout: MapLayout, figure) => {
      marks.clear();
      return layout.wires.map((wire) => {
        const relation = relations.get(wire.id);
        const from = rectOf(figure, layout, wire.from);
        const to = rectOf(figure, layout, wire.to);
        if (!relation || !from || !to || wire.points.length < 2) return wire;
        const ends = data.layout[wire.id]?.ends;
        const yOf = (rect: Rect, name: string, other: string) => {
          const table = tables.get(name);
          if (!table) return undefined;
          const column = erColumnFor(table, other);
          return (
            (column && rowMiddle(rect, column.name)) ?? rect.y + rect.h / 2
          );
        };
        const sideOf = (value: string | undefined) =>
          value === "left" || value === "right" ? value : undefined;
        let points = wire.points as Point[];
        const fromY = yOf(from, wire.from, wire.to);
        if (fromY !== undefined)
          points = reanchor(points, from, fromY, sideOf(ends?.from));
        const toY = yOf(to, wire.to, wire.from);
        if (toY !== undefined)
          points = reanchor(
            [...points].reverse(),
            to,
            toY,
            sideOf(ends?.to),
          ).reverse();
        const [a, b] = longestInner(points);
        const vertical = a[0] === b[0];
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        marks.set(wire.id, {
          label: vertical ? [mid[0] + 8, mid[1] + 4] : [mid[0], mid[1] - 8],
          mark: vertical
            ? [mid[0] - FANOUT_GAP, mid[1]]
            : [mid[0], mid[1] + FANOUT_GAP],
          vertical,
        });
        return { ...wire, points };
      });
    },
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
      fanouts = path.fanouts;
      return { nodes: new Set(path.tables), wires: new Set(path.relations) };
    },
    afterRender: (figure, layout, view) => {
      const svg = figure.querySelector(".mdmark-diagram-stage svg");
      const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
      if (!svg || !stage) return;
      for (const old of figure.querySelectorAll(".map-er-extra")) old.remove();
      if (view.selected.size !== 2) fanouts = [];
      for (const wire of layout.wires) {
        const relation = relations.get(wire.id);
        const points = wire.points as Point[];
        if (!relation || points.length < 2) continue;
        const dim = figure
          .querySelector(
            `.mdmark-diagram-wire[data-wire="${CSS.escape(wire.id)}"]`,
          )
          ?.classList.contains("map-dim")
          ? " map-dim"
          : "";
        const ends: Array<[Point, Point, string]> = [
          [
            points[0] as Point,
            points[1] as Point,
            wire.from === relation.from
              ? relation.fromCardinality
              : relation.toCardinality,
          ],
          [
            points[points.length - 1] as Point,
            points[points.length - 2] as Point,
            wire.to === relation.to
              ? relation.toCardinality
              : relation.fromCardinality,
          ],
        ];
        for (const [[x, y], [nx], text] of ends) {
          const right = nx >= x;
          svgText(svg, {
            x: x + (right ? CARDINALITY_GAP : -CARDINALITY_GAP),
            y: y - 5,
            text,
            className: `map-er-cardinality${dim}`,
            anchor: right ? "start" : "end",
          });
        }
        const place = marks.get(wire.id);
        if (relation.label !== undefined && place)
          svgText(svg, {
            x: place.label[0],
            y: place.label[1],
            text: relation.label,
            className: `map-er-label${dim}`,
            anchor: place.vertical ? "start" : "middle",
          });
      }
      const box = figure.querySelector(".mdmark-diagram-box");
      for (const [index, fanout] of fanouts.entries()) {
        const place = marks.get(fanout.relation);
        if (!place) continue;
        const tipId = `${figure.id || "map"}-fanout-${index}`;
        const text = `${fanout.from} から ${fanout.to} へたどると、${fanout.from} の 1 行に ${fanout.to} の行が複数つながり、行が増えます`;
        stage.insertAdjacentHTML(
          "beforeend",
          `<button class="map-er-extra map-er-fanout" type="button" style="left:${place.mark[0]}px;top:${place.mark[1]}px" aria-label="${escapeHtml(`${fanout.from} から ${fanout.to} で行が増える`)}" aria-describedby="${escapeHtml(tipId)}" data-tip-owner="fanout:${index}">×n</button>`,
        );
        box?.insertAdjacentHTML(
          "beforeend",
          renderDiagramTip({
            id: tipId,
            kind: "hint",
            label: "行が増える関連",
            tip: text,
            owner: `fanout:${index}`,
          }).replace(
            'class="mdmark-diagram-tip"',
            'class="mdmark-diagram-tip map-er-extra"',
          ),
        );
      }
      if (fanouts.length > 0)
        figure.dispatchEvent(new Event(DIAGRAM_REDRAW_EVENT));
    },
  });
};
