// map の図を含む文書を見る場面: 配布物の mount で本文を描き、map の範囲の場所にモックの map の図を置く。
// URL の ?scene= で場面（overview・group・collapsed・walkthrough・play・warnings）、?scheme= で明暗を選ぶ

import { mount } from "../../../../../dist/index.js";
import { createMap, createSequence } from "./map-mock.js";
import { DATA, FLOW, SEQUENCE } from "./samples.js";

/** 場面と、操作列に出す名前 */
const SCENES = {
  overview: "全体",
  group: "グループの中",
  collapsed: "グループを閉じる",
  walkthrough: "案内の手順",
  play: "再生",
  warnings: "書き方の警告",
};
const DEFAULT_SCENE = "overview";
const DEFAULT_SCHEME = "light";

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? DEFAULT_SCENE;
const scheme = params.get("scheme") ?? DEFAULT_SCHEME;

/** 今の選択のうち 1 つだけを変えた URL（既定の値は書かない） */
const linkTo = (change) => {
  const current = { scene, scheme, ...change };
  const defaults = { scene: DEFAULT_SCENE, scheme: DEFAULT_SCHEME };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) if (value !== defaults[key]) query.set(key, value);
  return query.size ? `?${query}` : "index.html";
};

const sceneGroup = document.querySelector("[data-scene-list]");
for (const [value, label] of Object.entries(SCENES)) {
  const link = document.createElement("a");
  link.className = "mock-bar-item";
  link.href = linkTo({ scene: value });
  link.textContent = label;
  if (value === scene) link.setAttribute("aria-current", "page");
  sceneGroup.append(link);
}
for (const [attr, key, current] of [["sceneScheme", "scheme", scheme]]) {
  for (const link of document.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) {
    const value = link.dataset[attr];
    link.href = linkTo({ [key]: value });
    if (value === current) link.setAttribute("aria-current", "page");
  }
}

const markdown = `# 文書を描く仕組み

mdmark が map の範囲を図にするまでの構成。

<!-- wide -->

MAP-SLOT-FLOW

<!-- /wide -->

## 描くまでの流れ

<!-- wide -->

MAP-SLOT-SEQUENCE

<!-- /wide -->

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
  walkthrough: { step: 2, enter: "place" },
}[scene] ?? {};

const flowHost = document.createElement("div");
flowHost.className = "map-host";
const flowSlot = slot("MAP-SLOT-FLOW");
// map の図は常に置き場所の幅いっぱいに広げる（wide の範囲の切り替えのボタンを出さない）
flowSlot.closest(".mdmark-wide-range")?.parentElement.classList.add("map-wide");
flowSlot.replaceWith(flowHost);
const sequenceHost = document.createElement("div");
sequenceHost.className = "map-host";
const sequenceSlot = slot("MAP-SLOT-SEQUENCE");
sequenceSlot.closest(".mdmark-wide-range")?.parentElement.classList.add("map-wide");
sequenceSlot.replaceWith(sequenceHost);
let map;
// シーケンス図の帯で進めたメッセージを、構成図の上でも強調する
const sequenceView = createSequence(sequenceHost, SEQUENCE, { user: "external" }, (index) => map.showMessage(index));

// 開閉と中へ入った状態は場面ごとに sessionStorage へ保つ。構成図の案内を始めたら、シーケンス図の強調を解く
map = createMap(
  flowHost,
  { id: scene, title: "全体の構成", flow: FLOW, data: DATA, sequence: SEQUENCE, onWalkthrough: () => sequenceView.clear() },
  initial,
);
if (scene === "play") sequenceView.start(0);

if (scene === "warnings") {
  // 書き方の警告: 図の枠の上に、読めない行・知らないキー・知らない引数を並べる
  const warning = document.createElement("div");
  warning.className = "map-warning";
  warning.setAttribute("role", "note");
  warning.innerHTML = `<p>map の書き方の警告</p><ul>
<li>mermaid の 14 行目 <code>gw -&gt; api</code> を読めません。矢印は <code>--&gt;</code> で記載してください</li>
<li>補足の知らないキー <code>layuot</code> を無視しました。使用できるキーは version・notes・walkthroughs・layout・plays_over です</li>
<li>マーカーの知らない引数 <code>mdoe=boxes</code> を無視しました。使用できる引数は focus・play・title・open・closed・interval です</li>
</ul>`;
  flowHost.before(warning);
}
