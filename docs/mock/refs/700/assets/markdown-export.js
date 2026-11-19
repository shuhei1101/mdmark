// Markdown のコピーとエクスポートのボタンのカタログ: 右側の目次の頭に置く案ごとに、ボタンの状態と頭の並びを並べる。
// URL の ?scheme= で配色を選ぶ

/** lucide のアイコンの線（lucide v1.59.0、ISC） */
const ICON_PATHS = {
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "circle-alert": '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  "file-down": '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
  "chevrons-up-down": '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  "chevrons-down-up": '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  "panel-right-dashed": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 14v1"/><path d="M15 19v2"/><path d="M15 3v2"/><path d="M15 9v1"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

/** アイコンの名前から、配布物の iconSvg と同じ属性の SVG を返す */
function iconSvg(name) {
  return `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** 文言の案（ユーザーに確認する）。ボタンの名前とツールチップ、押した後の知らせ */
const WORDS = {
  copy: "Markdown でコピー",
  export: "Markdown でエクスポート",
  copied: "Markdown をコピーしました",
  failed: "コピーできませんでした",
};

/** ボタンの状態: 状態の名前・見た目を固定するクラス・アイコン */
const STATES = [
  { name: "押す前", className: "", icon: null },
  { name: "ホバー", className: "is-hover", icon: null },
  { name: "フォーカス", className: "is-focus", icon: null },
  { name: "コピーした後", className: "", icon: "check" },
  { name: "コピーできなかった", className: "", icon: "circle-alert" },
];

/** まとめて開閉するボタンの並び（配布物の renderSideToc と同じ HTML） */
const ACTIONS =
  '<div class="mdmark-side-toc-actions">' +
  `<button class="mdmark-fold-all" type="button" data-fold-all="open" aria-label="すべて展開" title="すべて展開">${iconSvg("chevrons-up-down")}</button>` +
  `<button class="mdmark-fold-all" type="button" data-fold-all="close" aria-label="すべて折りたたむ" title="すべて折りたたむ">${iconSvg("chevrons-down-up")}</button>` +
  "</div>";

/** ピン止めのボタン（押す前） */
const PIN = `<button class="mdmark-side-toc-pin" type="button" aria-pressed="false" aria-label="目次をピン止め" title="目次をピン止め">${iconSvg("panel-right-dashed")}</button>`;

/** 案 A の 1 つのボタン: アイコンだけで、名前とツールチップで操作を伝える */
function markdownButton({ kind, state = STATES[0] }) {
  const label = WORDS[kind];
  const icon = state.icon ?? (kind === "copy" ? "copy" : "download");
  const stateLabel = state.icon === "check" ? WORDS.copied : state.icon === "circle-alert" ? WORDS.failed : label;
  return `<button class="mock-md-button ${state.className}" type="button" data-markdown="${kind}" aria-label="${stateLabel}" title="${stateLabel}">${iconSvg(icon)}</button>`;
}

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

/** コピーした後の通知: 目次の頭の下に 1 行出し、支援技術にも伝える */
const COPIED_STATUS = `<p class="mock-md-status" role="status">${iconSvg("check")}${WORDS.copied}</p>`;

/** コピーできなかったときのパネル（配布物の表のコピーのパネルと同じ HTML の組み立て） */
const FAILED_PANEL =
  '<div class="mdmark-copy-panel mock-md-panel" role="group" aria-labelledby="mock-md-failed-title mock-md-failed-note">' +
  `<div class="mdmark-copy-panel-head"><p class="mdmark-copy-panel-title" id="mock-md-failed-title">${iconSvg("circle-alert")}クリップボードにコピーできませんでした</p><button class="mdmark-copy-panel-close" type="button" aria-label="閉じる">${iconSvg("x")}</button></div>` +
  '<p class="mdmark-copy-panel-note" id="mock-md-failed-note">Markdown を選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p>' +
  '<textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="mock-md-failed-title mock-md-failed-note"># 問い合わせ窓口の見直し\n\n- [導入](#導入)\n  - [前提](#前提)\n- [窓口ごとの件数](#窓口ごとの件数)\n\n## 導入\n\n窓口を 3 つから 2 つにまとめる。</textarea>' +
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
