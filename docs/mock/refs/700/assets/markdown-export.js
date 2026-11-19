// Markdown のコピーとエクスポートのボタンのカタログ: 右側の目次の頭に置く案ごとに、ボタンの状態と頭の並びを並べる。
// URL の ?scheme= で配色を選ぶ

import { COPIED_STATUS, FAILED_PANEL, STATES, WORDS, iconSvg, markdownButton } from "./markdown-export-parts.js";

/** まとめて開閉するボタンの並び（配布物の renderSideToc と同じ HTML） */
const ACTIONS =
  '<div class="mdmark-side-toc-actions">' +
  `<button class="mdmark-fold-all" type="button" data-fold-all="open" aria-label="すべて展開" title="すべて展開">${iconSvg("chevrons-up-down")}</button>` +
  `<button class="mdmark-fold-all" type="button" data-fold-all="close" aria-label="すべて折りたたむ" title="すべて折りたたむ">${iconSvg("chevrons-down-up")}</button>` +
  "</div>";

/** ピン止めのボタン（押す前） */
const PIN = `<button class="mdmark-side-toc-pin" type="button" aria-pressed="false" aria-label="目次をピン止め" title="目次をピン止め">${iconSvg("panel-right-dashed")}</button>`;

/** 案 A の並び: まとめて開閉するボタン、Markdown の 2 つのボタン、ピン止め */
function headA(copyState = STATES[0]) {
  return `${ACTIONS}<div class="mock-md-actions" role="group" aria-label="Markdown">${markdownButton({ kind: "copy", state: copyState })}${markdownButton({ kind: "export" })}</div>${PIN}`;
}

/** 案 B の並び: まとめて開閉するボタン、Markdown のメニューを開くボタン、ピン止め */
function headB(open) {
  return `${ACTIONS}<button class="mock-md-button mock-md-menu-button" type="button" aria-expanded="${open}" aria-label="Markdown" title="Markdown">${iconSvg("file-down")}</button>${PIN}`;
}

/** 案 B の開いたメニュー（popover の中のボタンの並び） */
const MENU_B =
  '<div class="mock-md-menu" role="group" aria-label="Markdown">' +
  `<button type="button">${iconSvg("copy")}${WORDS.copy}</button>` +
  `<button type="button">${iconSvg("download")}${WORDS.export}</button>` +
  "</div>";

/** 右側の目次の枠: 頭・頭の下に出すもの・項目の並び。ランドマークの名前へ見本の名前を添える */
function panel({ head, below = "", name }) {
  return (
    '<div class="mdmark catalog-toc"><aside class="mdmark-side-toc" data-mode="hover" data-pinned>' +
    `<nav class="mdmark-side-toc-panel" aria-label="右側の目次（${name}）">` +
    `<div class="mdmark-side-toc-head">${head}</div>${below}` +
    '<ul class="mdmark-side-toc-list"><li><a href="#c">問い合わせ窓口の見直し</a><ul>' +
    '<li><a href="#c" aria-current="location">導入</a><ul><li><a href="#c">前提</a></li></ul></li>' +
    '<li><a href="#c">窓口ごとの件数</a></li><li><a href="#c">返信までの時間</a></li>' +
    "</ul></li></ul></nav></aside></div>"
  );
}

const params = new URLSearchParams(location.search);
const scheme = params.get("scheme") ?? "light";
document.documentElement.dataset.scheme = scheme;
for (const link of document.querySelectorAll("[data-scene-axis='scheme']")) {
  link.href = link.dataset.sceneValue === "light" ? "index.html" : `?scheme=${link.dataset.sceneValue}`;
  if (link.dataset.sceneValue === scheme) link.setAttribute("aria-current", "page");
}

const catalog = document.querySelector("#catalog");

// 案 A（推奨）: 目次の頭にアイコンだけの 2 つのボタンを並べる
const statesA = STATES.map(
  (state) =>
    `<li class="catalog-state"><div class="mdmark catalog-button">${markdownButton({ kind: "copy", state })}</div>コピーのボタン・${state.name}</li>`,
).join("");
catalog.insertAdjacentHTML(
  "beforeend",
  '<section><h2 class="catalog-label">A: 目次の頭に 2 つのボタン（推奨）</h2>' +
    `<ul class="catalog-states">${statesA}<li class="catalog-state"><div class="mdmark catalog-button">${markdownButton({ kind: "export" })}</div>エクスポートのボタン・押す前</li></ul>` +
    '<ul class="catalog-states">' +
    `<li class="catalog-state">${panel({ head: headA(), name: "A・押す前" })}目次の頭（押す前）</li>` +
    `<li class="catalog-state">${panel({ head: headA(STATES[3]), below: COPIED_STATUS, name: "A・コピーした後" })}コピーした後（2 秒で通知を消し、アイコンを戻す）</li>` +
    `<li class="catalog-state">${panel({ head: headA(STATES[4]), below: FAILED_PANEL, name: "A・コピーできなかった" })}コピーできなかった（閉じるまで残す）</li>` +
    "</ul></section>",
);

// 案 B: 目次の頭に 1 つのメニューのボタンを置き、押すと 2 つの操作を開く
catalog.insertAdjacentHTML(
  "beforeend",
  '<section><h2 class="catalog-label">B: 目次の頭に 1 つのメニューのボタン</h2><ul class="catalog-states">' +
    `<li class="catalog-state">${panel({ head: headB(false), name: "B・閉じた" })}メニューを閉じた</li>` +
    `<li class="catalog-state">${panel({ head: headB(true), below: MENU_B, name: "B・開いた" })}メニューを開いた（外側のクリックと Esc で閉じる）</li>` +
    "</ul></section>",
);

// 案によらない頭の並び: sections がオフの文書（まとめて開閉するボタンを置かない）
catalog.insertAdjacentHTML(
  "beforeend",
  '<section><h2 class="catalog-label">機能による頭の並び（案 A）</h2><ul class="catalog-states">' +
    `<li class="catalog-state">${panel({ head: `<div class="mock-md-actions" role="group" aria-label="Markdown">${markdownButton({ kind: "copy" })}${markdownButton({ kind: "export" })}</div>${PIN}`, name: "sections がオフの文書" })}sections がオフの文書</li>` +
    `<li class="catalog-state">${panel({ head: headA().replace(/<div class="mock-md-actions"[^]*?<\/div>/, ""), name: "ボタンをオフにした文書" })}設定でボタンをオフにした文書（今の頭と同じ）</li>` +
    "</ul></section>",
);


// mount で描いた文書の見本へのリンク: 画面の幅で右側の目次の出し方（狭い幅の帯・hover の右端の線）が変わるため、別のページで画面いっぱいに描く
catalog.insertAdjacentHTML(
  "beforeend",
  '<section><h2 class="catalog-label">配布物の mount で描いた文書（案 A）</h2><ul class="catalog-links">' +
    [
      ["rail", "目次を閉じている（狭い幅は帯、48rem 以上は右端の線だけでボタンは見えない）"],
      ["open", "目次を開いた（狭い幅は帯から開く、48rem 以上は右端の線を指して出す）"],
      ["copied", "目次を開いてコピーした後"],
      ["failed", "目次を開いてコピーできなかった"],
    ]
      .map(([state, label]) => `<li><a href="rendered.html?state=${state}${scheme === "dark" ? "&scheme=dark" : ""}">${label}</a></li>`)
      .join("") +
    "</ul></section>",
);
