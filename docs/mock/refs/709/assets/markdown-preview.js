// markdown のコードブロックのプレビューのカタログ: 配布物の mount でコードブロックを描き、既定で描いた結果を出して、帯に Raw のボタンを差し込む。
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
  code: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};

function icon(name) {
  return `<svg class="mock-preview-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** Raw のボタンの HTML: 押した状態が元の Markdown を出している状態 */
function rawButton(pressed) {
  return `<button class="mock-preview-toggle" type="button" aria-pressed="${pressed}">${icon("code")}Raw</button>`;
}

const params = new URLSearchParams(location.search);
const scheme = params.get("scheme") ?? "light";
document.documentElement.dataset.scheme = scheme;
for (const link of document.querySelectorAll("[data-scene-axis='scheme']")) {
  link.href = link.dataset.sceneValue === "light" ? "index.html" : `?scheme=${link.dataset.sceneValue}`;
  if (link.dataset.sceneValue === scheme) link.setAttribute("aria-current", "page");
}

/** Raw のボタンの押した状態と、描いた結果・元の Markdown の表示をそろえる */
function attachToggle({ block, meta, body }) {
  const preview = document.createElement("div");
  preview.className = "mock-preview-body";
  block.append(preview);
  mount(preview, { markdown: body, config: { colorScheme: scheme, features: SAMPLE_FEATURES } });
  const show = (raw) => {
    block.dataset.preview = raw ? "off" : "on";
    meta.querySelector(".mock-preview-toggle").setAttribute("aria-pressed", String(raw));
  };
  meta.addEventListener("click", (event) => {
    const target = event.target.closest(".mock-preview-toggle");
    if (target) show(target.getAttribute("aria-pressed") !== "true");
  });
  return show;
}

/** 見本を 1 つ描く: コードブロックを mount で描き、帯の右の塊の先頭に Raw のボタンを差し込む */
function sample({ raw = false, state, language = "markdown", title, body = SOURCE, features = {}, narrow = false, copied = false }) {
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
    meta.insertAdjacentHTML("afterbegin", rawButton(raw));
    attachToggle({ block, meta, body })(raw);
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

section("帯のコピーのボタンの左の Raw のボタン", [
  ["押す前（描いた結果の表示。既定）", {}],
  ["ホバー", { state: "hover" }],
  ["フォーカス", { state: "focus" }],
  ["押した後（元の Markdown の表示）", { raw: true }],
]);

section("言語・タイトル・マーカー・機能による見え方", [
  ["言語 md", { language: "md" }],
  ["言語とファイル名（markdown:README.md）", { language: "markdown:README.md" }],
  ["タイトルを持つ（title=README.md）", { title: "README.md" }],
  ["code のマーカーで既定を元の Markdown にした（例: <!-- code: raw -->）", { raw: true }],
  ["描いた結果を出したままコピーした（元の Markdown をコピーする）", { copied: true }],
  ["中身に記載の警告がある（描いた結果の中に、文書と同じ警告を出す）", { body: WARNING_SOURCE }],
  ["中身が空（描いた結果は余白だけの面）", { body: "" }],
  ["言語 ts（ボタンを配置しない）", { language: "ts", body: 'import { mount } from "mdmark";' }],
  ["機能をオフにした文書（features: -code。帯もボタンも無く、元の Markdown のまま）", { features: { code: false } }],
]);

section("狭い幅と長い行", [
  ["狭い幅・押す前（長い URL は折り返す）", { narrow: true, body: LONG_SOURCE }],
  ["狭い幅・押した後", { narrow: true, raw: true, body: LONG_SOURCE }],
]);
