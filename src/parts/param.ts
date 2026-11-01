import { DEFAULT_LABELS } from "../config.ts";
import type {
  MdmarkChartDefinition,
  MdmarkParamDefinition,
} from "../diagram/definition.ts";
import { renderDiagram } from "./diagram.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 写した結果 */
export type CopyState = "none" | "copied" | "failed";

/** 写した結果の知らせの文言 */
const COPY_MESSAGES = {
  copied: "クリップボードに写しました",
  failed: "クリップボードへ書けませんでした。下の JSON を選んで写してください",
};

/** スライダーの値を表の見出しの文字にする。小数の誤差は落とす */
export function knobKey(value: number): string {
  return String(Number(value.toFixed(10)));
}

/** 今の値を 2 字下げの JSON にする: `{"{key}": {"name": "{label}", "value": {値}}}` */
export function paramJson(
  knob: MdmarkParamDefinition["knob"],
  value: number,
): string {
  return JSON.stringify({ [knob.key]: { name: knob.label, value } }, null, 2);
}

/** グラフの定義: 今の値と既定の値の 2 つの系列を、定義の `table` の点で描く */
export function paramChart(
  definition: MdmarkParamDefinition,
  value: number,
): MdmarkChartDefinition {
  const { knob, table, chart } = definition;
  return {
    ...chart,
    series: [
      { name: `今の値（${value}）`, points: table[knobKey(value)] ?? [] },
      {
        name: `既定の値（${knob.value}）`,
        points: table[knobKey(knob.value)] ?? [],
      },
    ],
  };
}

/** 写した結果の知らせの中身（アイコンと文言） */
export function renderCopyStatus(state: "copied" | "failed"): string {
  const icon = iconSvg(state === "copied" ? "check" : "circle-alert");
  return `${icon}${escapeHtml(COPY_MESSAGES[state])}`;
}

/** 操作できる部品を描く: 題・スライダー・今の値・写すボタン・知らせ・写せなかったときの `pre` と、今の値と既定の値の系列のグラフ */
export function renderParam(
  definition: MdmarkParamDefinition,
  state: { value?: number; copy?: CopyState; id: string; copyLabel?: string },
): string {
  const { knob } = definition;
  const value = state.value ?? knob.value;
  const copy = state.copy ?? "none";
  const id = escapeHtml(state.id);
  const status =
    copy === "none"
      ? '<p class="mdmark-param-status" role="status"></p>'
      : `<p class="mdmark-param-status" role="status" data-state="${copy}">${renderCopyStatus(copy)}</p>`;
  const fallback = `<pre class="mdmark-param-fallback"${copy === "failed" ? "" : ' hidden="hidden"'} tabindex="0" aria-label="写す JSON"><code>${copy === "failed" ? escapeHtml(paramJson(knob, value)) : ""}</code></pre>`;
  const chart = renderDiagram({
    kind: "chart",
    definition: paramChart(definition, value),
    id: `${state.id}-chart`,
  });
  return `<div class="mdmark-param" role="group" aria-labelledby="${id}-title"><p class="mdmark-param-title" id="${id}-title">${escapeHtml(definition.title)}</p><div class="mdmark-param-controls"><div class="mdmark-param-knob"><label for="${id}-knob">${escapeHtml(knob.label)}</label><output for="${id}-knob" id="${id}-value">${value}</output><input type="range" id="${id}-knob" min="${knob.min}" max="${knob.max}" step="${knob.step}" value="${value}"><span class="mdmark-param-range" aria-hidden="true"><small>${knob.min}</small><small>${knob.max}</small></span></div><div class="mdmark-param-actions"><button class="mdmark-param-copy" type="button">${iconSvg("copy")}${escapeHtml(state.copyLabel ?? DEFAULT_LABELS.paramCopy)}</button>${status}</div>${fallback}</div>${chart}</div>`;
}
