import type { MdmarkFlowDefinition } from "../../../src/diagram/definition.ts";
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
      { name: "よくある質問で答えた", value: 186 },
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

/** 見本の箱の hint を持つフロー図の定義（`inquiry-hint`）の JSON: `inquiry` の箱 `mcp` に、`io` を持たない `hint` だけを足す */
export const INQUIRY_HINT_TEXT: string = JSON.stringify(inquiryHint(), null, 2);

/** `inquiry` の箱 `mcp` に `hint` を足した定義 */
function inquiryHint(): MdmarkFlowDefinition {
  const definition = parsed<MdmarkFlowDefinition>(INQUIRY_TEXT);
  const node = definition.nodes.find((candidate) => candidate.id === "mcp");
  if (node === undefined) {
    throw new Error("見本の箱 mcp が無い");
  }
  node.hint =
    "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読まず、下書きの ID で頼まれた操作をする";
  return definition;
}

/** `<!-- html -->` の範囲に、`html` のコードブロック 1 つを置いた文書にする。`head` は文書の先頭に置く行（印など） */
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
