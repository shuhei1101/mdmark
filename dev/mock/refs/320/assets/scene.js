// 見出しの線と右側の目次を見る場面: 配布物の mount で長い文書を描き、#320 の案を当てる。
// URL の ?rule=・?icon=・?position=・?scheme=・?mode=・?host= で未確定の論点の案と、配色・目次の出し方・描く場所を選ぶ

import { mount } from "../../../../../dist/index.js";
import { applyProposal } from "./proposal.js";

/** 案の軸ごとの既定（URL に無いときの値。未確定の論点は推奨の案） */
const DEFAULTS = { rule: "muted", icon: "panel", position: "viewport", scheme: "light", mode: "hover", host: "window" };

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

// 見出しの線の色・hover で開く位置・配色の案は proposal.css が html の属性で当てる
document.documentElement.dataset.rule = scene.rule;
document.documentElement.dataset.position = scene.position;
document.documentElement.dataset.scheme = scene.scheme;
// 描く場所: 「スクロールする要素の中」は #287 の scene.css が高さ 600px で縦にスクロールする要素にする
document.body.dataset.host = scene.host;
// 撮影用の ?open=1: hover の目次の枠を出したままにする（操作列には置かない）
if (params.has("open")) document.documentElement.dataset.open = "";

/** 節の段落: 画面の高さより長くするため、節ごとに 3 段落を置く */
function paragraphs(topic) {
  return [
    `${topic}は、窓口ごとの件数と返信までの時間を並べて決める。受け付けてから最初の返信を送るまでを数え、休日に受け付けた問い合わせは次の営業日の始業から数える。`,
    `${topic}の数字は、10 月の第 2 週の問い合わせから取った。メールとフォームは自動返信で大半を返せていて、電話は担当者が返す割合が高い。`,
    `${topic}で決めたことは、来週の定例で確かめる。決めたら、窓口の案内のページと自動返信の文面を書き換える。`,
  ].join("\n\n");
}

/** 狭い幅（右側の目次が帯になる 48rem 未満）: 帯と見出しの線・区切り線だけを確かめるため、短い文書を描く */
const NARROW = matchMedia("(width < 48rem)").matches;

/** 狭い幅の文書: 見出し 1 の下に見出し 2 を 2 つと区切り線を置き、段落は 1 つずつにする */
const shortMarkdown = [
  "# 問い合わせ窓口の見直し",
  "窓口ごとの件数と返信までの時間を並べ、来月からの受け持ちを決める。",
  "## 窓口ごとの件数\n\nメールとフォームは自動返信で大半を返せていて、電話は担当者が返す割合が高い。",
  "---",
  "## 返信までの時間\n\n受け付けてから最初の返信を送るまでを数える。",
].join("\n\n");

/** 広い幅の文書: 見出し 1 の下に見出し 2・見出し 3 を並べ、節の間に区切り線を置く。hover で開く位置を確かめるため画面より長くする */
const longMarkdown = [
  "# 問い合わせ窓口の見直し",
  "窓口ごとの件数と返信までの時間を並べ、来月からの受け持ちを決める。",
  `## 導入\n\n${paragraphs("導入")}`,
  `### 前提\n\n${paragraphs("前提")}`,
  `## 窓口ごとの件数\n\n${paragraphs("窓口ごとの件数")}`,
  "---",
  `## 返信までの時間\n\n${paragraphs("返信までの時間")}`,
  `### 電話の折り返し\n\n${paragraphs("電話の折り返し")}`,
  `### チャットの時間帯\n\n${paragraphs("チャットの時間帯")}`,
  "---",
  `## 受け持ちの組み替え\n\n${paragraphs("受け持ちの組み替え")}`,
  `## 来月の予定\n\n${paragraphs("来月の予定")}`,
].join("\n\n");

const markdown = NARROW ? shortMarkdown : longMarkdown;

/** 要素が現れるまで待つ */
async function waitFor(selector) {
  while (!root.querySelector(selector)) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const root = document.querySelector("#doc");
mount(root, { markdown, docId: "inquiry-review", config: { "side-toc": { mode: scene.mode } } });
await waitFor(".mdmark-side-toc-head");
applyProposal(root, { icon: scene.icon, position: scene.position });
