import type { DiffRevisionSpec } from "./dist-page.ts";

/** 差分の見本の文書の `id` */
export const DIFF_DOC_ID = "guide";

/** 新しい順の 3 つのリビジョン。`at` は古い順に 1 日ずつ進む */
export const DIFF_REVISIONS: DiffRevisionSpec[] = [
  { id: "r3", at: "2026-10-20T02:05:00Z", label: "件数を直す", author: "田中" },
  { id: "r2", at: "2026-10-19T07:40:00Z", label: "語を直す", author: "鈴木" },
  { id: "r1", at: "2026-10-18T00:12:00Z", label: "初版", author: "佐藤" },
];

/** 埋め込んだ HTML の範囲を、`html` のコードブロックで包む */
export function htmlRange(body: string): string {
  return ["<!-- html -->", "```html", body, "```", "<!-- /html -->"].join("\n");
}

/** メール欄の件数を引数で変える表 */
export function tableHtml(mail: number): string {
  return [
    "<table>",
    "  <thead><tr><th>窓口</th><th>件数</th></tr></thead>",
    "  <tbody>",
    `    <tr><td>メール</td><td>${mail}</td></tr>`,
    "    <tr><td>電話</td><td>95</td></tr>",
    "  </tbody>",
    "</table>",
  ].join("\n");
}

/** 見本の文書の本文。`word` の語、`legacy` の行、`phone` の行、表の件数を変える（空行は置かず、行の差を決まった対にする） */
export function sampleBody(options: {
  word: string;
  legacy: boolean;
  phone: boolean;
  mail: number;
  heading?: string;
}): string {
  const { word, legacy, phone, mail, heading = "窓口ごとの件数" } = options;
  return [
    "# 問い合わせ窓口の週の報告",
    "10 月の第 2 週に受けた問い合わせを、窓口ごとにまとめます。",
    `よくある質問の${word}は、担当者が週に 1 回確かめます。`,
    ...(legacy ? ["旧い注意の行です。"] : []),
    `## ${heading}`,
    htmlRange(tableHtml(mail)),
    "## 返し方",
    "自動返信は、よくある質問の表から答えを選びます。",
    ...(phone ? ["電話の問い合わせは、受けたその日のうちに返します。"] : []),
    "",
  ].join("\n");
}

/** `r1` から `r2` で、語 `差分` を `変更` に書き換え、行を 1 つ足し、別の行を 1 つ消す。`r2` から `r3` で、表のメール欄の件数を 120 から 150 に変える */
export const DIFF_CONTENTS: Record<string, string> = {
  r1: sampleBody({ word: "差分", legacy: true, phone: false, mail: 120 }),
  r2: sampleBody({ word: "変更", legacy: false, phone: true, mail: 120 }),
  r3: sampleBody({ word: "変更", legacy: false, phone: true, mail: 150 }),
};

/** 差分を載せるページの本文 */
export const DIFF_PAGE_MARKDOWN =
  "# 問い合わせ窓口の週の報告\n\n本文の段落。\n";

/** 描いた結果の上で色分けする見本の文書。ブロックごとに空行で区切り、`word` の語、`legacy` の段落、`phone` の段落を変える */
export function blocksBody(options: {
  word: string;
  legacy: boolean;
  phone: boolean;
}): string {
  const { word, legacy, phone } = options;
  return `${[
    "# 問い合わせ窓口の週の報告",
    `よくある質問の${word}は、担当者が週に 1 回確かめます。`,
    "| 窓口 | 件数 |\n| --- | --- |\n| メール | 120 |",
    ...(legacy ? ["旧い注意の段落です。"] : []),
    "自動返信は、よくある質問の表から答えを選びます。",
    ...(phone ? ["電話の問い合わせは、受けたその日のうちに返します。"] : []),
  ].join("\n\n")}\n`;
}

/** 色分けの前の見本の文書 */
export const BLOCKS_BEFORE = blocksBody({
  word: "差分",
  legacy: true,
  phone: false,
});

/** 色分けの後の見本の文書: 段落の語を 1 つ書き換え、表の後ろの段落を 1 つ消し、末尾に段落を 1 つ足す。見出しと表と最後から 2 番目の段落は変えない */
export const BLOCKS_AFTER = blocksBody({
  word: "変更",
  legacy: false,
  phone: true,
});
