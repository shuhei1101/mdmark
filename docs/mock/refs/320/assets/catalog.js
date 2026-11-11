// 右側の目次の頭のカタログ: ピン止めのアイコンの案ごとに、ボタンの状態と頭の並びを並べる。
// URL の ?scheme= で配色を選ぶ

import { iconSvg, PIN_ICONS } from "./proposal.js";

/** カタログに並べる案: 操作列と同じ記号と名前 */
const OPTIONS = [
  { icon: "panel", label: "A: 右の列（推奨）" },
  { icon: "arrow", label: "B: 右の列と矢印" },
  { icon: "pin", label: "C: ピンと外すピン" },
];

/** ピン止めのボタンの状態: 状態の名前・aria-pressed・見た目を固定するクラス */
const STATES = [
  { name: "押す前", pressed: false, className: "" },
  { name: "ホバー", pressed: false, className: "is-hover" },
  { name: "フォーカス", pressed: false, className: "is-focus" },
  { name: "押した後", pressed: true, className: "" },
];

/** まとめて開閉するボタンの並び（配布物の renderSideToc と同じ HTML） */
const ACTIONS =
  '<div class="mdmark-side-toc-actions">' +
  `<button class="mdmark-fold-all" type="button" data-fold-all="open" aria-label="すべて展開" title="すべて展開">${chevrons("m7 15 5 5 5-5", "m7 9 5-5 5 5")}</button>` +
  `<button class="mdmark-fold-all" type="button" data-fold-all="close" aria-label="すべて折りたたむ" title="すべて折りたたむ">${chevrons("m7 20 5-5 5 5", "m7 4 5 5 5-5")}</button>` +
  "</div>";

/** lucide の chevrons-up-down・chevrons-down-up の SVG を返す */
function chevrons(first, second) {
  return `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${first}"/><path d="${second}"/></svg>`;
}

/** ピン止めのボタンの HTML */
function pinButton(icon, state) {
  const name = PIN_ICONS[icon][state.pressed ? "on" : "off"];
  return `<button class="mdmark-side-toc-pin ${state.className}" type="button" aria-pressed="${state.pressed}" aria-label="目次をピン止め" title="目次をピン止め">${iconSvg(name)}</button>`;
}

/** 右側の目次の枠: 頭（まとめて開閉するボタンとピン止め）と項目の並び。カタログに並べる見本ごとに、ランドマークの名前へ見本の名前を添える */
function panel({ head, name }) {
  return (
    '<div class="mdmark catalog-toc"><aside class="mdmark-side-toc" data-mode="hover" data-pinned>' +
    `<nav class="mdmark-side-toc-panel" aria-label="右側の目次（${name}）">` +
    `<div class="mdmark-side-toc-head">${head}</div>` +
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
for (const option of OPTIONS) {
  const states = STATES.map(
    (state) => `<li class="catalog-state"><div class="mdmark catalog-button">${pinButton(option.icon, state)}</div>${state.name}</li>`,
  ).join("");
  catalog.insertAdjacentHTML(
    "beforeend",
    `<section><h2 class="catalog-label">${option.label}</h2>` +
      `<ul class="catalog-states">${states}</ul>` +
      `<ul class="catalog-states"><li class="catalog-state">${panel({ head: ACTIONS + pinButton(option.icon, STATES[0]), name: `${option.label}・押す前` })}目次の頭（押す前）</li>` +
      `<li class="catalog-state">${panel({ head: ACTIONS + pinButton(option.icon, STATES[3]), name: `${option.label}・押した後` })}目次の頭（押した後）</li></ul></section>`,
  );
}

// 案によらない頭の並び: fixed の出し方（ピン止めを出さない）と、sections をオフにした文書（まとめて開閉するボタンを置かない）
catalog.insertAdjacentHTML(
  "beforeend",
  '<section><h2 class="catalog-label">出し方と機能による頭の並び</h2><ul class="catalog-states">' +
    `<li class="catalog-state">${panel({ head: ACTIONS, name: "fixed の出し方" })}fixed の出し方（ピン止めを出さない）</li>` +
    `<li class="catalog-state">${panel({ head: pinButton("panel", STATES[0]), name: "sections がオフの文書" })}sections がオフの文書（ピン止めだけ）</li>` +
    "</ul></section>",
);
