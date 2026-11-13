// #550 の文書の場面: 配布物の mount で、比較元の Markdown を指定して描き、
// 右側の目次の変わったセクションの項目に変更のマーカーを付け、長文の列の見出しから並べ替えを除外する（実装の前の見た目の案）。
// URL の ?mode= で目次の出し方（hover・fixed）、?scheme= で明暗（light・dark）、?base=off で比較元の解除を選ぶ

import { mount } from "../../../../../dist/index.js";

/** URL に無いときの値 */
const DEFAULTS = { mode: "hover", scheme: "light", base: "on" };

const params = new URLSearchParams(location.search);
const state = Object.fromEntries(
  Object.entries(DEFAULTS).map(([key, value]) => [key, params.get(key) ?? value]),
);

// モック専用の操作列: 行き先の URL と今の値の aria-current を適用する
for (const link of document.querySelectorAll("[data-scene-axis]")) {
  const next = { ...state, [link.dataset.sceneAxis]: link.dataset.sceneValue };
  const query = Object.entries(next)
    .filter(([key, value]) => DEFAULTS[key] !== value)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  link.href = query === "" ? "index.html" : `?${query}`;
  if (state[link.dataset.sceneAxis] === link.dataset.sceneValue) {
    link.setAttribute("aria-current", "page");
  }
}

const long =
  "比較元から見出しの下のブロックが追加・変更・削除されたセクションの項目に、変更のマーカーを付けて読者に知らせる。";

const base = `# 右側の目次の変更のマーカー

## セクション A（変えていない）

変えていない段落。

## セクション B（段落を書き換えた）

書き換える前の段落。

### B の小見出し（変えていない）

変えていない段落。

## セクション C（段落を削除した）

削除する段落。

## 長文の列を持つ表

<!-- table: {"kind": "data"} -->

| 名前 | 更新日 | 説明 |
| --- | --- | --- |
| 目次 | 2026-11-01 | ${long} |
| 表 | 2026-11-05 | ${long} |
| 差分 | 2026-11-12 | ${long} |

<!-- /table -->
`;

const markdown = base
  .replace("書き換える前の段落。", "書き換えた後の段落。")
  .replace("\n削除する段落。\n", "\n")
  .concat(`
## セクション D（追加した）

追加した段落。
`);

const el = document.querySelector("#doc");
mount(el, {
  markdown,
  baseMarkdown: state.base === "on" ? base : null,
  config: { "side-toc": { mode: state.mode }, colorScheme: state.scheme },
});

/** 変更のマーカーの読み上げの文言 */
const CHANGED_LABEL = "変更";

// 色分けしたブロックを持つ見出しと、その祖先の見出しを、変わったセクションとして集める
const headings = [...el.querySelectorAll(".mdmark-content :is(h1, h2, h3)")];
const changed = new Set();
for (const block of el.querySelectorAll(".mdmark-diff-block")) {
  const own = block.querySelector("h1, h2, h3");
  const before = headings.filter(
    (heading) => block.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_PRECEDING,
  );
  let target = own ?? before.at(-1);
  while (target) {
    changed.add(target.id);
    const level = Number(target.tagName[1]);
    target = before.filter((heading) => Number(heading.tagName[1]) < level).at(-1);
  }
}

// 目次の項目と右端の線に変更のマーカーを付ける
for (const link of el.querySelectorAll(".mdmark-side-toc-list a[data-heading-id]")) {
  if (!changed.has(link.dataset.headingId)) continue;
  link.dataset.changed = "";
  // 読み上げの文言はリンクの aria-label に持たせ、リンクの文字（目次を出すボタンの今いる見出しに写す文字）には足さない
  link.setAttribute("aria-label", `${link.textContent}（${CHANGED_LABEL}）`);
  link.insertAdjacentHTML("beforeend", '<span class="mock-toc-changed" aria-hidden="true"></span>');
}
const bars = el.querySelectorAll(".mdmark-side-toc-bar");
headings.forEach((heading, index) => {
  if (changed.has(heading.id)) bars[index]?.setAttribute("data-changed", "");
});

// 長文の列（data-long）の見出しから並べ替えのボタンを除外し、ほかの機能は残す
for (const table of el.querySelectorAll(".mdmark-table[data-long]")) {
  const long = new Set(table.dataset.long.split(" ").map(Number));
  table.querySelectorAll("thead tr:last-child th").forEach((th, index) => {
    const sort = th.querySelector(".mdmark-sort");
    if (!long.has(index) || sort === null) return;
    const label = document.createElement("span");
    label.className = "mdmark-th-label";
    label.textContent = sort.textContent;
    sort.replaceWith(label);
  });
}
