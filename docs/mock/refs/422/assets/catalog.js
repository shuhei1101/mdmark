// フロントマターの表示の部品のカタログ: [data-catalog] の要素ごとに、状態の Markdown を配布物の mount で描く。
// data-catalog の値は下の STATES のキー、data-open があれば折りたたみを開いて描く

import { mount } from "../../../../../dist/index.js";

/** HTML の特殊文字を文字参照にする */
const escapeHtml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** 案 A のフロントマターの表示を、キーと値の組から組み立てる（値の改行はそのまま折り返して出す） */
const tableDisplay = (entries) =>
  [
    "<details>",
    "<summary>フロントマター</summary>",
    "<table>",
    "<tbody>",
    ...entries.map(
      ([key, value]) =>
        `<tr><th scope="row"><code>${escapeHtml(key)}</code></th><td>${escapeHtml(value).replaceAll("\n", "<br>")}</td></tr>`,
    ),
    "</tbody>",
    "</table>",
    "</details>",
  ].join("\n");

/** 案 B のフロントマターの表示を、フロントマターの中身から組み立てる */
const codeDisplay = (source) =>
  ["<details>", "<summary>フロントマター</summary>", "", "```yaml", source, "```", "", "</details>"].join("\n");

const SHORT = [
  ["title", "問い合わせの受付"],
  ["tags", "[サポート, 手順]"],
];
const NESTED = [
  ["title", "問い合わせの受付"],
  ["owner", "name: サポート担当\nteam: 窓口"],
  ["steps", "- 受け付ける\n- 振り分ける"],
];
const LONG = [
  ["title", "問い合わせの受付"],
  [
    "description",
    "問い合わせを受けてから、担当へ回すか一次回答を返すまでの流れ。料金・不具合・使い方の問い合わせで回す先が変わり、担当がいないときは窓口が一次回答を返してから担当へ引き継ぐ",
  ],
  ["source", "https://example.com/support/handbook/inquiries/reception-and-routing-of-incoming-requests"],
];

/** 状態ごとの Markdown（フロントマターの表示と、その後ろの本文の先頭） */
const STATES = {
  "a-short": tableDisplay(SHORT),
  "a-nested": tableDisplay(NESTED),
  "a-long": tableDisplay(LONG),
  "b-short": codeDisplay("title: 問い合わせの受付\ntags: [サポート, 手順]"),
  "b-nested": codeDisplay("title: 問い合わせの受付\nowner:\n  name: サポート担当\n  team: 窓口\nsteps:\n  - 受け付ける\n  - 振り分ける"),
};

for (const el of document.querySelectorAll("[data-catalog]")) {
  const markdown = STATES[el.dataset.catalog];
  if (markdown === undefined) throw new Error(`data-catalog の状態がありません: ${el.dataset.catalog}`);
  // 開いた状態は details の open で描く
  const display = el.hasAttribute("data-open") ? markdown.replace("<details>", "<details open>") : markdown;
  // 1 ページに複数の文書を描くため、右側の目次は描かない
  mount(el, {
    markdown: `${display}\n\n# 問い合わせの受付\n\n本文の先頭の段落。`,
    config: { features: { "side-toc": false } },
  });
}

// 描き終えた後に、フロントマターの表示を示す class を付ける（実装で付ける class の見本）
requestAnimationFrame(() => {
  for (const details of document.querySelectorAll("[data-catalog] details")) {
    details.classList.add("mdmark-frontmatter");
  }
});
