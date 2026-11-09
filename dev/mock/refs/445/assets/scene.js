// map の図を含む文書を見る場面: 配布物の mount で本文を描き、map の範囲の場所にモックの map の図を置く。
// URL の ?scene= で場面（overview・group・collapsed・walkthrough・play・warnings）、?scheme= で明暗を選ぶ

import { mount } from "../../../../../dist/index.js";
import { createMap, createSequence, MAP_MIN_SCALE } from "./map-mock.js";
import { DATA, FLOW, SEQUENCE } from "./samples.js";

/** 場面と、操作列に出す名前 */
const SCENES = {
  overview: "全体",
  group: "グループの中",
  collapsed: "グループを閉じる",
  walkthrough: "案内",
  play: "再生",
  warnings: "書き方の警告",
};
const DEFAULT_SCENE = "overview";
const DEFAULT_SCHEME = "light";

const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? DEFAULT_SCENE;
const scheme = params.get("scheme") ?? DEFAULT_SCHEME;
/** 開いたときの倍率の案（論点 1）: wide は図の枠を wide の範囲で広げてから倍率を決める案 C、fit は本文の幅のまま倍率を決める案 A */
const DEFAULT_FIT = "wide";
const fit = params.get("fit") ?? DEFAULT_FIT;
/** 狭い幅で図を縮める下限の案（論点 1）: fit は今のフロー図と同じく枠の幅に合わせて縮める案 A、min は等倍より縮めない案 B */
const DEFAULT_SHRINK = "min";
const shrink = params.get("shrink") ?? DEFAULT_SHRINK;

/** 今の選択のうち 1 つだけを変えた URL（既定の値は書かない） */
const linkTo = (change) => {
  const current = { scene, scheme, fit, shrink, ...change };
  const defaults = { scene: DEFAULT_SCENE, scheme: DEFAULT_SCHEME, fit: DEFAULT_FIT, shrink: DEFAULT_SHRINK };
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
for (const [attr, key, current] of [["sceneScheme", "scheme", scheme], ["sceneFit", "fit", fit], ["sceneShrink", "shrink", shrink]]) {
  for (const link of document.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`)) {
    const value = link.dataset[attr];
    link.href = linkTo({ [key]: value });
    if (value === current) link.setAttribute("aria-current", "page");
  }
}

const markdown = `# 文書を描く仕組み

mdmark が map の範囲を図にするまでの構成。

${fit === "wide" ? "<!-- wide -->\n\nMAP-SLOT-FLOW\n\n<!-- /wide -->" : "MAP-SLOT-FLOW"}

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
  walkthrough: { step: 2, enter: "place" },
  play: { play: 2, paused: true },
}[scene] ?? {};

const flowHost = document.createElement("div");
slot("MAP-SLOT-FLOW").replaceWith(flowHost);
// 開閉と中へ入った状態は場面ごとに sessionStorage へ保つ
const map = createMap(flowHost, { id: scene, title: "全体の構成", flow: FLOW, data: DATA, sequence: SEQUENCE }, initial, shrink === "min" ? { minScale: MAP_MIN_SCALE() } : {});

const sequenceHost = document.createElement("div");
slot("MAP-SLOT-SEQUENCE").replaceWith(sequenceHost);
createSequence(sequenceHost, SEQUENCE, { user: "external" }, () => {
  map.startPlay();
  flowHost.scrollIntoView({ block: "nearest" });
});

if (scene === "warnings") {
  // 書き方の警告: 図の枠の上に、読めない行・知らないキー・知らない引数を並べる
  const warning = document.createElement("div");
  warning.className = "map-warning";
  warning.setAttribute("role", "note");
  warning.innerHTML = `<p>map の書き方の警告</p><ul>
<li>mermaid の 14 行目 <code>gw -&gt; api</code> を読めません。矢印は <code>--&gt;</code> で記載してください</li>
<li>補足の知らないキー <code>layuot</code> を無視しました。使用できるキーは version・notes・walkthroughs・layout・plays_over です</li>
<li>マーカーの知らない引数 <code>mdoe=boxes</code> を無視しました。使用できる引数は focus・play・title・open・closed です</li>
</ul>`;
  flowHost.before(warning);
}
