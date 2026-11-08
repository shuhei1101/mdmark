// フロントマターの表示の部品のカタログ: [data-catalog] の要素ごとに、状態の Markdown を配布物の mount で描く。
// data-catalog の値は下の STATES のキー、data-open があれば折りたたみを開いて描く

import { mount } from "../../../../dist/index.js";

/** 案 A のフロントマターの表示を、キーと値の組から組み立てる */
const tableDisplay = (entries) =>
  [
    "<!-- details: フロントマター -->",
    "",
    "<!-- table: plain -->",
    "",
    "| キー | 値 |",
    "| --- | --- |",
    ...entries.map(([key, value]) => `| \`${key}\` | ${value.replaceAll("|", "\\|").replaceAll("\n", "<br>")} |`),
    "",
    "<!-- /table -->",
    "",
    "<!-- /details -->",
  ].join("\n");

/** 案 B のフロントマターの表示を、フロントマターの中身から組み立てる */
const codeDisplay = (source) =>
  ["<!-- details: フロントマター -->", "", "```yaml", source, "```", "", "<!-- /details -->"].join("\n");

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
  mount(el, { markdown: `${markdown}\n\n# 問い合わせの受付\n\n本文の先頭の段落。` });
  const details = el.querySelector(".mdmark-content > details");
  details?.classList.add("mdmark-frontmatter");
  if (el.hasAttribute("data-open")) details?.setAttribute("open", "");
}
