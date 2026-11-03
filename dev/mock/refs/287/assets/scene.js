// 先頭へ戻るボタンを見る場面: 配布物の mount で長い文書を描き、先頭へ戻るボタンのモックを付ける。
// URL の ?threshold=・?margin=・?with=・?host= で未確定の案と、重ねる部品・描く場所を選ぶ

import { mount } from "../../../../../dist/index.js";
import { attachBackToTop } from "./back-to-top.js";

/** 案の軸ごとの既定（URL に無いときの値。未確定の論点は推奨の案） */
const DEFAULTS = { threshold: "viewport", margin: "shift", with: "hover", host: "window" };

const params = new URLSearchParams(location.search);
const scene = Object.fromEntries(
  Object.entries(DEFAULTS).map(([axis, value]) => [axis, params.get(axis) ?? value]),
);

/** 今の案を保ったまま、1 つの軸だけを変えた URL を返す */
function urlWith(axis, value) {
  const next = new URLSearchParams(params);
  if (value === DEFAULTS[axis]) next.delete(axis);
  else next.set(axis, value);
  const query = next.toString();
  return query ? `?${query}` : "index.html";
}

// 操作列のリンク: 行き先に他の軸の案を残し、今の案を押された見た目にする
for (const link of document.querySelectorAll("[data-scene-axis]")) {
  const { sceneAxis, sceneValue } = link.dataset;
  link.href = urlWith(sceneAxis, sceneValue);
  if (scene[sceneAxis] === sceneValue) link.setAttribute("aria-current", "page");
}

/** 節の段落: 画面の高さの 3 倍を超える長さにするため、節ごとに 3 段落を置く */
function paragraphs(topic) {
  return [
    `${topic}は、窓口ごとの件数と返信までの時間を並べて決める。受け付けてから最初の返信を送るまでを数え、休日に受け付けた問い合わせは次の営業日の始業から数える。`,
    `${topic}の数字は、10 月の第 2 週の問い合わせから取った。メールとフォームは自動返信で大半を返せていて、電話は担当者が返す割合が高い。`,
    `${topic}で決めたことは、来週の定例で確かめる。決めたら、窓口の案内のページと自動返信の文面を書き換える。`,
  ].join("\n\n");
}

const TOPICS = ["導入", "窓口ごとの件数", "返信までの時間", "電話の折り返し", "チャットの時間帯", "受け持ちの組み替え", "案内のページ", "自動返信の文面", "来月の予定", "付録"];

/** 描く文書: `## 導入` から `## 付録` までの 10 個の見出しと、末尾の画像 */
const markdown = [
  "# 問い合わせ窓口の見直し",
  ...TOPICS.map((topic) => `## ${topic}\n\n${paragraphs(topic)}`),
  "![返信までの時間のグラフ](../../../../refs/287/assets/chart.svg)",
].join("\n\n");

/** 差分の取り出し元: 末尾の近くの段落を書き換えた 2 つのリビジョン */
const diffSource = {
  revisions: async () => [
    { id: "r2", at: "2026-11-02T15:00:00+09:00", label: "付録を書き換える", author: "planner" },
    { id: "r1", at: "2026-10-30T10:00:00+09:00", label: "最初のバージョン", author: "planner" },
  ],
  content: async ({ revisionId }) =>
    revisionId === "r1" ? markdown.replace("付録で決めたことは", "付録の内容は") : markdown,
};

/** コメントの読み書き: `## 付録` の段落の箇所に付いたコメント 1 件を返し、保存は ID を付けて返す */
const commentStore = {
  load: async () => [
    { id: "c1", quote: "付録の数字", prefix: "", suffix: "は、10 月", body: "去年の同じ週の数字も並べたい。" },
  ],
  save: async ({ comment }) => ({ ...comment, id: `c${Date.now()}` }),
};

/** 重ねる部品ごとに mount へ渡す追加の引数 */
const OPTIONS = {
  hover: { config: { "side-toc": { mode: "hover" } } },
  fixed: { config: { "side-toc": { mode: "fixed" } } },
  comments: { commentStore, config: { features: { comments: true } } },
  diff: { diffSource },
};

/** 要素が現れるまで待ち、その要素を返す */
async function waitFor(selector) {
  for (;;) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** 描いた後に場面を作る操作: fixed は目次を出すボタンを押し、差分は「変更を見る」を押してミニマップが出るまで待つ */
const AFTER_MOUNT = {
  fixed: async () => (await waitFor(".mdmark-side-toc-toggle")).click(),
  comments: () => waitFor(".mdmark-comment-marker"),
  diff: async () => {
    (await waitFor(".mdmark-diff-toggle")).click();
    await waitFor(".mdmark-diff-minimap");
  },
};

document.body.dataset.host = scene.host;
const root = document.querySelector("#doc");
mount(root, { markdown, docId: "inquiry-review", ...OPTIONS[scene.with] });
await AFTER_MOUNT[scene.with]?.();
attachBackToTop(root, { threshold: scene.threshold, avoidMargin: scene.margin === "shift" });
