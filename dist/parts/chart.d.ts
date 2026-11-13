import type { MdmarkChartDefinition, MdmarkChartType } from "../diagram/definition.ts";
import { type DiagramPart } from "./diagram.ts";
/** グラフの点の形状より広い、ツールチップを取得する透明の円の半径（px） */
export declare const ITEM_HIT_RADIUS = 12;
/** グラフの項目の値の文（部品設計『図のツールチップ』の `value`） */
export declare function chartItemText(item: {
    type: MdmarkChartType;
    tick?: string;
    value?: number;
    point?: number[];
    percent?: number;
    definition: MdmarkChartDefinition;
}): string;
/** 系列の点の形状 */
type PointShape = "circle" | "square" | "triangle" | "diamond" | "triangle-down" | "cross";
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
export declare const SERIES_STYLES: readonly SeriesStyle[];
/** 系列の点のマーカーの大きさ（px）。散布図は点だけで読み込むので大きくする */
export declare const POINT_SIZE = 4.5;
export declare const SCATTER_POINT_SIZE = 5.5;
/** 系列の点のマーカー（`SERIES_STYLES` の点の形状） */
export declare function pointSvg(series: number, x: number, y: number, size?: number): string;
/** 系列の塗りの模様（`SERIES_STYLES` の塗りの模様）の `pattern` */
export declare function fillPatterns(id: string): string;
/** グラフを種類ごとに描く。定義は `readDefinition` が構造を確認したもの。`id` は塗りの模様の `pattern` の `id` の頭 */
export declare function renderChart(definition: MdmarkChartDefinition, id: string): DiagramPart;
export {};
