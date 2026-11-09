// map の図を含む文書を見る場面: 配布物の mount で本文を描き、map の範囲の場所にモックの map の図を置く。
// URL の ?scene= で場面（overview・group・collapsed・edge-list・node・view・walkthrough・play・warnings）、?scheme= で明暗を選ぶ

import { mount } from "../../../../../dist/index.js";
import { createMap, createSequence } from "./map-mock.js";
import { DATA, FLOW, SEQUENCE } from "./samples.js";

/** 場面と、操作列に出す名前 */
const SCENES = {
  overview: "全体",
  group: "グループの中",
  collapsed: "グループを閉じる",
  "edge-list": "まとめた線の一覧",
  node: "ノードのページ",
  view: "視点",
  walkthrough: "巡回",
  play: "再生",
  warnings: "書き方の警告",
};
const DEFAULT_SCENE = "overview";
const DEFAULT_SCHEME = "light";

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? DEFAULT_SCENE;
const scheme = params.get("scheme") ?? DEFAULT_SCHEME;

const sceneGroup = document.querySelector("[data-scene-list]");
for (const [value, label] of Object.entries(SCENES)) {
  const query = new URLSearchParams();
  if (value !== DEFAULT_SCENE) query.set("scene", value);
  if (scheme !== DEFAULT_SCHEME) query.set("scheme", scheme);
  const link = document.createElement("a");
  link.className = "mock-bar-item";
  link.href = query.size ? `?${query}` : "index.html";
  link.textContent = label;
  if (value === scene) link.setAttribute("aria-current", "page");
  sceneGroup.append(link);
}
for (const link of document.querySelectorAll("[data-scene-scheme]")) {
  const value = link.dataset.sceneScheme;
  const query = new URLSearchParams();
  if (scene !== DEFAULT_SCENE) query.set("scene", scene);
  if (value !== DEFAULT_SCHEME) query.set("scheme", value);
  link.href = query.size ? `?${query}` : "index.html";
  if (value === scheme) link.setAttribute("aria-current", "page");
}

const markdown = `# 文書を描く仕組み

mdmark が map の範囲を図にするまでの構成。

MAP-SLOT-FLOW

## 描くまでの流れ

MAP-SLOT-SEQUENCE

図の後ろの本文。
`;

document.body.classList.add(scheme === "dark" ? "mdmark-theme-dark" : "mdmark-theme-light");
const doc = document.getElementById("doc");
mount(doc, { markdown });
// 本文の場所の目印の段落を、map の図に置き換える
const slot = (text) => [...doc.querySelectorAll("p")].find((p) => p.textContent.trim() === text);

const initial = {
  group: { enter: "lib" },
  collapsed: { collapsed: ["read"] },
  "edge-list": { collapsed: ["read"], edgeList: "L6" },
  node: { node: "layout" },
  view: { view: "データの流れ" },
  walkthrough: { step: 2, enter: "place" },
  play: { play: 2 },
}[scene] ?? {};

const map = createMap({ title: "全体の構成", flow: FLOW, data: DATA, sequence: SEQUENCE }, initial);
const flowSlot = slot("MAP-SLOT-FLOW");
flowSlot.replaceWith(map.frame);
if (scene === "play") map.frame.dataset.paused = "true";

const sequenceSlot = slot("MAP-SLOT-SEQUENCE");
sequenceSlot.replaceWith(
  createSequence(SEQUENCE, () => {
    map.startPlay();
    map.frame.scrollIntoView({ block: "nearest" });
  }),
);

if (scene === "warnings") {
  // 書き方の警告: 図の枠の上に、読めない行・知らないキー・知らない引数を並べる
  const warning = document.createElement("div");
  warning.className = "map-warning";
  warning.setAttribute("role", "note");
  warning.innerHTML = `<p>map の書き方の警告</p><ul>
<li>mermaid の 14 行目 <code>gw -&gt; api</code> を読めません。矢印は <code>--&gt;</code> で記載してください</li>
<li>補足の知らないキー <code>layuot</code> を無視しました。使用できるキーは notes・relations・walkthroughs・layout・plays_over・links です</li>
<li>マーカーの知らない引数 <code>mdoe=boxes</code> を無視しました。使用できる引数は view・focus・play・title・open・closed です</li>
</ul>`;
  map.frame.before(warning);
}
