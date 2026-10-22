import type { MdmarkFlowDefinition } from "../../src/diagram/definition.ts";
import { sampleBlock, wrapDirective } from "./diagram.ts";

/** 棒のグラフの定義: 系列 2 つ・項目 4 つ。縦の軸の範囲を書かない */
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

/** 散布図の定義: 系列 1 つ・点 6 つ（横と縦がどちらも数値）。軸の範囲を書かない */
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

/** フロー図の箱 `mcp`（名前は `窓口の MCP`）に足す `hint` */
export const NODE_HINT =
  "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読まず、下書きの ID で頼まれた操作をする";

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

/** チャートの定義を `<mdmark-chart>` で包む */
export function chartElement(json: string): string {
  return `<mdmark-chart>\n${json}\n</mdmark-chart>`;
}

/** 見本のフロー図の箱 `mcp` に `io` を持たない `hint` だけを足した、フロー図の部品の文書 */
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

/** 見本の HTML: 文字に色を付けた箱 2 つを横に並べる `div`、`data-hint` を付けた箱、用語を含む文、`script` 要素、`onclick` を持つボタン、チャート 1 つを持つ */
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
