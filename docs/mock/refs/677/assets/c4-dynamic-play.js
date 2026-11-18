// #677 のモックの C4Dynamic の再生: 番号つきの関係を番号の順に手順にし、#660 の再生の帯（手順のバー）で 1 本ずつ選んで繰り返し再生する。
// 図は #660 の C4 図のモック（createC4KindMap）で描き、手順ごとにその関係の線と両端の要素のほかを薄くして、その線だけにデータのマーカーを流す。
// 補足の walkthroughs を持つ図は、関係の再生の代わりに案内の手順を進める

import { createC4KindMap } from "../../660/assets/c4-kinds.js";
import { applyDensity, createBand, renderBand } from "../../660/assets/band.js";

/** 補足の walkthroughs を持たず、境界を閉じて始め、BiRel を持つ C4Dynamic */
export const DYNAMIC = `C4Dynamic
  title 注文の流れ
  Person(customer, "顧客")
  Container(web, "注文の画面", "React")
  Container(api, "注文の API", "Node.js")
  Container_Boundary(store, "注文の保存") {
    ContainerDb(db, "注文のデータベース", "PostgreSQL")
  }
  Rel(customer, web, "注文を入力する")
  Rel(web, api, "注文を送る", "JSON/HTTPS")
  RelIndex(7, api, web, "受付の番号を返す")
  Rel(api, db, "注文を保存する", "SQL")
  BiRel(web, customer, "結果を確かめる")
`;

/** 2 本目の関係に説明を持ち、注文の保存の境界を閉じて始める補足 */
export const DYNAMIC_DATA = {
  version: 1,
  notes: { L1: { text: "画面の入力を JSON にして API へ送る" } },
  layout: { store: { collapsed: true } },
};

/** 同じ C4Dynamic に、手順 2 つの案内を加えた補足 */
export const DYNAMIC_WALK_DATA = {
  version: 1,
  notes: {},
  layout: {},
  walkthroughs: [
    { title: "注文を受け付ける", text: "顧客の入力を画面が受け、API へ送る", highlight: ["customer", "web", "api"] },
    { title: "注文を保存する", text: "API が注文をデータベースに保存する", highlight: ["api", "db"] },
  ],
};

/** 関係の行（Rel・RelIndex・BiRel）を、記載の順の番号の手順にする */
const relationSteps = (source, data) => {
  const names = Object.fromEntries([...source.matchAll(/^\s*\w+\((\w+),\s*"([^"]*)"/gm)].map((match) => [match[1], match[2]]));
  const relations = [...source.matchAll(/^\s*(RelIndex|BiRel|Rel)\((.*)\)\s*$/gm)].map((match) => {
    const values = [...match[2].matchAll(/"([^"]*)"|([^,\s][^,]*)/g)].map((item) => (item[1] ?? item[2]).trim());
    const [from, to, label] = match[1] === "RelIndex" ? values.slice(1) : values;
    return { from, to, label, both: match[1] === "BiRel" };
  });
  return relations.map((relation, index) => ({
    title: `${index + 1}: ${names[relation.from]} ${relation.both ? "↔" : "→"} ${names[relation.to]}：${relation.label}`,
    text: data.notes?.[`L${index}`]?.text ?? "",
    highlight: [relation.from, relation.to],
    edge: `L${index}`,
  }));
};

/** 再生している関係の線だけを残し、ほかの線を薄くし、ほかのデータのマーカーを削除する */
const keepEdge = (host, edge) => {
  for (const wire of host.querySelectorAll("[data-wire]")) {
    if (wire.dataset.wire === edge) continue;
    wire.classList.add("map-dim");
  }
  const kept = host.querySelector(`[data-wire="${CSS.escape(edge)}"]`);
  const keptPath = kept?.matches("path") ? kept : kept?.querySelector("path");
  for (const packet of host.querySelectorAll(".map-packet")) {
    const href = packet.querySelector("mpath")?.getAttribute("href");
    if (!keptPath || href !== `#${keptPath.id}`) packet.remove();
  }
};

/** 図を描く。step を指定するとその手順の強調で描く */
const drawFigure = (host, spec, steps, walk, step) => {
  host.replaceChildren();
  const data = walk ? spec.data : { ...spec.data, walkthroughs: steps.map(({ title, text, highlight }) => ({ title, text, highlight })) };
  createC4KindMap(host, { id: spec.id, source: spec.source, data }, step === undefined ? {} : { step });
  if (!walk && step !== undefined) keepEdge(host, steps[step].edge);
};

/** 帯の状態ごとの見本: 図と、その下の再生の帯を描く */
export const createC4DynamicStill = (host, spec, state = {}) => {
  const walk = Boolean(spec.data.walkthroughs?.length);
  const steps = walk ? spec.data.walkthroughs : relationSteps(spec.source, spec.data);
  const figureHost = document.createElement("div");
  const bandHost = document.createElement("div");
  host.append(figureHost, bandHost);
  drawFigure(figureHost, spec, steps, walk, state.index);
  const step = state.index === undefined ? undefined : steps[state.index];
  bandHost.innerHTML = renderBand({
    total: steps.length,
    titles: steps.map((item) => item.title),
    index: state.index,
    title: step?.title,
    text: step?.text,
    playing: state.index !== undefined,
    fill: state.fill ?? 0,
    label: walk ? `「${spec.title}」の案内` : `「${spec.title}」の再生`,
  });
  applyDensity(bandHost);
};

/** 実演: 区切りか左右の矢印で関係を選んで繰り返し再生し、図の空いた場所を押すと停止する */
export const createC4DynamicPlay = (host, spec) => {
  const walk = Boolean(spec.data.walkthroughs?.length);
  const steps = walk ? spec.data.walkthroughs : relationSteps(spec.source, spec.data);
  const figureHost = document.createElement("div");
  const bandHost = document.createElement("div");
  host.append(figureHost, bandHost);
  let current;
  const blankHandlers = [];
  let down;
  figureHost.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, blank: !event.target.closest("[data-node], [data-group], [data-box], .map-wire-hit, button, a, input") };
  });
  // 図の空いた場所を押して離したら停止する。4px 以上動かしたらドラッグとして止めない
  figureHost.addEventListener("pointerup", (event) => {
    if (down?.blank && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 4) for (const handler of blankHandlers) handler();
    down = undefined;
  });
  const figure = {
    show: (step) => {
      const index = steps.indexOf(step);
      if (index === current) return;
      current = index;
      drawFigure(figureHost, spec, steps, walk, index);
    },
    reset: () => {
      current = undefined;
      drawFigure(figureHost, spec, steps, walk, undefined);
    },
    resume: () => {},
    onBlankClick: (handler) => blankHandlers.push(handler),
  };
  figure.reset();
  createBand(bandHost, { steps, label: walk ? `「${spec.title}」の案内` : `「${spec.title}」の再生` }, figure);
};
