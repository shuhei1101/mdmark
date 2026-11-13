import { INQUIRY_TEXT, parsed } from "./diagrams.ts";

/** 見本の棒のグラフの定義（`inquiry-count`）の JSON: 系列 2 つ・項目 4 つ。縦の軸の範囲を省く */
export const INQUIRY_COUNT_TEXT: string = JSON.stringify(
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

/** 見本の円のグラフの定義（`reply-kind`）の JSON: 項目 3 つ */
export const REPLY_KIND_TEXT: string = JSON.stringify(
  {
    type: "pie",
    title: "返信の種類の割合",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    unit: " 件",
    items: [
      { name: "よくある質問で回答した", value: 186 },
      { name: "担当者へ回した", value: 92 },
      { name: "返信しなかった", value: 22 },
    ],
  },
  null,
  2,
);

/** 見本の散布図の定義（`length-time`）の JSON: 系列 2 つ・点 6 つずつ。横と縦の範囲を省く */
export const LENGTH_TIME_TEXT: string = JSON.stringify(
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
      {
        name: "担当者",
        points: [
          [150, 28],
          [300, 35],
          [450, 41],
          [620, 39],
          [800, 52],
          [960, 58],
        ],
      },
    ],
  },
  null,
  2,
);

/** 見本のノードの hint を持つフロー図の定義（`inquiry-hint`）の JSON: `inquiry` のノード `mcp` に、`io` を持たない `hint` だけを追加する */
export const INQUIRY_HINT_TEXT: string = JSON.stringify(inquiryHint(), null, 2);

/** `inquiry` のノード `mcp` に `hint` を追加した定義 */
function inquiryHint(): { nodes: Array<{ id: string; hint?: string }> } {
  const definition = parsed<{ nodes: Array<{ id: string; hint?: string }> }>(
    INQUIRY_TEXT,
  );
  const node = definition.nodes.find((candidate) => candidate.id === "mcp");
  if (node === undefined) {
    throw new Error("見本のノード mcp が無い");
  }
  node.hint =
    "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読み込まず、下書きの ID で頼まれた操作をする";
  return definition;
}

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

/** タイトル・範囲・更新日 */
const CHART_BASE = {
  title: "追加したグラフの種類",
  scope: "10 月の第 2 週",
  updated: "2026-11-03",
};

/** 窓口の 2 つの目盛りと、2 つの系列 */
const TICKED_CHART = {
  ...CHART_BASE,
  x: { label: "窓口", ticks: ["メール", "電話"] },
  y: { label: "件" },
  series: [
    { name: "自動返信", points: [3, 1] },
    { name: "担当者", points: [4, 2] },
  ],
};

/** インターフェース定義『文書をHTML文字列にする』の「正常系（追加したグラフの種類）」の 9 つの定義（追加した 8 つの種類と、系列 6 つの `line`） */
export const ADDED_CHART_DEFINITIONS: Array<Record<string, unknown>> = [
  { ...TICKED_CHART, type: "area" },
  { ...TICKED_CHART, type: "stacked-bar" },
  { ...TICKED_CHART, type: "stacked-area" },
  { ...TICKED_CHART, type: "horizontal-bar" },
  {
    ...CHART_BASE,
    type: "donut",
    unit: " 件",
    items: [
      { name: "よくある質問で回答した", value: 186 },
      { name: "担当者へ回した", value: 92 },
    ],
  },
  {
    ...CHART_BASE,
    type: "radar",
    x: { label: "観点", ticks: ["速さ", "正確さ", "丁寧さ"] },
    y: { label: "点", min: 0, max: 5, step: 1 },
    series: [
      { name: "自動返信", points: [5, 3, 2] },
      { name: "担当者", points: [2, 5, 5] },
    ],
  },
  {
    ...CHART_BASE,
    type: "bubble",
    x: { label: "本文の長さ（字）" },
    y: { label: "分" },
    size: { label: "件数" },
    series: [
      {
        name: "自動返信",
        points: [
          [120, 6, 4],
          [260, 9, 16],
        ],
      },
      {
        name: "担当者",
        points: [
          [300, 30, 9],
          [500, 40, 1],
        ],
      },
    ],
  },
  {
    ...CHART_BASE,
    type: "combo",
    x: { label: "窓口", ticks: ["メール", "電話"] },
    y: { label: "件" },
    series: [
      { name: "件数", points: [3, 1], as: "bar" },
      { name: "割合", points: [4, 2], as: "line" },
    ],
  },
  {
    ...CHART_BASE,
    type: "line",
    x: { label: "週", ticks: ["1", "2", "3"] },
    y: { label: "件" },
    series: [1, 2, 3, 4, 5, 6].map((n) => ({
      name: `系列 ${n}`,
      points: [n, n + 1, n + 2],
    })),
  },
];
