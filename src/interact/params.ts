import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import { legendFor, renderChart, renderLegendItems } from "../parts/diagram.ts";
import { paramChart, paramJson, renderCopyStatus } from "../parts/param.ts";
import { renumberIds } from "./diagrams.ts";

// 操作を付けた回数の通し番号。`id` を重ならせないために使う
let attachCounter = 0;

/** 操作できる部品 1 つに、スライダーの値でグラフを描き直す操作と、今の値を写す操作を付け、外す関数を返す */
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

  /** 前の知らせと選んで写す JSON を消す */
  const clearStatus = (): void => {
    status.textContent = "";
    delete status.dataset.state;
    fallback.hidden = true;
  };

  /** グラフを今の値の系列で描き直す。題と倍率は保つ */
  const redraw = (): void => {
    const chart = paramChart(definition, value);
    const part = renderChart(chart);
    if (stage) {
      stage.innerHTML = part.html;
    }
    if (legend) {
      legend.innerHTML = renderLegendItems("", legendFor(chart, part));
    }
  };

  input.addEventListener(
    "input",
    () => {
      value = Number(input.value);
      output.textContent = String(value);
      // 値を変えたら前の知らせは古くなる
      clearStatus();
      redraw();
    },
    { signal },
  );

  /** 写したか・写せなかったかを知らせる。写せなかったときは、選んで写せる JSON を出す */
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

/** `root` の中の操作できる部品ごとに、スライダーの値でグラフを描き直す操作と、今の値を写す操作を付ける。`definitions` は `div.mdmark-param` の並びと同じ順。付けた操作を外す関数を返す */
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
      // 同じページに文書を 2 つ以上描いても `id` が重ならないよう振り直す
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
