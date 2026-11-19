// markdown のコードブロックのプレビューのカタログ: 配布物の mount でコードブロックを描き、帯に案の切り替えのボタンを差し込む。
// URL の ?scheme= で配色を選ぶ

import { mount } from "../../../../../dist/index.js";

/** 見本の中の文書（コードブロックの中身） */
const SOURCE = `# 在庫の点検

> [!NOTE]
> 点検は毎朝 9 時までに済ませる。

| 倉庫 | 点検 |
| --- | --- |
| 第一倉庫 | 済み |
| 冷蔵室 | 未着手 |

1. 温度を記録する
2. 鍵を返却する`;

/** 長い行を持つ見本の中の文書 */
const LONG_SOURCE = `## 配布物の読み込み

配布物は https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js から、バージョンを固定した URL で読み込む。`;

/** 記載の警告を持つ見本の中の文書（知らない表の種類） */
const WARNING_SOURCE = `<!-- table: {"kind": "list"} -->

| 倉庫 | 点検 |
| --- | --- |
| 第一倉庫 | 済み |

<!-- /table -->`;

/** 見本の文書を作る: 言語と、code のマーカーのタイトル */
function documentOf({ language = "markdown", title, body = SOURCE }) {
  const marker = title === undefined ? "" : `<!-- code: title=${title} -->\n`;
  return `${marker}\`\`\`\`${language}\n${body}\n\`\`\`\`\n`;
}

/** カタログの見本と描いた結果の中の文書で切る機能 */
const SAMPLE_FEATURES = { "side-toc": false, backlinks: false, "back-to-top": false };

const ICONS = {
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};

function icon(name) {
  return `<svg class="mock-preview-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** 案ごとの切り替えのボタンの HTML */
const TOGGLES = {
  a: (pressed) =>
    `<button class="mock-preview-toggle" type="button" aria-pressed="${pressed}">${icon("eye")}プレビュー</button>`,
  b: (pressed) =>
    `<span class="mock-preview-segment" role="group" aria-label="表示"><button type="button" aria-pressed="${!pressed}">ソース</button><button type="button" aria-pressed="${pressed}">プレビュー</button></span>`,
  c: (pressed) =>
    `<button class="mock-preview-toggle" type="button" data-icon-only aria-pressed="${pressed}" aria-label="プレビュー" title="プレビュー">${icon("eye")}</button>`,
};

const params = new URLSearchParams(location.search);
const scheme = params.get("scheme") ?? "light";
document.documentElement.dataset.scheme = scheme;
for (const link of document.querySelectorAll("[data-scene-axis='scheme']")) {
  link.href = link.dataset.sceneValue === "light" ? "index.html" : `?scheme=${link.dataset.sceneValue}`;
  if (link.dataset.sceneValue === scheme) link.setAttribute("aria-current", "page");
}

/** 切り替えのボタンの押した状態と、ソース・描いた結果の表示をそろえる。描いた結果は初めて出すときに描く */
function attachToggle({ block, meta, body }) {
  const preview = document.createElement("div");
  preview.className = "mock-preview-body";
  block.append(preview);
  let rendered = false;
  const show = (on) => {
    block.dataset.preview = on ? "on" : "off";
    if (on && !rendered) {
      mount(preview, { markdown: body, config: { colorScheme: scheme, features: SAMPLE_FEATURES } });
      rendered = true;
    }
    for (const button of meta.querySelectorAll(".mock-preview-toggle")) button.setAttribute("aria-pressed", String(on));
    const segment = meta.querySelectorAll(".mock-preview-segment button");
    if (segment.length === 2) {
      segment[0].setAttribute("aria-pressed", String(!on));
      segment[1].setAttribute("aria-pressed", String(on));
    }
  };
  meta.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || target.classList.contains("mdmark-code-copy")) return;
    if (target.classList.contains("mock-preview-toggle")) show(target.getAttribute("aria-pressed") !== "true");
    else show(target.textContent === "プレビュー");
  });
  return show;
}

/** 見本を 1 つ描く: コードブロックを mount で描き、帯の右の塊の先頭に切り替えのボタンを差し込む */
function sample({ proposal = "a", pressed = false, state, language = "markdown", title, body = SOURCE, features = {}, narrow = false, copied = false }) {
  const holder = document.createElement("div");
  holder.className = "catalog-sample";
  if (narrow) holder.dataset.narrow = "";
  mount(holder, {
    markdown: documentOf({ language, title, body }),
    config: { colorScheme: scheme, features: { ...SAMPLE_FEATURES, ...features } },
  });
  requestAnimationFrame(() => {
    const block = holder.querySelector(".mdmark-code");
    const meta = block?.querySelector(".mdmark-code-meta");
    if (!meta || !["markdown", "md"].includes(language.split(":")[0])) return;
    meta.insertAdjacentHTML("afterbegin", TOGGLES[proposal](pressed));
    attachToggle({ block, meta, body })(pressed);
    if (state) meta.querySelector(".mock-preview-toggle").classList.add(`is-${state}`);
    if (copied) {
      const button = meta.querySelector(".mdmark-code-copy");
      button.dataset.state = "copied";
      button.innerHTML = `${icon("check")}コピーしました`;
    }
  });
  return holder;
}

const catalog = document.querySelector("#catalog");

/** 見出しと、状態ごとの見本の並びを 1 つのセクションにする */
function section(label, items) {
  const element = document.createElement("section");
  element.innerHTML = `<h2 class="catalog-label">${label}</h2><ul class="catalog-states"></ul>`;
  const list = element.querySelector("ul");
  for (const [name, options] of items) {
    const item = document.createElement("li");
    item.className = "catalog-state";
    item.append(sample(options), name);
    list.append(item);
  }
  catalog.append(element);
}

section("A: 帯にアイコンと文字のボタン「プレビュー」を、コピーのボタンの左に配置する（推奨）", [
  ["押す前（ソースの表示。既定）", {}],
  ["ホバー", { state: "hover" }],
  ["フォーカス", { state: "focus" }],
  ["押した後（描いた結果の表示）", { pressed: true }],
]);

section("B: 帯に「ソース」「プレビュー」の 2 つの区画のセグメントを配置する", [
  ["ソースを選んだ（既定）", { proposal: "b" }],
  ["プレビューを選んだ", { proposal: "b", pressed: true }],
]);

section("C: 帯にアイコンだけのボタンを配置する（ツールチップ「プレビュー」）", [
  ["押す前", { proposal: "c" }],
  ["押した後", { proposal: "c", pressed: true }],
]);

section("案 A の、言語・タイトル・機能による見え方", [
  ["言語 md", { language: "md" }],
  ["言語とファイル名（markdown:README.md）", { language: "markdown:README.md", pressed: true }],
  ["タイトルを持つ（title=README.md）", { title: "README.md", pressed: true }],
  ["描いた結果を出したままコピーした（ソースをコピーする）", { pressed: true, copied: true }],
  ["中身に記載の警告がある（描いた結果の中に、文書と同じ警告を出す）", { pressed: true, body: WARNING_SOURCE }],
  ["中身が空（描いた結果は余白だけの面）", { pressed: true, body: "" }],
  ["言語 ts（ボタンを配置しない）", { language: "ts", body: 'import { mount } from "mdmark";' }],
  ["機能をオフにした文書（features: -code。帯もボタンも無い）", { features: { code: false } }],
]);

section("案 A の、狭い幅と長い行", [
  ["狭い幅・押す前", { narrow: true, body: LONG_SOURCE }],
  ["狭い幅・押した後（長い URL は折り返す）", { narrow: true, pressed: true, body: LONG_SOURCE }],
]);
