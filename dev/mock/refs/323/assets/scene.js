// 右側の目次を画面の右端に置く場面: 配布物の mount で長い文書を描き、#323 の案で右端の線と目次の枠の位置を決める。
// URL の ?edge=・?minimap=・?host= で右端の置き方の案と、差分のミニマップの有無・描く場所を選ぶ

import { mount } from "../../../../../dist/index.js";
import { applyPinIcon, reshapeHead } from "../../320/assets/proposal.js";

/** 案の軸ごとの既定（URL に無いときの値。未確定の論点は推奨の案） */
const DEFAULTS = { edge: "avoid", minimap: "off", host: "window" };

/** 案 A の右端からの間隔（先頭へ戻るボタンの --mdmark-back-to-top-gap と同じ 1rem） */
const EDGE_GAP_REM = 1;
/** 案 A でミニマップを避けるときの、ミニマップの左端からの間隔（先頭へ戻るボタンの BACK_TO_TOP_AVOID_GAP_PX と同じ） */
const AVOID_GAP_PX = 8;
/** 右端の線の上端から、枠で覆う高さ（線 3 本分。SIDE_TOC_RAIL_COVER_REM） */
const RAIL_COVER_REM = 2;
/** ミニマップの見立ての幅（--mdmark-diff-minimap-width） */
const MINIMAP_WIDTH_PX = 14;

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

/** 見出し 1 の下に見出し 2・見出し 3 を並べた、画面より長い文書 */
const markdown = [
  "# 問い合わせ窓口の見直し",
  "窓口ごとの件数と返信までの時間を並べ、来月からの受け持ちを決める。",
  `## 導入\n\n${paragraphs("導入")}`,
  `### 前提\n\n${paragraphs("前提")}`,
  `## 窓口ごとの件数\n\n${paragraphs("窓口ごとの件数")}`,
  `## 返信までの時間\n\n${paragraphs("返信までの時間")}`,
  `### 電話の折り返し\n\n${paragraphs("電話の折り返し")}`,
  `## 受け持ちの組み替え\n\n${paragraphs("受け持ちの組み替え")}`,
  `## 来月の予定\n\n${paragraphs("来月の予定")}`,
].join("\n\n");

/** 描く先の要素に最も近い、縦にスクロールする祖先の要素を返す（無ければ null で、画面全体がスクロールする） */
function scrollParent(element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/** 見えている枠（スクロールバーを除く）の上端・下端・右端を、画面の座標で返す */
function frameRect(scroller) {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  if (!scroller) return { top: 0, bottom: viewportHeight, right: viewportWidth };
  const rect = scroller.getBoundingClientRect();
  return {
    top: rect.top + scroller.clientTop,
    bottom: Math.min(rect.top + scroller.clientTop + scroller.clientHeight, viewportHeight),
    right: rect.left + scroller.clientLeft + scroller.clientWidth,
  };
}

/** 差分のミニマップの見立てを、見えている枠の右端に高さいっぱいで置く */
function placeMinimap(minimap, frame) {
  const viewportWidth = document.documentElement.clientWidth;
  minimap.style.setProperty("--minimap-top", `${frame.top}px`);
  minimap.style.setProperty("--minimap-right", `${viewportWidth - frame.right}px`);
  minimap.style.setProperty("--minimap-height", `${frame.bottom - frame.top}px`);
}

/** 右端の線と目次の枠の右端の位置を、画面の右端からの距離（px）で返す */
function edgeRight(aside, frame, minimap, rem) {
  const viewportWidth = document.documentElement.clientWidth;
  // 今（比較）: 描く先の要素の右端に寄った aside の右端
  if (scene.edge === "current") return viewportWidth - aside.getBoundingClientRect().right;
  const frameRight = viewportWidth - frame.right;
  // B: 見えている枠の右端に接する。ミニマップとの重なりは重なりの順だけで決まる
  if (scene.edge === "flush") return frameRight;
  // A: 見えている枠の右端から 1rem 離す。ミニマップがあれば、その左端から 8px 左へずらす
  if (minimap) return frameRight + MINIMAP_WIDTH_PX + AVOID_GAP_PX;
  return frameRight + EDGE_GAP_REM * rem;
}

/** 右端の線と目次の枠の位置を、見えている枠・aside・描く先の要素から決めて aside の CSS 変数に入れる */
function followEdge(root, aside, minimap) {
  const scroller = scrollParent(root);
  const update = () => {
    const frame = frameRect(scroller);
    if (minimap) placeMinimap(minimap, frame);
    const style = getComputedStyle(root);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const stickyTop = Number.parseFloat(style.getPropertyValue("--mdmark-sticky-top")) || 0;
    // --mdmark-space は rem の値: ルートの文字の大きさで px にする
    const space = Number.parseFloat(style.getPropertyValue("--mdmark-space")) * rem;
    const panelTop = frame.top + stickyTop + space;
    const asideRect = aside.getBoundingClientRect();
    // 右端の線の上端: 文書の先頭では aside の位置、スクロールした後は枠の上端と同じ位置
    const railTop = Math.max(asideRect.top, panelTop);
    // 右端の線の下端: 見えている枠と描く先の要素の両方に収める
    const railBottom = Math.min(frame.bottom, root.getBoundingClientRect().bottom);
    const railHeight = Math.max(railBottom - railTop - space, 0);
    aside.style.setProperty("--edge-right", `${edgeRight(aside, frame, minimap, rem)}px`);
    aside.style.setProperty("--edge-panel-top", `${panelTop}px`);
    aside.style.setProperty("--edge-panel-min-height", `${Math.max(railTop + RAIL_COVER_REM * rem - panelTop, 0)}px`);
    aside.style.setProperty("--edge-rail-top", `${railTop}px`);
    aside.style.setProperty("--edge-rail-height", `${railHeight}px`);
    aside.toggleAttribute("data-rail-outside", railHeight === 0);
  };
  update();
  // スクロールする要素の中でも、画面全体のスクロールで要素の位置が変わるため両方で決め直す
  scroller?.addEventListener("scroll", update, { passive: true });
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
}

/** 差分のミニマップの見立て（モックだけ）を作る。削除した行と追加した行の印を文書の位置の割合で並べる */
function createMinimap() {
  const minimap = document.createElement("div");
  minimap.className = "mock-minimap";
  minimap.setAttribute("aria-hidden", "true");
  for (const [kind, ratio] of [["del", 0.18], ["add", 0.2], ["add", 0.46], ["del", 0.71], ["add", 0.73]]) {
    const mark = document.createElement("span");
    mark.dataset.kind = kind;
    mark.style.insetBlockStart = `${ratio * 100}%`;
    minimap.append(mark);
  }
  document.body.append(minimap);
  return minimap;
}

/** 要素が現れるまで待つ */
async function waitFor(selector) {
  while (!root.querySelector(selector)) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

const root = document.querySelector("#doc");
mount(root, { markdown, docId: "inquiry-review" });
await waitFor(".mdmark-side-toc-head");
const aside = root.querySelector(".mdmark-side-toc");
// develop の右側の目次の頭: ラベルを削除してボタンを 1 行に並べ、ピン止めのアイコンを右の列の形にする
reshapeHead(aside);
applyPinIcon(aside.querySelector(".mdmark-side-toc-pin"), "panel");
followEdge(root, aside, scene.minimap === "on" ? createMinimap() : null);
