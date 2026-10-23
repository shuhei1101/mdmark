// 洗い出しのキャンバス: 部品ごとに今の値の列と dev-swiss の列を作り、同じ Markdown を mount で描く

import { mount } from "../../../../refs/80/assets/mdmark/index.js";

/** 列の class と名前: class が列に当てる値を決める */
const COLUMNS = [
  { theme: "theme-modern", label: "今の値（modern）" },
  { theme: "theme-dev-swiss", label: "dev-swiss" },
];

/** 外部ライブラリの対応表: 読めない印（知らせの枠）と、読み終わらない印（読み込み中の枠） */
const LIBRARIES = {
  "missing-chart": "./not-found.js",
  "slow-chart": "data:text/javascript,await new Promise(() => {});",
};

/** 被参照の一覧を出すための索引: 描く文書を 2 つの文書が参照している */
const INDEX = {
  schema: 1,
  docs: [
    { id: "canvas", path: "canvas.md", title: "見た目の洗い出し" },
    { id: "guide", path: "使い方/文書を描く.md", title: "文書を描く", description: "配布物を読んだページで mount を呼ぶ", related: ["canvas"] },
    { id: "theme", path: "使い方/テーマを上書きする.md", title: "テーマを上書きする", description: "CSS 変数で見た目を変える", related: ["canvas"] },
  ],
};

/** 差分の取り出し元: 新しい順に 2 つのリビジョンと、それぞれの本文を返す */
const DIFF_SOURCE = {
  revisions: async () => [
    { id: "r2", at: "2026-10-23T15:00:00+09:00", label: "色を薄くする", author: "designer" },
    { id: "r1", at: "2026-10-20T10:00:00+09:00", label: "最初の版", author: "planner" },
  ],
  content: async ({ revisionId }) =>
    revisionId === "r1"
      ? "# テーマ\n\nリンクの色は #0969da です。\n\n表の見出し行は濃い灰で塗る。\n\n変数の名前は変わりません。\n"
      : "# テーマ\n\nリンクの色は #0f766e です。\n\n変数の名前は変わりません。\n\n印刷ではダークを解除します。\n",
};

/** コメントの読み書き: 本文の「既定の見た目」に付いたコメントを 1 件返し、保存は下書きに ID を付けて返す */
const COMMENT_STORE = {
  load: async () => [
    { id: "c1", quote: "既定の見た目", prefix: "mdmark の", suffix: "を mindstella", body: "表の見出し行の濃さも揃えたい。" },
  ],
  save: async ({ comment }) => ({ ...comment, id: `c${Date.now()}` }),
};

/** 部品ごとに mount へ渡す追加の引数と、設定の機能 */
const OPTIONS = {
  backlinks: { index: INDEX, docId: "canvas" },
  diff: { docId: "canvas", diffSource: DIFF_SOURCE },
  comment: { docId: "canvas", commentStore: COMMENT_STORE, features: { comments: true } },
};

/** 描いた後に場面を作る操作: 差分は「変更を見る」を押して開く */
const AFTER_MOUNT = {
  diff: (el) => el.querySelector(".mdmark-diff-toggle").click(),
};

/** 節の後ろに 2 つの列を足し、列ごとの中身の置き場所を返す */
function addColumns(section) {
  const pair = document.createElement("div");
  pair.className = "canvas-pair";
  const columns = COLUMNS.filter(({ theme }) => !SHOWN_COLUMNS || SHOWN_COLUMNS.includes(theme));
  const slots = columns.map(({ theme, label }) => {
    const column = document.createElement("div");
    column.className = `canvas-column ${theme}`;
    const name = document.createElement("p");
    name.className = "canvas-column-label";
    name.textContent = label;
    const slot = document.createElement("div");
    column.append(name, slot);
    pair.append(column);
    return slot;
  });
  section.append(pair);
  return slots;
}

/** URL の `?parts=` で描く部品を、`?columns=` で列（class）を絞る（崩れの検出と撮影で開く）。無ければ全てを描く */
const PARAMS = new URLSearchParams(location.search);
const PARTS = PARAMS.get("parts")?.split(",");
const SHOWN_COLUMNS = PARAMS.get("columns")?.split(",");

for (const section of document.querySelectorAll("[data-canvas]")) {
  const key = section.dataset.canvas;
  if (PARTS && !PARTS.includes(key)) {
    section.hidden = true;
    continue;
  }
  const source = section.querySelector("[data-canvas-source]");
  const slots = addColumns(section);
  // HTML の見本（まとめた HTML）は、同じ要素を両方の列に写す
  if (source instanceof HTMLTemplateElement) {
    for (const slot of slots) slot.append(source.content.cloneNode(true));
    continue;
  }
  const markdown = source.textContent.replace(/^\n/, "");
  const { features, ...extra } = OPTIONS[key] ?? {};
  // 列ごとに同じ本文と設定で描く（列の値の違いだけが見た目の差になる）
  for (const slot of slots) {
    mount(slot, { markdown, ...extra, config: { libraries: LIBRARIES, ...(features && { features }) } });
    AFTER_MOUNT[key]?.(slot);
  }
}
