import { LABEL_METRICS } from "../../src/diagram/check.ts";
import { checkMapLayout } from "./check-map.ts";
import { layoutMap, MAP_LAYOUT, type LayoutOverride, type MapLayout, type ViewOptions } from "./layout.ts";
import { parseFlowchart } from "./parse.ts";
import { renderMapSvg } from "./render.ts";
import { SAMPLE_FLOW, SAMPLE_OVERRIDES } from "./sample.ts";

const RUNS = 10;

const isWide = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return !(code <= 0x7e || (code >= 0xff61 && code <= 0xff9f));
};

const estimate = (line: string): number =>
  [...line].reduce((sum, char) => sum + (isWide(char) ? LABEL_METRICS.nameSize : LABEL_METRICS.nameSize * 0.6), 0);

const box = (element: SVGGraphicsElement): { x: number; y: number; w: number; h: number } => {
  const b = element.getBBox();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
};

/** 描いた SVG の要素から、配置を読み直す（判定は描いた大きさで行う） */
const readDrawn = (svg: SVGSVGElement, source: MapLayout): MapLayout => {
  const ancestors = (element: Element): string[] => (element.getAttribute("data-ancestors") ?? "").split(" ").filter((id) => id !== "");
  const leaves = [...svg.querySelectorAll("g[data-leaf]")].map((g) => {
    const id = g.getAttribute("data-leaf") ?? "";
    const rect = g.querySelector("rect") as SVGRectElement;
    const lines = [...g.querySelectorAll("text")].map((text) => text.textContent ?? "");
    const placed = source.leaves.find((leaf) => leaf.id === id);
    return { id, ...box(rect), lines, faded: placed?.faded ?? false, ancestors: ancestors(g) };
  });
  const boxes = [...svg.querySelectorAll("g[data-box]")].map((g) => ({
    id: g.getAttribute("data-box") ?? "",
    title: "",
    ...box(g.querySelector("rect") as SVGRectElement),
    ancestors: ancestors(g),
  }));
  const edges = [...svg.querySelectorAll("polyline")].map((line) => {
    const id = line.getAttribute("data-edge") ?? "";
    const points = [...(line as SVGPolylineElement).points].map((p): [number, number] => [p.x, p.y]);
    return { id, from: line.getAttribute("data-from") ?? "", to: line.getAttribute("data-to") ?? "", count: 1, label: undefined, points };
  });
  return { width: source.width, height: source.height, leaves, boxes, edges };
};

type Operation = { name: string; options: ViewOptions; overrides: Record<string, LayoutOverride> };

export const runPoc = () => {
  const chart = parseFlowchart(SAMPLE_FLOW);
  const perspective = chart.edges.filter((edge) => edge.from === "api" || edge.to === "api").map((edge) => edge.id);
  const operations: Operation[] = [
    { name: "全体", options: {}, overrides: {} },
    { name: "上書き", options: {}, overrides: SAMPLE_OVERRIDES },
    { name: "中へ入る（app）", options: { enter: "app" }, overrides: SAMPLE_OVERRIDES },
    { name: "閉じる（be）", options: { collapsed: ["be"] }, overrides: SAMPLE_OVERRIDES },
    { name: "視点の切り替え（api の線）", options: { edges: perspective }, overrides: SAMPLE_OVERRIDES },
  ];
  const host = document.getElementById("host") as HTMLElement;
  const results = operations.map((operation) => {
    const times: number[] = [];
    let layout: MapLayout | undefined;
    for (let run = 0; run < RUNS; run++) {
      const start = performance.now();
      layout = layoutMap(chart, operation.options, operation.overrides);
      host.innerHTML = renderMapSvg(layout);
      // 描き直した要素の大きさを確定させる
      (host.querySelector("svg") as SVGSVGElement).getBBox();
      void host.offsetHeight;
      times.push(performance.now() - start);
    }
    const svg = host.querySelector("svg") as SVGSVGElement;
    const drawn = readDrawn(svg, layout as MapLayout);
    const issues = checkMapLayout(drawn);
    // ラベル: 描いた文字が箱に収まるか、見積もりとの差
    const labels = [...svg.querySelectorAll("g[data-leaf]")].flatMap((g) => {
      const rect = box(g.querySelector("rect") as SVGRectElement);
      return [...g.querySelectorAll("text")].map((text) => {
        const t = box(text as SVGTextElement);
        const fits = t.x >= rect.x && t.y >= rect.y && t.x + t.w <= rect.x + rect.w && t.y + t.h <= rect.y + rect.h;
        return { id: g.getAttribute("data-leaf"), line: text.textContent ?? "", fits, drawn: t.w, estimate: estimate(text.textContent ?? "") };
      });
    });
    return {
      name: operation.name,
      times,
      max: Math.max(...times),
      leaves: drawn.leaves.length,
      boxes: drawn.boxes.length,
      edges: drawn.edges.length,
      issues,
      labelsNotFit: labels.filter((label) => !label.fits),
      maxEstimateDiff: Math.max(...labels.map((label) => Math.abs(label.drawn - label.estimate))),
      labels,
      drawn,
    };
  });
  // 上書きの照合（全体の上書きの描画で見る）
  const over = results[1]?.drawn as MapLayout;
  const leaf = (id: string) => over.leaves.find((item) => item.id === id) as MapLayout["leaves"][number];
  const overrideChecks = {
    alignCacheWithGw: Math.abs(leaf("cache").x + leaf("cache").w / 2 - (leaf("gw").x + leaf("gw").w / 2)),
    auditBeforeUsers: leaf("audit").y < leaf("users").y,
    monitorAt: { x: leaf("monitor").x, y: leaf("monitor").y, expected: MAP_LAYOUT.margin },
  };
  host.innerHTML = renderMapSvg(layoutMap(chart, {}, SAMPLE_OVERRIDES));
  return { results: results.map(({ drawn, labels, ...rest }) => rest), longLabels: results[0]?.labels.filter((label) => ["api", "detail", "backup"].includes(label.id ?? "")), overrideChecks };
};

(window as unknown as { runPoc: typeof runPoc }).runPoc = runPoc;
