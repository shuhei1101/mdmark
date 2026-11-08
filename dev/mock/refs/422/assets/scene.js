// フロントマターを持つ文書を見る場面: 配布物の mount で文書を描き、この PR の描き方（フロントマターの除外と表示）をモックの中で当てる。
// html の data-variant で表示の形式（a: キーと値の表・b: yaml のコードブロック）を選ぶ。
// URL の ?state= で描き方（off: 既定のオフ・on: 表示をオン・current: 今の描き方）、?scheme= で明暗（light・dark）を選ぶ

import { mount } from "../../../../../dist/index.js";

/** 描き方の既定（URL に無いときの値） */
const DEFAULT_STATE = "off";
/** 明暗の既定（URL に無いときの値） */
const DEFAULT_SCHEME = "light";

const params = new URLSearchParams(location.search);
const state = params.get("state") ?? DEFAULT_STATE;
const scheme = params.get("scheme") ?? DEFAULT_SCHEME;
const variant = document.documentElement.dataset.variant;
if (variant !== "a" && variant !== "b") throw new Error(`html の data-variant が a か b ではありません: ${variant}`);

/** 今の URL の値の一部を置き換えた行き先 */
const hrefWith = (key, value) => {
  const next = new URLSearchParams({ state, scheme });
  next.set(key, value);
  if (next.get("state") === DEFAULT_STATE) next.delete("state");
  if (next.get("scheme") === DEFAULT_SCHEME) next.delete("scheme");
  const query = next.toString();
  return query === "" ? "index.html" : `?${query}`;
};

// 操作列のリンク: 今の値を押された見た目にする
for (const link of document.querySelectorAll("[data-scene-state]")) {
  link.href = hrefWith("state", link.dataset.sceneState);
  if (link.dataset.sceneState === state) link.setAttribute("aria-current", "page");
}
for (const link of document.querySelectorAll("[data-scene-scheme]")) {
  link.href = hrefWith("scheme", link.dataset.sceneScheme);
  if (link.dataset.sceneScheme === scheme) link.setAttribute("aria-current", "page");
}

/** 文書の先頭のフロントマター */
const frontmatter = `title: 問い合わせの受付
tags: [サポート, 手順]
owner: サポート担当
updated: 2026-11-08
description: 問い合わせを受けてから、担当へ回すか一次回答を返すまでの流れ`;

/** フロントマターの後ろの本文 */
const body = `# 問い合わせの受付

問い合わせを受けてから、担当へ回すか一次回答を返すまでの流れ。

## 受け付ける

窓口に届いた問い合わせを、受付の一覧に記録する。

## 振り分ける

内容から担当を決め、担当がいなければ一次回答を返す。

| 内容 | 回す先 |
| --- | --- |
| 料金 | 経理 |
| 不具合 | 開発 |
`;

/** 最上位の `キー: 値` の行をキーと値の組にする（入れ子・複数行の値は記載した文字のまま） */
const entries = frontmatter.split("\n").map((line) => {
  const at = line.indexOf(":");
  return [line.slice(0, at), line.slice(at + 1).trim()];
});

/** 表示をオンにしたときに本文の先頭に置く、フロントマターの表示 */
const display =
  variant === "a"
    ? [
        "<!-- details: フロントマター -->",
        "",
        "<!-- table: plain -->",
        "",
        "| キー | 値 |",
        "| --- | --- |",
        ...entries.map(([key, value]) => `| \`${key}\` | ${value.replaceAll("|", "\\|")} |`),
        "",
        "<!-- /table -->",
        "",
        "<!-- /details -->",
        "",
      ].join("\n")
    : ["<!-- details: フロントマター -->", "", "```yaml", frontmatter, "```", "", "<!-- /details -->", ""].join("\n");

/** 描き方ごとに mount へ指定する Markdown */
const markdown = {
  off: body,
  on: `${display}\n${body}`,
  current: `---\n${frontmatter}\n---\n\n${body}`,
}[state];
if (markdown === undefined) throw new Error(`?state= が off・on・current ではありません: ${state}`);

const doc = document.getElementById("doc");
document.body.classList.add(scheme === "dark" ? "mdmark-theme-dark" : "mdmark-theme-light");
mount(doc, { markdown });

// 表示の折りたたみに、フロントマターの表示を示す class を付ける（実装で付ける class の見本）
if (state === "on") {
  doc.querySelector(".mdmark-content > details")?.classList.add("mdmark-frontmatter");
}
