// Markdown のコピーとエクスポートのボタンのモックで共有する部品: アイコン・文言・ボタン・コピーできなかったときのパネル

/** lucide のアイコンの線（lucide v1.59.0、ISC） */
export const ICON_PATHS = {
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
export function iconSvg(name) {
  return `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

/** 文言（ユーザーが案 A で決定）。ボタンの名前とツールチップ、押した後のボタンの名前。コピーした後は通知を出さず、アイコンを check に替える */
export const WORDS = {
  copy: "Markdown でコピー",
  export: "Markdown でエクスポート",
  copied: "Markdown をコピーしました",
  failed: "コピーできませんでした",
};

/** ボタンの状態: 状態の名前・見た目を固定するクラス・アイコン */
export const STATES = [
  { name: "押す前", className: "", icon: null },
  { name: "ホバー", className: "is-hover", icon: null },
  { name: "フォーカス", className: "is-focus", icon: null },
  { name: "コピーした後", className: "", icon: "check" },
  { name: "コピーできなかった", className: "", icon: "circle-alert" },
];

/** 案 A の 1 つのボタン: アイコンだけで、名前とツールチップで操作を伝える */
export function markdownButton({ kind, state = STATES[0] }) {
  const label = WORDS[kind];
  const icon = state.icon ?? (kind === "copy" ? "copy" : "download");
  const stateLabel = state.icon === "check" ? WORDS.copied : state.icon === "circle-alert" ? WORDS.failed : label;
  return `<button class="mock-md-button ${state.className}" type="button" data-markdown="${kind}" aria-label="${stateLabel}" title="${stateLabel}">${iconSvg(icon)}</button>`;
}

/** コピーできなかったときのパネル（配布物の表のコピーのパネルと同じ HTML の組み立て） */
export const FAILED_PANEL =
  '<div class="mdmark-copy-panel mock-md-panel" role="group" aria-labelledby="mock-md-failed-title mock-md-failed-note">' +
  `<div class="mdmark-copy-panel-head"><p class="mdmark-copy-panel-title" id="mock-md-failed-title">${iconSvg("circle-alert")}クリップボードにコピーできませんでした（クリップボードへのアクセスが許可されていません）</p><button class="mdmark-copy-panel-close" type="button" aria-label="閉じる">${iconSvg("x")}</button></div>` +
  '<p class="mdmark-copy-panel-note" id="mock-md-failed-note">Markdown を選択しています。Ctrl+C（Mac は ⌘C）でコピーしてください。</p>' +
  '<textarea class="mdmark-copy-panel-text" readonly rows="6" aria-labelledby="mock-md-failed-title mock-md-failed-note"># 問い合わせ窓口の見直し\n\n- [導入](#導入)\n  - [前提](#前提)\n- [窓口ごとの件数](#窓口ごとの件数)\n\n## 導入\n\n窓口を 3 つから 2 つにまとめる。</textarea>' +
  "</div>";

/** 案 A の 2 つのボタンの並び。state はコピーのボタンの状態（copied・failed・それ以外） */
export function renderMarkdownButtons(state) {
  const copyState = state === "copied" ? STATES[3] : state === "failed" ? STATES[4] : STATES[0];
  return `<div class="mock-md-actions" role="group" aria-label="Markdown">${markdownButton({ kind: "copy", state: copyState })}${markdownButton({ kind: "export" })}</div>`;
}
