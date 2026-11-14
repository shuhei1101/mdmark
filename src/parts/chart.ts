import type {
  MdmarkChartDefinition,
  MdmarkChartSeries,
  MdmarkChartType,
  MdmarkChartYAxis,
} from "../diagram/definition.ts";
import { niceTicks, stackSeries } from "../diagram/geometry.ts";
import { type DiagramPart, renderDiagramTip } from "./diagram.ts";
import { escapeHtml } from "./escape.ts";

/** グラフの点の形状より広い、ツールチップを取得する透明の円の半径（px） */
export const ITEM_HIT_RADIUS = 12;

/** グラフの項目 1 つ */
type ChartItem = {
  type: MdmarkChartType;
  tick?: string;
  value?: number;
  point?: number[];
  percent?: number;
  definition: MdmarkChartDefinition;
};

/** 散布図・バブルの項目の値の文（バブルは大きさを添える） */
function pointItemText(item: ChartItem): string {
  const { type, definition } = item;
  const [x = 0, y = 0, size = 0] = item.point ?? [];
  const { x: xAxis, y: yAxis } = definition;
  const base = `${xAxis?.label ?? "x"} ${x}・${yAxis?.label ?? "y"} ${y}`;
  return type === "bubble" ? `${base}・${sizeLabel(definition)} ${size}` : base;
}

/** バブルの大きさの軸の名前（無いか空なら「大きさ」） */
function sizeLabel(definition: MdmarkChartDefinition): string {
  return definition.size?.label || "大きさ";
}

/** グラフの項目の値の文（部品設計『図のツールチップ』の `value`） */
export function chartItemText(item: ChartItem): string {
  const { type, definition } = item;
  if (type === "pie" || type === "donut") {
    return `${item.value ?? 0}${definition.unit ?? ""}（${item.percent ?? 0}%）`;
  }
  if (type === "scatter" || type === "bubble") {
    return pointItemText(item);
  }
  return `${item.tick ?? ""}: ${item.value ?? 0}`;
}

/** グラフの項目のツールチップを集める入れ物 */
type ItemTips = {
  /** ツールチップを追加し、項目に付ける属性（先頭に空白）を返却する */
  attrs: (label: string, value: string) => string;
  /** 追加したツールチップの HTML */
  html: () => string;
};

/** `id` の頭から通し番号の `id` を振る、グラフの項目のツールチップの入れ物を作る */
function createItemTips(prefix: string): ItemTips {
  const rendered: string[] = [];
  return {
    attrs: (label, value) => {
      const n = rendered.length + 1;
      const id = `${prefix}-tip-${n}`;
      const owner = `item:${n}`;
      rendered.push(
        renderDiagramTip({ id, kind: "item", label, value, owner }),
      );
      return ` tabindex="0" aria-describedby="${escapeHtml(id)}" data-tip-owner="${owner}"`;
    },
    html: () => rendered.join(""),
  };
}

/** 点の周りのツールチップを取得する透明の円 */
function itemHit(attrs: string, x: number, y: number): string {
  return `<circle class="mdmark-diagram-item-hit" cx="${num(x)}" cy="${num(y)}" r="${ITEM_HIT_RADIUS}"${attrs}></circle>`;
}

/** 系列の点の形状 */
type PointShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "triangle-down"
  | "cross";

/** 系列の塗りの模様 */
type FillShape = "solid" | "hatch" | "dot" | "grid" | "vertical" | "horizontal";

/** 系列の外観の組 */
type SeriesStyle = {
  /** 色の CSS 変数 */
  color: string;
  /** 線の模様（CSS の `stroke-dasharray` と同じ値） */
  dash: string;
  /** 点の形状 */
  point: PointShape;
  /** 塗りの模様 */
  fill: FillShape;
};

/** 系列と項目の位置ごとの、色・線の模様・点の形状・塗りの模様の組 */
export const SERIES_STYLES: readonly SeriesStyle[] = [
  {
    color: "--mdmark-color-series-1",
    dash: "",
    point: "circle",
    fill: "solid",
  },
  {
    color: "--mdmark-color-series-2",
    dash: "7 4",
    point: "square",
    fill: "hatch",
  },
  {
    color: "--mdmark-color-series-3",
    dash: "1 4",
    point: "triangle",
    fill: "dot",
  },
  {
    color: "--mdmark-color-series-4",
    dash: "9 3 1 3",
    point: "diamond",
    fill: "grid",
  },
  {
    color: "--mdmark-color-series-5",
    dash: "9 3 1 3 1 3",
    point: "triangle-down",
    fill: "vertical",
  },
  {
    color: "--mdmark-color-series-6",
    dash: "3 2",
    point: "cross",
    fill: "horizontal",
  },
];

/** グラフの寸法（px）: 全体と、描く範囲の上下左右の余白 */
const CHART = {
  width: 640,
  height: 320,
  pad: { top: 36, right: 24, bottom: 56, left: 56 },
};

/** 右の縦の軸（`combo` の `y2`）を持つときの右の余白（px） */
const Y2_PAD = 56;

/** 横棒の項目の名前を配置する左の余白（px） */
const HORIZONTAL_PAD = 112;

/** 系列の点のマーカーの大きさ（px）。散布図は点だけで読み込むので大きくする */
export const POINT_SIZE = 4.5;
export const SCATTER_POINT_SIZE = 5.5;

/** 十字の点の、腕の半分の幅の大きさに対する割合 */
const CROSS_ARM = 0.45;

/** 円の半径（px）・扇形の外に配置する割合の文字までの距離（px）・ドーナツの中の半径の割合 */
const PIE = { radius: 118, labelGap: 16, hole: 0.58 };

/** ドーナツの中央の合計と `合計{unit}` の、中心からの縦のずれ（px） */
const DONUT_TEXT = { total: 2, caption: 22 };

/** 棒 1 本の幅の上限（px）と、項目の幅に対する棒の幅の割合 */
const BAR = { maxWidth: 28, share: 0.72 };

/** 積み上げの棒の合計の文字の、棒の上端からの距離（px） */
const TOTAL_GAP = 6;

/** レーダーの半径（px）と、軸の名前までの距離（px） */
const RADAR = { radius: 104, labelGap: 14 };

/** バブルの最も大きい円の半径（px） */
const BUBBLE_MAX_RADIUS = 24;

/** 扇形・軸の名前の文字を中央に配置する、角の余弦の幅 */
const CENTER_COS = 0.2;

/** 数を小数 2 桁までの文字にする */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 系列の位置（1 から）の点の形状。7 つ目以降は先頭から繰り返す */
function pointShapeOf(series: number): PointShape {
  return SERIES_STYLES[(series - 1) % SERIES_STYLES.length]?.point ?? "circle";
}

/** 点の並びを閉じた `path` の点のマーカーにする */
function polygonPoint(points: Array<[number, number]>): string {
  return `<path class="mdmark-diagram-point" d="M${points.map(([x, y]) => `${num(x)},${num(y)}`).join(" L")} z"></path>`;
}

/** 系列の点のマーカー（`SERIES_STYLES` の点の形状） */
export function pointSvg(
  series: number,
  at: [number, number],
  size: number = POINT_SIZE,
): string {
  const [x, y] = at;
  const s = size;
  const shape = pointShapeOf(series);
  switch (shape) {
    case "circle":
      return `<circle class="mdmark-diagram-point" cx="${num(x)}" cy="${num(y)}" r="${s}"></circle>`;
    case "square":
      return `<rect class="mdmark-diagram-point" x="${num(x - s)}" y="${num(y - s)}" width="${s * 2}" height="${s * 2}"></rect>`;
    case "triangle":
      return polygonPoint([
        [x, y - s - 1],
        [x + s + 1, y + s],
        [x - s - 1, y + s],
      ]);
    case "diamond":
      return polygonPoint([
        [x, y - s - 1],
        [x + s + 1, y],
        [x, y + s + 1],
        [x - s - 1, y],
      ]);
    case "triangle-down":
      return polygonPoint([
        [x, y + s + 1],
        [x + s + 1, y - s],
        [x - s - 1, y - s],
      ]);
    case "cross": {
      const w = s * CROSS_ARM;
      return polygonPoint([
        [x - w, y - s],
        [x + w, y - s],
        [x + w, y - w],
        [x + s, y - w],
        [x + s, y + w],
        [x + w, y + w],
        [x + w, y + s],
        [x - w, y + s],
        [x - w, y + w],
        [x - s, y + w],
        [x - s, y - w],
        [x - w, y - w],
      ]);
    }
  }
}

/** 塗りの模様ごとの `pattern` の中身（塗りつぶし以外は色の薄い地に重ねる）。色は CSS が系列の番号で適用する */
const FILL_BODIES: Readonly<Record<FillShape, string>> = {
  solid:
    '<rect class="mdmark-diagram-pattern-solid" width="8" height="8"></rect>',
  hatch:
    '<path class="mdmark-diagram-pattern-ink" d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6"></path>',
  dot: '<circle class="mdmark-diagram-pattern-dot" cx="4" cy="4" r="1.8"></circle>',
  grid: '<path class="mdmark-diagram-pattern-ink-thin" d="M0,0 L8,8 M8,0 L0,8"></path>',
  vertical: '<path class="mdmark-diagram-pattern-ink" d="M4,0 V8"></path>',
  horizontal: '<path class="mdmark-diagram-pattern-ink" d="M0,4 H8"></path>',
};

/** 系列の塗りの模様（`SERIES_STYLES` の塗りの模様）の `pattern` */
export function fillPatterns(id: string): string {
  const tint =
    '<rect class="mdmark-diagram-pattern-tint" width="8" height="8"></rect>';
  return SERIES_STYLES.map((style, index) => {
    const body =
      style.fill === "solid"
        ? FILL_BODIES.solid
        : `${tint}${FILL_BODIES[style.fill]}`;
    return `<pattern id="${id}-fill-${index + 1}" data-series="${index + 1}" patternunits="userSpaceOnUse" width="8" height="8">${body}</pattern>`;
  }).join("");
}

/** 描く範囲 */
type ChartBox = { left: number; right: number; top: number; bottom: number };

/** 軸の範囲 */
type AxisRange = { min: number; max: number; step: number };

/** 縦の軸の範囲。定義が `min`・`max`・`step` を持つならそのまま、省いていればデータから切る */
function axisOf(
  axis: MdmarkChartYAxis | undefined,
  values: number[],
): AxisRange {
  if (
    axis?.min !== undefined &&
    axis.max !== undefined &&
    axis.step !== undefined
  ) {
    return { min: axis.min, max: axis.max, step: axis.step };
  }
  return niceTicks(values);
}

/** 目盛りの値を並べる（刻みの誤差で桁が崩れないよう丸める） */
function ticksOf(axis: AxisRange): number[] {
  const values: number[] = [];
  const rows = Math.round((axis.max - axis.min) / axis.step);
  for (let index = 0; index <= rows; index++) {
    values.push(Number((axis.min + index * axis.step).toPrecision(12)));
  }
  return values;
}

/** 値から縦の位置を求める関数を作る */
function yScale(axis: AxisRange, box: ChartBox): (value: number) => number {
  return (value) =>
    box.bottom -
    ((value - axis.min) * (box.bottom - box.top)) / (axis.max - axis.min);
}

/** 縦の軸の補助線・目盛りの値・軸の名前。`side` が `right` なら右の軸にし、補助線を描かない */
function yAxisSvg(options: {
  axis: AxisRange;
  label: string;
  yAt: (value: number) => number;
  box: ChartBox;
  side?: "left" | "right";
}): string[] {
  const { axis, label, yAt, box, side = "left" } = options;
  const right = side === "right";
  const x = right ? box.right + 8 : box.left - 8;
  const svg: string[] = [];
  for (const value of ticksOf(axis)) {
    if (!right) {
      svg.push(
        `<line class="mdmark-diagram-grid" x1="${box.left}" y1="${num(yAt(value))}" x2="${box.right}" y2="${num(yAt(value))}"></line>`,
      );
    }
    svg.push(
      `<text class="mdmark-diagram-axis-text" x="${x}" y="${num(yAt(value) + 4)}" text-anchor="${right ? "start" : "end"}">${num(value)}</text>`,
    );
  }
  svg.push(
    `<text class="mdmark-diagram-axis-text" x="${x}" y="${box.top - 18}" text-anchor="${right ? "end" : "start"}">${escapeHtml(label)}</text>`,
  );
  return svg;
}

/** 軸の線と、横の軸の名前（目盛りの下）。`right` が真なら右の縦の軸の線も描く */
function axisLinesSvg(label: string, box: ChartBox, right = false): string[] {
  return [
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.bottom}" x2="${box.right}" y2="${box.bottom}"></line>`,
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.top - 8}" x2="${box.left}" y2="${box.bottom}"></line>`,
    ...(right
      ? [
          `<line class="mdmark-diagram-axis" x1="${box.right}" y1="${box.top - 8}" x2="${box.right}" y2="${box.bottom}"></line>`,
        ]
      : []),
    `<text class="mdmark-diagram-axis-text" x="${num((box.left + box.right) / 2)}" y="${box.bottom + 44}" text-anchor="middle">${escapeHtml(label)}</text>`,
  ];
}

/** 横の目盛りが項目の名前の軸の目盛りの値 */
function xTicksSvg(
  ticks: string[],
  xAt: (index: number) => number,
  box: ChartBox,
): string[] {
  return ticks.map(
    (tick, index) =>
      `<text class="mdmark-diagram-axis-text" x="${num(xAt(index))}" y="${box.bottom + 20}" text-anchor="middle">${escapeHtml(tick)}</text>`,
  );
}

/** 点の並びを `M x,y L x,y …` のパスにする。`close` が真なら閉じる */
function pathOf(points: Array<[number, number]>, close = false): string {
  return `M${points.map(([x, y]) => `${num(x)},${num(y)}`).join(" L")}${close ? " Z" : ""}`;
}

/** 系列の折れ線と点のマーカー。`hits` を指定すると、点ごとにその属性を持つクリックを受ける円を重ねる */
function seriesLineSvg(
  n: number,
  points: Array<[number, number]>,
  options: { close?: boolean; hits?: string[] } = {},
): string[] {
  const { close = false, hits = [] } = options;
  return [
    `<path class="mdmark-diagram-series" data-series="${n}" d="${pathOf(points, close)}"></path>`,
    `<g data-series="${n}">${points.map(([x, y]) => pointSvg(n, [x, y])).join("")}${points.map(([x, y], i) => (hits[i] === undefined ? "" : itemHit(hits[i], x, y))).join("")}</g>`,
  ];
}

/** 系列の塗りの模様で塗った面 */
function seriesAreaSvg(options: {
  n: number;
  id: string;
  className: string;
  points: Array<[number, number]>;
}): string {
  const { n, id, className, points } = options;
  return `<g data-series="${n}"><path class="${className}" d="${pathOf(points, true)}" fill="url(#${id}-fill-${n})"></path></g>`;
}

/** 系列の棒 1 本 */
function barRect(options: {
  n: number;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  attrs?: string;
}): string {
  const { n, id, x, y, width, height, attrs = "" } = options;
  return `<rect class="mdmark-diagram-bar" x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" fill="url(#${id}-fill-${n})"${attrs}></rect>`;
}

/** 描いたグラフの中身 */
type ChartBody = { svg: string[]; label: string };

/** 目盛りの軸のグラフの入力: 横の目盛りと、系列ごとの点 */
type TickedChart = {
  ticks: string[];
  series: Array<{ name: string; points: number[] }>;
  yAxis: MdmarkChartYAxis | undefined;
  xLabel: string;
  /** 項目のツールチップの入れ物 */
  tips: ItemTips;
};

/** 目盛りの軸のグラフの項目 1 つに付ける属性 */
function tickedAttrs(
  input: TickedChart,
  item: { name: string; position: number; value: number },
): string {
  const { name, position, value } = item;
  return input.tips.attrs(name, `${input.ticks[position] ?? ""}: ${value}`);
}

/** 目盛りの軸のグラフのスクリーンリーダー: 系列ごとに目盛りと値を並べる */
function tickedLabel(input: TickedChart): string {
  return input.series
    .map(
      (entry) =>
        `${entry.name}: ${entry.points.map((value, position) => `${input.ticks[position]} ${value}`).join("・")}`,
    )
    .join("。");
}

/** 目盛りを等間隔に端から端へ配置する横の位置の関数 */
function edgeScale(ticks: string[], box: ChartBox): (index: number) => number {
  return (index) =>
    box.left + (index * (box.right - box.left)) / Math.max(1, ticks.length - 1);
}

/** 目盛りを項目の幅の中央に配置する横の位置の関数と、項目の幅 */
function bandScale(
  count: number,
  box: ChartBox,
): { band: number; xAt: (index: number) => number } {
  const band = (box.right - box.left) / Math.max(1, count);
  return { band, xAt: (index) => box.left + band * (index + 0.5) };
}

/** 折れ線と面: 系列を色と線の模様・点のマーカーの組で引き、`area` が真なら線の下を系列の塗りの模様で塗る */
function lineChart(
  input: TickedChart,
  box: ChartBox,
  options: { id: string; area: boolean },
): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const xAt = edgeScale(ticks, box);
  const yAt = yScale(axis, box);
  const base = yAt(Math.min(Math.max(0, axis.min), axis.max));
  const svg = [
    ...(options.area ? [`<defs>${fillPatterns(options.id)}</defs>`] : []),
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
    ...axisLinesSvg(xLabel, box),
  ];
  const lines: string[] = [];
  series.forEach((entry, index) => {
    const n = index + 1;
    const points = entry.points.map((value, position): [number, number] => [
      xAt(position),
      yAt(value),
    ]);
    if (options.area) {
      const bottom = points.map(([x]): [number, number] => [x, base]).reverse();
      svg.push(
        seriesAreaSvg({
          n,
          id: options.id,
          className: "mdmark-diagram-area",
          points: [...points, ...bottom],
        }),
      );
    }
    lines.push(
      ...seriesLineSvg(n, points, {
        hits: entry.points.map((value, position) =>
          tickedAttrs(input, { name: entry.name, position, value }),
        ),
      }),
    );
  });
  // 面の上に線と点を重ねる
  svg.push(...lines);
  return {
    svg,
    label: series
      .map((entry) => `${entry.name}: ${entry.points.join("・")}`)
      .join("。"),
  };
}

/** 積み上げの面: `stackSeries` で追加し、下の系列の上端から自分の上端までを系列の塗りの模様で塗る */
function stackedAreaChart(
  input: TickedChart,
  box: ChartBox,
  id: string,
): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const stacked = stackSeries(series.map((entry) => entry.points));
  const axis = axisOf(
    yAxis,
    stacked.flat().flatMap((range) => [range.from, range.to]),
  );
  const xAt = edgeScale(ticks, box);
  const yAt = yScale(axis, box);
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
  ];
  stacked.forEach((ranges, index) => {
    const top = ranges.map((range, position): [number, number] => [
      xAt(position),
      yAt(range.to),
    ]);
    const bottom = ranges
      .map((range, position): [number, number] => [
        xAt(position),
        yAt(range.from),
      ])
      .reverse();
    svg.push(
      seriesAreaSvg({
        n: index + 1,
        id,
        className: "mdmark-diagram-stacked-area",
        points: [...top, ...bottom],
      }),
    );
  });
  // 面の上端の点に、項目のツールチップを取得するクリックを受ける円を重ねる
  stacked.forEach((ranges, index) => {
    const entry = series[index];
    const hits = ranges.map((range, position) =>
      itemHit(
        tickedAttrs(input, {
          name: entry?.name ?? "",
          position,
          value: entry?.points[position] ?? 0,
        }),
        xAt(position),
        yAt(range.to),
      ),
    );
    svg.push(`<g data-series="${index + 1}">${hits.join("")}</g>`);
  });
  svg.push(...axisLinesSvg(xLabel, box));
  return { svg, label: tickedLabel(input) };
}

/** 棒: 項目ごとに系列の棒を横に並べ、系列を色と塗りの模様の組で分ける */
function barChart(input: TickedChart, box: ChartBox, id: string): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const { band, xAt } = bandScale(ticks.length, box);
  const yAt = yScale(axis, box);
  const barWidth = Math.min(BAR.maxWidth, (band * BAR.share) / series.length);
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
  ];
  series.forEach((entry, index) => {
    const n = index + 1;
    const bars = entry.points.map((value, position) =>
      barRect({
        n,
        id,
        x:
          xAt(position) - (barWidth * series.length) / 2 + barWidth * index + 1,
        y: Math.min(yAt(value), yAt(0)),
        width: barWidth - 2,
        height: Math.abs(yAt(value) - yAt(0)),
        attrs: tickedAttrs(input, { name: entry.name, position, value }),
      }),
    );
    svg.push(`<g data-series="${n}">${bars.join("")}</g>`);
  });
  svg.push(...axisLinesSvg(xLabel, box));
  return { svg, label: tickedLabel(input) };
}

/** 積み上げの棒: 項目ごとに 1 本の棒に `stackSeries` で系列を追加し、棒の上に合計を配置する */
function stackedBarChart(
  input: TickedChart,
  box: ChartBox,
  id: string,
): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const stacked = stackSeries(series.map((entry) => entry.points));
  const axis = axisOf(
    yAxis,
    stacked.flat().flatMap((range) => [range.from, range.to]),
  );
  const { band, xAt } = bandScale(ticks.length, box);
  const yAt = yScale(axis, box);
  const barWidth = Math.min(BAR.maxWidth * 2, band * BAR.share);
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
  ];
  stacked.forEach((ranges, index) => {
    const n = index + 1;
    const bars = ranges.map((range, position) =>
      barRect({
        n,
        id,
        x: xAt(position) - barWidth / 2,
        y: Math.min(yAt(range.from), yAt(range.to)),
        width: barWidth,
        height: Math.abs(yAt(range.to) - yAt(range.from)),
        attrs: tickedAttrs(input, {
          name: series[index]?.name ?? "",
          position,
          value: series[index]?.points[position] ?? 0,
        }),
      }),
    );
    svg.push(`<g data-series="${n}">${bars.join("")}</g>`);
  });
  ticks.forEach((_, position) => {
    const values = series.map((entry) => entry.points[position] ?? 0);
    const total = values.reduce((sum, value) => sum + value, 0);
    // 合計は正の値を追加した棒の上端の上に配置する
    const top = values
      .filter((value) => value > 0)
      .reduce((sum, value) => sum + value, 0);
    svg.push(
      `<text class="mdmark-diagram-value-text" x="${num(xAt(position))}" y="${num(yAt(top) - TOTAL_GAP)}" text-anchor="middle">${num(total)}</text>`,
    );
  });
  svg.push(...axisLinesSvg(xLabel, box));
  return { svg, label: tickedLabel(input) };
}

/** 横棒: 項目を縦に並べ、値を横の長さにする。縦の軸の定義（`y`）を横の値の軸に使用する */
function horizontalBarChart(
  input: TickedChart,
  box: ChartBox,
  id: string,
): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const area: ChartBox = { ...box, left: HORIZONTAL_PAD };
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const xAt = (value: number): number =>
    area.left +
    ((value - axis.min) * (area.right - area.left)) / (axis.max - axis.min);
  const band = (area.bottom - area.top) / Math.max(1, ticks.length);
  const yAt = (index: number): number => area.top + band * (index + 0.5);
  const barHeight = Math.min(BAR.maxWidth, (band * BAR.share) / series.length);
  const zero = xAt(Math.min(Math.max(0, axis.min), axis.max));
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...xNumberAxisSvg(axis, xAt, area),
    ...ticks.map(
      (tick, index) =>
        `<text class="mdmark-diagram-axis-text" x="${area.left - 8}" y="${num(yAt(index) + 4)}" text-anchor="end">${escapeHtml(tick)}</text>`,
    ),
    `<text class="mdmark-diagram-axis-text" x="${area.left - 8}" y="${area.top - 18}" text-anchor="end">${escapeHtml(xLabel)}</text>`,
  ];
  series.forEach((entry, index) => {
    const n = index + 1;
    const bars = entry.points.map((value, position) =>
      barRect({
        n,
        id,
        x: Math.min(xAt(value), zero),
        y:
          yAt(position) -
          (barHeight * series.length) / 2 +
          barHeight * index +
          1,
        width: Math.abs(xAt(value) - zero),
        height: barHeight - 2,
        attrs: tickedAttrs(input, { name: entry.name, position, value }),
      }),
    );
    svg.push(`<g data-series="${n}">${bars.join("")}</g>`);
  });
  svg.push(
    `<line class="mdmark-diagram-axis" x1="${area.left}" y1="${area.bottom}" x2="${area.right}" y2="${area.bottom}"></line>`,
    `<line class="mdmark-diagram-axis" x1="${num(zero)}" y1="${area.top - 8}" x2="${num(zero)}" y2="${area.bottom}"></line>`,
    `<text class="mdmark-diagram-axis-text" x="${num((area.left + area.right) / 2)}" y="${area.bottom + 44}" text-anchor="middle">${escapeHtml(yAxis?.label ?? "")}</text>`,
  );
  return { svg, label: tickedLabel(input) };
}

/** 割合（整数の %）。合計が 100 になるよう最大剰余法で丸める */
function percentsOf(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (rest <= 0) {
      break;
    }
    floors[index] = (floors[index] ?? 0) + 1;
    rest -= 1;
  }
  return floors;
}

/** 角の向きから、角の先に配置する文字の統一方を決める */
function anchorOf(angle: number): "middle" | "start" | "end" {
  const cos = Math.cos(angle);
  if (Math.abs(cos) < CENTER_COS) {
    return "middle";
  }
  return cos > 0 ? "start" : "end";
}

/** 扇形 1 つのパス。`inner` が 0 より大きければ中を空ける */
function slicePath(options: {
  cx: number;
  cy: number;
  radius: number;
  inner: number;
  from: number;
  sweep: number;
}): string {
  const { cx, cy, radius, inner, from, sweep } = options;
  const at = (angle: number, distance: number): string =>
    `${num(cx + distance * Math.cos(angle))},${num(cy + distance * Math.sin(angle))}`;
  const large = sweep > Math.PI ? 1 : 0;
  const outer = `${at(from, radius)} A${radius},${radius} 0 ${large} 1 ${at(from + sweep, radius)}`;
  if (inner <= 0) {
    return `M${cx},${cy} L${outer} Z`;
  }
  return `M${outer} L${at(from + sweep, inner)} A${num(inner)},${num(inner)} 0 ${large} 0 ${at(from, inner)} Z`;
}

/** 円とドーナツ: 12 時から時計回りに項目の値の割合の角度で扇形を描き、扇形の外に割合を出す。`donut` が真なら中を空け、中央に合計と `合計{unit}` を配置する */
function pieChart(options: {
  items: Array<{ name: string; value: number }>;
  unit: string;
  id: string;
  donut: boolean;
  tips: ItemTips;
}): ChartBody {
  const { items, unit, id, donut, tips } = options;
  const cx = CHART.width / 2;
  const cy = CHART.height / 2;
  const { radius, labelGap } = PIE;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const percents = percentsOf(items.map((item) => item.value));
  const svg: string[] = [`<defs>${fillPatterns(id)}</defs>`];
  let angle = -Math.PI / 2;
  items.forEach((item, index) => {
    const n = index + 1;
    // 1 項目だけのときの全周は、始点と終点が重なって弧が消えるので、わずかに足りない角にする
    const sweep = Math.min(
      (item.value / total) * Math.PI * 2,
      Math.PI * 2 - 1e-4,
    );
    const d = slicePath({
      cx,
      cy,
      radius,
      inner: donut ? radius * PIE.hole : 0,
      from: angle,
      sweep,
    });
    svg.push(
      `<g data-series="${n}"><path class="mdmark-diagram-slice" d="${d}" fill="url(#${id}-fill-${n})"${tips.attrs(item.name, `${item.value}${unit}（${percents[index]}%）`)}></path></g>`,
    );
    const middle = angle + sweep / 2;
    const lx = cx + (radius + labelGap) * Math.cos(middle);
    const ly = cy + (radius + labelGap) * Math.sin(middle);
    svg.push(
      `<text class="mdmark-diagram-value-text" x="${num(lx)}" y="${num(ly + 5)}" text-anchor="${anchorOf(middle)}">${percents[index]}%</text>`,
    );
    angle += sweep;
  });
  if (donut) {
    svg.push(
      `<text class="mdmark-diagram-total-text" x="${cx}" y="${cy + DONUT_TEXT.total}" text-anchor="middle">${num(total)}</text>`,
      `<text class="mdmark-diagram-axis-text" x="${cx}" y="${cy + DONUT_TEXT.caption}" text-anchor="middle">${escapeHtml(`合計${unit}`)}</text>`,
    );
  }
  return {
    svg,
    label: items
      .map(
        (item, index) =>
          `${item.name}: ${item.value}${unit}（${percents[index]}%）`,
      )
      .join("。"),
  };
}

/** レーダー: `x.ticks` の軸を 12 時から時計回りに放射状に並べ、系列を色と線の模様・点の形状の多角形で描く */
function radarChart(input: TickedChart, id: string): ChartBody {
  const { ticks, series, yAxis } = input;
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const cx = CHART.width / 2;
  const cy = CHART.height / 2;
  const { radius, labelGap } = RADAR;
  const angleOf = (index: number): number =>
    -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, ticks.length);
  const at = (index: number, distance: number): [number, number] => [
    cx + distance * Math.cos(angleOf(index)),
    cy + distance * Math.sin(angleOf(index)),
  ];
  const distanceOf = (value: number): number =>
    ((Math.min(Math.max(value, axis.min), axis.max) - axis.min) * radius) /
    (axis.max - axis.min);
  const svg = [`<defs>${fillPatterns(id)}</defs>`];
  for (const value of ticksOf(axis)) {
    if (value === axis.min) {
      continue;
    }
    const ring = ticks.map((_, index) => at(index, distanceOf(value)));
    svg.push(
      `<path class="mdmark-diagram-radar-grid" d="${pathOf(ring, true)}"></path>`,
      `<text class="mdmark-diagram-axis-text" x="${num(cx + 4)}" y="${num(cy - distanceOf(value) - 3)}" text-anchor="start">${num(value)}</text>`,
    );
  }
  ticks.forEach((tick, index) => {
    const [x, y] = at(index, radius);
    const [lx, ly] = at(index, radius + labelGap);
    svg.push(
      `<line class="mdmark-diagram-axis" x1="${cx}" y1="${cy}" x2="${num(x)}" y2="${num(y)}"></line>`,
      `<text class="mdmark-diagram-axis-text" x="${num(lx)}" y="${num(ly + 4)}" text-anchor="${anchorOf(angleOf(index))}">${escapeHtml(tick)}</text>`,
    );
  });
  const lines: string[] = [];
  series.forEach((entry, index) => {
    const n = index + 1;
    const points = entry.points.map((value, position) =>
      at(position, distanceOf(value)),
    );
    svg.push(
      seriesAreaSvg({ n, id, className: "mdmark-diagram-area", points }),
    );
    lines.push(
      ...seriesLineSvg(n, points, {
        close: true,
        hits: entry.points.map((value, position) =>
          tickedAttrs(input, { name: entry.name, position, value }),
        ),
      }),
    );
  });
  svg.push(...lines);
  return { svg, label: tickedLabel(input) };
}

/** 数値の横の軸の補助線と目盛りの値 */
function xNumberAxisSvg(
  axis: AxisRange,
  xAt: (value: number) => number,
  box: ChartBox,
): string[] {
  return ticksOf(axis).flatMap((value) => [
    `<line class="mdmark-diagram-grid" x1="${num(xAt(value))}" y1="${box.top}" x2="${num(xAt(value))}" y2="${box.bottom}"></line>`,
    `<text class="mdmark-diagram-axis-text" x="${num(xAt(value))}" y="${box.bottom + 20}" text-anchor="middle">${num(value)}</text>`,
  ]);
}

/** 散布図とバブル: 横と縦の両方を数値の軸にし、散布図は系列の点のマーカー、バブルは 3 つ目の値に面積が比例する円を配置する（線で結ばない） */
function scatterChart(
  input: {
    series: Array<{ name: string; points: number[][] }>;
    xLabel: string;
    yAxis: MdmarkChartYAxis | undefined;
    bubble?: { label: string; id: string };
    tips: ItemTips;
    definition: MdmarkChartDefinition;
  },
  box: ChartBox,
): ChartBody {
  const { series, xLabel, yAxis, bubble, tips, definition } = input;
  const xAxis = niceTicks(
    series.flatMap((entry) => entry.points.map((p) => p[0] ?? 0)),
  );
  const yRange = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points.map((p) => p[1] ?? 0)),
  );
  const xAt = (value: number): number =>
    box.left +
    ((value - xAxis.min) * (box.right - box.left)) / (xAxis.max - xAxis.min);
  const yAt = yScale(yRange, box);
  const largest = Math.max(
    0,
    ...series.flatMap((entry) => entry.points.map((p) => p[2] ?? 0)),
  );
  const svg = [
    ...(bubble ? [`<defs>${fillPatterns(bubble.id)}</defs>`] : []),
    ...yAxisSvg({ axis: yRange, label: yAxis?.label ?? "", yAt, box }),
    ...xNumberAxisSvg(xAxis, xAt, box),
    ...axisLinesSvg(xLabel, box),
  ];
  series.forEach((entry, index) => {
    const n = index + 1;
    const marks = entry.points.map(([x = 0, y = 0, size = 0]) => {
      const attrs = tips.attrs(
        entry.name,
        chartItemText({
          type: bubble ? "bubble" : "scatter",
          point: [x, y, size],
          definition,
        }),
      );
      if (!bubble) {
        return (
          pointSvg(n, [xAt(x), yAt(y)], SCATTER_POINT_SIZE) +
          itemHit(attrs, xAt(x), yAt(y))
        );
      }
      // 面積を値に比例させるため、半径は値の平方根に比例させる
      const r =
        largest > 0
          ? BUBBLE_MAX_RADIUS * Math.sqrt(Math.max(0, size) / largest)
          : 0;
      return `<circle class="mdmark-diagram-bubble" cx="${num(xAt(x))}" cy="${num(yAt(y))}" r="${num(r)}" fill="url(#${bubble.id}-fill-${n})"${attrs}></circle>`;
    });
    svg.push(`<g data-series="${n}">${marks.join("")}</g>`);
  });
  return {
    svg,
    label: series
      .map(
        (entry) =>
          `${entry.name}: ${entry.points
            .map(([x, y, size]) =>
              bubble ? `(${x}, ${y}, ${bubble.label} ${size})` : `(${x}, ${y})`,
            )
            .join("・")}`,
      )
      .join("。"),
  };
}

/** 複合グラフの左の縦の軸と、`y2` があれば右の縦の軸 */
function comboYAxesSvg(
  definition: MdmarkChartDefinition,
  axes: Omit<ReturnType<typeof comboAxes>, "onY2">,
): string[] {
  const { area, left, right, leftAt, rightAt } = axes;
  return [
    ...yAxisSvg({
      axis: left,
      label: definition.y?.label ?? "",
      yAt: leftAt,
      box: area,
    }),
    ...(right
      ? yAxisSvg({
          axis: right,
          label: definition.y2?.label ?? "",
          yAt: rightAt,
          box: area,
          side: "right",
        })
      : []),
  ];
}

/** 複合グラフの縦の軸。`y2` があれば右の軸を加え、描く範囲の右を空ける */
function comboAxes(
  definition: MdmarkChartDefinition,
  box: ChartBox,
): {
  area: ChartBox;
  left: AxisRange;
  right: AxisRange | undefined;
  leftAt: (value: number) => number;
  rightAt: (value: number) => number;
  onY2: (entry: MdmarkChartSeries) => boolean;
} {
  const series = definition.series ?? [];
  const pointsOf = (entry: MdmarkChartSeries): number[] =>
    entry.points as number[];
  const onY2 = (entry: MdmarkChartSeries): boolean =>
    entry.axis === "y2" && definition.y2 !== undefined;
  const area: ChartBox = definition.y2
    ? { ...box, right: CHART.width - Y2_PAD }
    : box;
  const left = axisOf(
    definition.y,
    series.filter((entry) => !onY2(entry)).flatMap(pointsOf),
  );
  const right = definition.y2
    ? axisOf(definition.y2, series.filter(onY2).flatMap(pointsOf))
    : undefined;
  const leftAt = yScale(left, area);
  return {
    area,
    left,
    right,
    leftAt,
    rightAt: right ? yScale(right, area) : leftAt,
    onY2,
  };
}

/** 折れ線と棒の組み合わせ: 系列ごとに `as` の描き方で重ね、`axis` が `y2` の系列を右の縦の軸で示す */
function comboChart(
  definition: MdmarkChartDefinition,
  box: ChartBox,
  context: { id: string; tips: ItemTips },
): ChartBody {
  const { id, tips } = context;
  const ticks = definition.x?.ticks ?? [];
  const series = definition.series ?? [];
  const pointsOf = (entry: MdmarkChartSeries): number[] =>
    entry.points as number[];
  const { area, left, right, leftAt, rightAt, onY2 } = comboAxes(
    definition,
    box,
  );
  const { band, xAt } = bandScale(ticks.length, area);
  const bars = series.filter((entry) => entry.as === "bar");
  const barWidth = Math.min(
    BAR.maxWidth,
    (band * BAR.share) / Math.max(1, bars.length),
  );
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...comboYAxesSvg(definition, { area, left, right, leftAt, rightAt }),
    ...xTicksSvg(ticks, xAt, area),
  ];
  /** 項目のツールチップの属性 */
  const attrsOf = (entry: MdmarkChartSeries, position: number, value: number) =>
    tips.attrs(entry.name, `${ticks[position] ?? ""}: ${value}`);
  const lines: string[] = [];
  series.forEach((entry, index) => {
    const n = index + 1;
    const yAt = onY2(entry) ? rightAt : leftAt;
    if (entry.as !== "bar") {
      lines.push(
        ...seriesLineSvg(
          n,
          pointsOf(entry).map((value, position): [number, number] => [
            xAt(position),
            yAt(value),
          ]),
          {
            hits: pointsOf(entry).map((value, position) =>
              attrsOf(entry, position, value),
            ),
          },
        ),
      );
      return;
    }
    const order = bars.indexOf(entry);
    const rects = pointsOf(entry).map((value, position) =>
      barRect({
        n,
        id,
        x: xAt(position) - (barWidth * bars.length) / 2 + barWidth * order + 1,
        y: Math.min(yAt(value), yAt(0)),
        width: barWidth - 2,
        height: Math.abs(yAt(value) - yAt(0)),
        attrs: attrsOf(entry, position, value),
      }),
    );
    svg.push(`<g data-series="${n}">${rects.join("")}</g>`);
  });
  // 棒の上に折れ線を重ねる
  svg.push(
    ...axisLinesSvg(definition.x?.label ?? "", area, right !== undefined),
    ...lines,
  );
  return {
    svg,
    label: tickedLabel({
      ticks,
      series: series.map((entry) => ({
        name: entry.name,
        points: pointsOf(entry),
      })),
      yAxis: definition.y,
      xLabel: definition.x?.label ?? "",
      tips,
    }),
  };
}

/** グラフを種類ごとに描く。定義は `readDefinition` が構造を確認したもの。`id` は塗りの模様の `pattern` の `id` の頭 */
export function renderChart(
  definition: MdmarkChartDefinition,
  id: string,
): DiagramPart {
  const { pad } = CHART;
  const box: ChartBox = {
    left: pad.left,
    right: CHART.width - pad.right,
    top: pad.top,
    bottom: CHART.height - pad.bottom,
  };
  const type = definition.type ?? "line";
  const series = definition.series ?? [];
  const xLabel = definition.x?.label ?? "";
  const tips = createItemTips(id);
  const input: TickedChart = {
    ticks: definition.x?.ticks ?? [],
    series: series as Array<{ name: string; points: number[] }>,
    yAxis: definition.y,
    xLabel,
    tips,
  };
  const scatterInput = {
    series: series as Array<{ name: string; points: number[][] }>,
    xLabel,
    yAxis: definition.y,
    tips,
    definition,
  };
  const items = definition.items ?? [];
  const unit = definition.unit ?? "";
  const bodies: Record<
    NonNullable<MdmarkChartDefinition["type"]>,
    () => ChartBody
  > = {
    line: () => lineChart(input, box, { id, area: false }),
    area: () => lineChart(input, box, { id, area: true }),
    "stacked-area": () => stackedAreaChart(input, box, id),
    bar: () => barChart(input, box, id),
    "stacked-bar": () => stackedBarChart(input, box, id),
    "horizontal-bar": () => horizontalBarChart(input, box, id),
    pie: () => pieChart({ items, unit, id, donut: false, tips }),
    donut: () => pieChart({ items, unit, id, donut: true, tips }),
    scatter: () => scatterChart(scatterInput, box),
    bubble: () =>
      scatterChart(
        {
          ...scatterInput,
          bubble: { label: definition.size?.label ?? "", id },
        },
        box,
      ),
    radar: () => radarChart(input, id),
    combo: () => comboChart(definition, box, { id, tips }),
  };
  const body = bodies[type]();
  const label = `${definition.title}。${body.label}`;
  return {
    html: `<svg class="mdmark-diagram-wires" width="${CHART.width}" height="${CHART.height}" role="img" aria-label="${escapeHtml(label)}">${body.svg.join("")}</svg>`,
    width: CHART.width,
    height: CHART.height,
    tips: tips.html(),
    jumps: false,
    terms: false,
  };
}
