import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import { renderChart } from "../parts/chart.ts";
import { legendFor, renderLegendItems } from "../parts/diagram.ts";
import { paramChart, paramJson, renderCopyStatus } from "../parts/param.ts";
import { DIAGRAM_REDRAW_EVENT, renumberIds } from "./diagrams.ts";

// 操作を付けた回数の通し番号。`id` を重ならせないために使用する
let attachCounter = 0;

/** 操作できる部品 1 つに、スライダーの値でグラフを再描画する操作と、今の値を写す操作を付け、削除する関数を返却する */
function attachParam(
  root: HTMLElement,
  definition: MdmarkParamDefinition,
): () => void {
  const input = root.querySelector<HTMLInputElement>('input[type="range"]');
  const output = root.querySelector<HTMLOutputElement>(
    ".mdmark-param-knob output",
  );
  const copyButton =
    root.querySelector<HTMLButtonElement>(".mdmark-param-copy");
  const status = root.querySelector<HTMLElement>(".mdmark-param-status");
  const fallback = root.querySelector<HTMLElement>(".mdmark-param-fallback");
  const code = fallback?.querySelector("code");
  const stage = root.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const legend = root.querySelector<HTMLElement>(".mdmark-diagram-legend");
  if (!input || !output || !copyButton || !status || !fallback || !code) {
    return () => {};
  }
  const controller = new AbortController();
  const { signal } = controller;
  let value = Number(input.value);

  /** 前の通知と選んで写す JSON を削除する */
  const clearStatus = (): void => {
    status.textContent = "";
    delete status.dataset.state;
    fallback.hidden = true;
  };

  // 再描画するたびの通し番号。項目のツールチップの `id` を重ならせないために使用する
  let redraws = 0;
  const figure = root.querySelector<HTMLElement>("figure.mdmark-diagram");

  /** グラフを今の値の系列で再描画する。タイトルと倍率は保ち、項目のツールチップを入れ替える */
  const redraw = (): void => {
    const chart = paramChart(definition, value);
    redraws += 1;
    const prefix =
      root.querySelector(".mdmark-param-title")?.id.replace(/-title$/, "") ??
      "mdmark-param";
    const part = renderChart(chart, `${prefix}-redraw-${redraws}`);
    if (stage) {
      stage.innerHTML = part.html;
    }
    const viewport = figure?.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    if (figure && viewport) {
      for (const tip of figure.querySelectorAll(".mdmark-diagram-tip")) {
        tip.remove();
      }
      viewport.insertAdjacentHTML("afterend", part.tips);
      figure.dispatchEvent(new Event(DIAGRAM_REDRAW_EVENT));
    }
    if (legend) {
      legend.innerHTML = renderLegendItems("", legendFor(chart));
    }
  };

  input.addEventListener(
    "input",
    () => {
      value = Number(input.value);
      output.textContent = String(value);
      // 値を変えたら前の通知は古くなる
      clearStatus();
      redraw();
    },
    { signal },
  );

  /** コピーしたか・写せなかったかを通知する。写せなかったときは、選んで写せる JSON を出す */
  const notify = (state: "copied" | "failed", json: string): void => {
    status.dataset.state = state;
    status.innerHTML = renderCopyStatus(state);
    fallback.hidden = state === "copied";
    code.textContent = json;
  };

  copyButton.addEventListener(
    "click",
    async () => {
      const json = paramJson(definition.knob, value);
      try {
        await navigator.clipboard.writeText(json);
        notify("copied", json);
      } catch {
        notify("failed", json);
      }
    },
    { signal },
  );

  return () => controller.abort();
}

/** `root` の中の操作できる部品ごとに、スライダーの値でグラフを再描画する操作と、今の値を写す操作を付ける。`definitions` は `div.mdmark-param` の並びと同じ順。付けた操作を削除する関数を返却する */
export function attachParams(
  root: HTMLElement,
  definitions: MdmarkParamDefinition[],
): () => void {
  attachCounter += 1;
  const detachers: Array<() => void> = [];
  root
    .querySelectorAll<HTMLElement>(".mdmark-param")
    .forEach((param, index) => {
      const definition = definitions[index];
      if (!definition) {
        return;
      }
      const title = param.getAttribute("aria-labelledby") ?? "";
      // 同じページに文書を 2 つ以上描いても `id` が重ならないようもう一度振る
      renumberIds(
        param,
        title.replace(/-title$/, ""),
        `mdmark-param-${attachCounter}-${index}`,
      );
      detachers.push(attachParam(param, definition));
    });
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
