import type { MdmarkChartDefinition, MdmarkParamDefinition } from "../diagram/definition.ts";
/** 写した結果 */
export type CopyState = "none" | "copied" | "failed";
/** スライダーの値を表の見出しの文字にする。小数の誤差は落とす */
export declare function knobKey(value: number): string;
/** 今の値を 2 字下げの JSON にする: `{"{key}": {"name": "{label}", "value": {値}}}` */
export declare function paramJson(knob: MdmarkParamDefinition["knob"], value: number): string;
/** グラフの定義: 今の値と既定の値の 2 つの系列を、定義の `table` の点で描く */
export declare function paramChart(definition: MdmarkParamDefinition, value: number): MdmarkChartDefinition;
/** 写した結果の知らせの中身（アイコンと文言） */
export declare function renderCopyStatus(state: "copied" | "failed"): string;
/** 操作できる部品を描く: 題・スライダー・今の値・写すボタン・知らせ・写せなかったときの `pre` と、今の値と既定の値の系列のグラフ */
export declare function renderParam(definition: MdmarkParamDefinition, state: {
    value?: number;
    copy?: CopyState;
    id: string;
}): string;
