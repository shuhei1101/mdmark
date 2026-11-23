// #795 の <mdmark-table> のモック: 配布物の mount で、アプリの一覧の表を状態ごとの場所に描き、
// まだ部品に無い状態（押せる行・セルの編集・行の追加・誤りの通知）をモックだけの要素で重ねる。
// URL の ?scheme= で明暗（light・dark）を選ぶ

import { mount } from "../../../../../dist/index.js";

/** 明暗の既定（URL に無いときの値） */
const DEFAULT_SCHEME = "light";

const scheme = new URLSearchParams(location.search).get("scheme") ?? DEFAULT_SCHEME;
document.body.classList.toggle("mdmark-theme-dark", scheme === "dark");
document.body.classList.toggle("mdmark-theme-light", scheme !== "dark");
for (const link of document.querySelectorAll("[data-scene-scheme]")) {
  link.href = link.dataset.sceneScheme === DEFAULT_SCHEME ? "index.html" : `?scheme=${link.dataset.sceneScheme}`;
  if (link.dataset.sceneScheme === scheme) link.setAttribute("aria-current", "page");
}

const longTitle =
  "フィードバック画面の一覧で、文字数が列の幅を超えると隣の列に重なる不具合を、表の部品を使用して列の最小の幅で折り返すように修正し、並べ替えとピン止めも使用できるようにする";

/** アプリの一覧のデータ（列の定義と行のデータに該当する。モックでは Markdown の表にして描く） */
const rows = [
  ["`<script>alert(1)</script>`設計", "未着手", "佐藤", "2026-11-20"],
  [longTitle, "進行中", "鈴木", "2026-11-22"],
  ["列の並べ替えを使用する", "進行中", "佐藤", "2026-11-18"],
  ["ピン止めを使用する", "完了", "田中", "2026-11-15"],
  ["行を押して詳細を開く", "未着手", "鈴木", "2026-11-21"],
];

/** 表のマーカー: タイトルの列のピン止め・状態の列の絞り込み・列の表示・列の並べ替え・列の幅の変更 */
const marker =
  '<!-- table: {"kind": "data", "features": {"columns": {}, "reorder": {}, "resize": {}}, "columns": {"タイトル": {"pinned": true}, "状態": {"filter": {"type": "select"}}}} -->';

/** 状態の列をアプリのバッジで描く場面だけ、セルの中身を差し替える */
const tableMarkdown = (badges) =>
  [
    marker,
    "",
    "| タイトル | 状態 | 担当 | 更新日 |",
    "| --- | --- | --- | --- |",
    ...rows.map(([title, state, owner, date]) => `| ${title} | ${badges ? `\`badge:${state}\`` : state} | ${owner} | ${date} |`),
    "",
    "<!-- /table -->",
  ].join("\n");

/** 行のデータの行（絞り込みで全ての行が隠れたときの空の行を除く） */
const DATA_ROWS = "tbody tr:not(.mdmark-table-empty)";

/** 編集できる列のセルに、編集できることを示すマーカーを付ける */
function markEditable(root, column) {
  for (const row of root.querySelectorAll(DATA_ROWS)) {
    row.children[column].classList.add("mock-cell-editable");
  }
}

/** 2 行目の担当のセル */
const ownerCell = (root) => root.querySelectorAll(DATA_ROWS)[1].children[2];

/** 場面ごとに、描いた後にモックだけの要素を重ねる */
const scenes = {
  normal: () => {},
  "row-press": (root) => {
    const bodyRows = root.querySelectorAll(DATA_ROWS);
    for (const row of bodyRows) {
      row.classList.add("mock-row-pressable");
      row.tabIndex = 0;
    }
    bodyRows[2].classList.add("mock-row-hover");
    bodyRows[3].classList.add("mock-row-focus");
  },
  "edit-a": (root) => {
    markEditable(root, 2);
    const cell = ownerCell(root);
    cell.classList.add("mock-cell-editing");
    cell.innerHTML =
      '<input class="mock-cell-input" type="text" value="鈴木" aria-label="担当（2 行目）を編集する"><span class="mock-cell-hint">Enter で確定・Esc で取り消す</span>';
  },
  "edit-b": (root) => {
    const cell = ownerCell(root);
    cell.classList.add("mock-cell-editing");
    cell.innerHTML =
      '<span class="mock-app-editor"><select aria-label="担当（2 行目）"><option>佐藤</option><option selected>鈴木</option><option>田中</option></select><button type="button">保存</button></span>';
  },
  "add-row": (root) => {
    const bar = document.createElement("div");
    bar.className = "mock-add-row";
    bar.innerHTML = '<button type="button" class="mock-add-row-button"><span aria-hidden="true">＋</span>行追加</button>';
    root.querySelector("table").closest(".mdmark").append(bar);
  },
  badges: () => {},
  error: (root) => {
    root.innerHTML =
      '<div class="mdmark"><div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">この表を表示できません</strong><p><code>rows</code> に配列でない値が指定されています。行のデータを、行ごとのオブジェクトの配列で指定してください。</p></div></div>';
  },
};

for (const el of document.querySelectorAll("[data-mock-scene]")) {
  const name = el.dataset.mockScene;
  await mount(el, { markdown: tableMarkdown(name === "badges") });
  scenes[name](el);
}
