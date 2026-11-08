import type { MdmarkFlowDefinition } from "../../src/diagram/definition.ts";
import { sampleBlock, wrapDirective } from "./diagram.ts";

/** 棒のグラフの定義: 系列 2 つ・項目 4 つ。縦の軸の範囲を記載しない */
export const BAR_TEXT: string = JSON.stringify(
  {
    type: "bar",
    title: "窓口ごとの問い合わせの件数",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    x: { label: "窓口", ticks: ["メール", "フォーム", "チャット", "電話"] },
    y: { label: "件" },
    series: [
      { name: "自動返信", points: [124, 86, 57, 12] },
      { name: "担当者", points: [38, 41, 63, 95] },
    ],
  },
  null,
  2,
);

/** 円のグラフの定義: 項目 3 つ */
export const PIE_TEXT: string = JSON.stringify(
  {
    type: "pie",
    title: "返信の種類の割合",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    unit: " 件",
    items: [
      { name: "よくある質問で答えた", value: 186 },
      { name: "担当者へ回した", value: 92 },
      { name: "返信しなかった", value: 22 },
    ],
  },
  null,
  2,
);

/** 散布図の定義: 系列 1 つ・点 6 つ（横と縦がどちらも数値）。軸の範囲を記載しない */
export const SCATTER_TEXT: string = JSON.stringify(
  {
    type: "scatter",
    title: "本文の長さと返信までの時間",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    x: { label: "本文の長さ（字）" },
    y: { label: "分" },
    series: [
      {
        name: "自動返信",
        points: [
          [120, 6],
          [260, 9],
          [410, 11],
          [580, 14],
          [730, 13],
          [900, 18],
        ],
      },
    ],
  },
  null,
  2,
);

/** フロー図のノード `mcp`（名前は `窓口の MCP`）に追加する `hint` */
export const NODE_HINT =
  "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読まず、下書きの ID で頼まれた操作をする";

/** `<!-- html -->` の範囲に、`html` のコードブロック 1 つを配置した文書にする。`head` は文書の先頭に配置する行（マーカーなど） */
export function wrapHtml(html: string, head = ""): string {
  return [
    ...(head === "" ? [] : [head, ""]),
    "<!-- html -->",
    "",
    "```html",
    html,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
}

/** チャートの定義を `<mdmark-chart>` で包む */
export function chartElement(json: string): string {
  return `<mdmark-chart>\n${json}\n</mdmark-chart>`;
}

/** 見本のフロー図のノード `mcp` に `io` を持たない `hint` だけを追加した、フロー図の部品の文書 */
export async function hintFlowMarkdown(): Promise<string> {
  const definition = JSON.parse(
    await sampleBlock("inquiry"),
  ) as MdmarkFlowDefinition;
  const node = definition.nodes.find((candidate) => candidate.id === "mcp");
  if (node === undefined) {
    throw new Error("見本の箱 mcp が無い");
  }
  node.hint = NODE_HINT;
  return wrapDirective("flow", JSON.stringify(definition, null, 2));
}

/** 見本の HTML: 文字に色を付けたノード 2 つを横に並べる `div`、`data-hint` を付けたノード、用語を含む文、`script` 要素、`onclick` を持つボタン、チャート 1 つを持つ */
export function sampleHtml(options: { script?: boolean } = {}): string {
  return [
    "<h2>問い合わせの集計</h2>",
    '<div style="display: flex; gap: 12px">',
    '  <div style="color: rgb(200, 0, 0)">一つ目の箱</div>',
    '  <div style="color: rgb(0, 0, 200)">二つ目の箱</div>',
    "</div>",
    '<div data-hint="返信の種類を 1 つ選ぶ" style="padding: 1rem 2rem">自動返信の箱</div>',
    "<div>ヒントの無い箱</div>",
    "<p>返信の種類は意思決定モデルが決める。</p>",
    ...(options.script === false
      ? []
      : [
          "<script>window.__mdmarkScriptRan = true</script>",
          '<button onclick="window.__mdmarkScriptRan = true">押す</button>',
        ]),
    chartElement(BAR_TEXT),
  ].join("\n");
}

/** 横の軸の目盛り 3 つと、2 つの系列を持つグラフの定義（`type` を指定する） */
export function twoSeriesChart(type: string): Record<string, unknown> {
  return {
    type,
    title: `${type} のグラフ`,
    scope: "10 月",
    updated: "2026-10-31",
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件" },
    series: [
      { name: "メール", points: [3, 5, 2] },
      { name: "フォーム", points: [4, 1, 6] },
    ],
  };
}

/** 項目 2 つのドーナツのグラフの定義 */
export const DONUT_CHART: Record<string, unknown> = {
  type: "donut",
  title: "返信の種類",
  scope: "10 月",
  updated: "2026-10-31",
  items: [
    { name: "自動", value: 3 },
    { name: "担当者", value: 5 },
  ],
};

/** 1 つ目の系列を棒、2 つ目の系列を折れ線にした組み合わせのグラフの定義 */
export const COMBO_CHART: Record<string, unknown> = {
  type: "combo",
  title: "件数と解決数",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "週", ticks: ["1", "2", "3"] },
  y: { label: "件" },
  series: [
    { name: "件数", as: "bar", points: [3, 5, 2] },
    { name: "解決数", as: "line", points: [4, 1, 6] },
  ],
};

/** 系列 2 つ・点 2 つずつのバブルのグラフの定義 */
export const BUBBLE_CHART: Record<string, unknown> = {
  type: "bubble",
  title: "長さと時間と件数",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "字" },
  y: { label: "分" },
  size: { label: "件数" },
  series: [
    {
      name: "自動",
      points: [
        [1, 2, 3],
        [2, 3, 4],
      ],
    },
    {
      name: "担当者",
      points: [
        [3, 1, 2],
        [4, 2, 5],
      ],
    },
  ],
};

/** `count` 個の系列と、点 5 つずつを持つ `type`（折れ線か棒）のグラフの定義 */
export function manySeriesChart(
  type: "line" | "bar",
  count: number,
): Record<string, unknown> {
  return {
    type,
    title: `${count} つの系列の${type === "line" ? "折れ線" : "棒"}`,
    scope: "10 月",
    updated: "2026-10-31",
    x: { label: "週", ticks: ["1", "2", "3", "4", "5"] },
    y: { label: "件" },
    series: Array.from({ length: count }, (_, index) => ({
      name: `窓口${index + 1}`,
      points: [1, 2, 3, 4, 5].map((point) => point + index),
    })),
  };
}

/** 横の目盛り `1月`〜`4月`・系列 2 つの、折れ線か棒のグラフの定義 */
export function monthlyChart(type: "line" | "bar"): Record<string, unknown> {
  return {
    type,
    title: type === "line" ? "月ごとの返信の件数" : "月ごとの起票の件数",
    scope: "1 月から 4 月",
    updated: "2026-11-05",
    x: { label: "月", ticks: ["1月", "2月", "3月", "4月"] },
    y: { label: "件" },
    series: [
      { name: "自動返信", points: [12, 38, 25, 41] },
      { name: "担当者", points: [8, 14, 19, 22] },
    ],
  };
}

/** 項目 `A`・`B`・`C`（値 50・30・20）の円のグラフの定義 */
export const ABC_PIE_CHART: Record<string, unknown> = {
  type: "pie",
  title: "返信の種類の割合",
  scope: "1 月から 4 月",
  updated: "2026-11-05",
  items: [
    { name: "A", value: 50 },
    { name: "B", value: 30 },
    { name: "C", value: 20 },
  ],
};

/** 『図を描く』の正常シナリオ（追加したグラフの種類）の 8 つのグラフの定義 */
export const ADDED_CHARTS: Array<Record<string, unknown>> = [
  twoSeriesChart("area"),
  twoSeriesChart("stacked-bar"),
  twoSeriesChart("stacked-area"),
  twoSeriesChart("horizontal-bar"),
  DONUT_CHART,
  twoSeriesChart("radar"),
  BUBBLE_CHART,
  COMBO_CHART,
];
