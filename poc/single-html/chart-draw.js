// PoC: jsDelivr の +esm の Chart.js と zoom のプラグインを使い、印の場所に棒グラフを描くモジュール
import { Chart, registerables } from "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/+esm";
import zoomPlugin from "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.2.0/+esm";

Chart.register(...registerables, zoomPlugin);

/** 印の場所の中身を canvas に替えてグラフを描く */
export function draw(slot, args) {
  const canvas = document.createElement("canvas");
  slot.replaceChildren(canvas);
  new Chart(canvas, {
    type: args[0] ?? "bar",
    data: {
      labels: ["A", "B", "C"],
      datasets: [{ label: "件数", data: [3, 5, 2] }],
    },
    options: { animation: false },
  });
}