// #660 のモックの C4 の 4 種類: C4Container・C4Component・C4Dynamic・C4Deployment の Mermaid を、#596 の C4 図のモック（createC4Map）の入力へ読み替えて描き、種類の行・配置先のノードの実線の枠・関係の番号を当てる。

import { createC4Map } from "../../596/assets/class-arch-c4.js";

/** 要素の関数名ごとの、読み替える C4Context の関数と種類の行 */
const ELEMENTS = {
  Container: ["System", "Container"],
  ContainerDb: ["SystemDb", "Container"],
  ContainerQueue: ["SystemQueue", "Container"],
  Container_Ext: ["System_Ext", "External Container"],
  ContainerDb_Ext: ["SystemDb_Ext", "External Container"],
  ContainerQueue_Ext: ["SystemQueue_Ext", "External Container"],
  Component: ["System", "Component"],
  ComponentDb: ["SystemDb", "Component"],
  ComponentQueue: ["SystemQueue", "Component"],
  Component_Ext: ["System_Ext", "External Component"],
  ComponentDb_Ext: ["SystemDb_Ext", "External Component"],
  ComponentQueue_Ext: ["SystemQueue_Ext", "External Component"],
};
/** 配置先のノードの関数名 */
const NODES = new Set(["Deployment_Node", "Node", "Node_L", "Node_R"]);

/** 関数の引数の並び（"…" と識別子）を読む */
const args = (text) => [...text.matchAll(/"([^"]*)"|([^,\s][^,]*)/g)].map((match) => (match[1] ?? match[2]).trim());
const q = (text) => `"${String(text ?? "").replaceAll('"', "'")}"`;

/** 4 種類の Mermaid を C4Context の Mermaid に読み替え、種類の行・配置先のノード・番号を返す */
export const toContext = (source) => {
  const [first, ...rest] = source.split("\n");
  const dynamic = first.trim() === "C4Dynamic";
  const kinds = {};
  const nodes = new Set();
  const unreadable = [];
  // Node_L・Node_R の左右の指定（同じ親の配置先のノードの中で、L を左・R を右に横へ並べる）
  const sides = [];
  const parents = [];
  let index = 0;
  const lines = ["C4Context"];
  rest.forEach((raw, line) => {
    const text = raw.trim();
    const call = /^(\w+)\((.*)\)\s*(\{)?$/.exec(text);
    if (!call) {
      if (text === "}") parents.pop();
      lines.push(raw);
      return;
    }
    const [fn, body, open] = [call[1], call[2], call[3] ?? ""];
    const values = args(body);
    // 別名（第 1 引数）を識別子として読めない行は、描画を止めずに書き方の警告にする
    const alias = fn === "RelIndex" ? values[1] : values[0];
    if (!/^\w+$/.test(alias ?? "")) {
      unreadable.push(`${line + 2} 行目 \`${text}\` を読めません。Mermaid の ${first.trim()} の記法（\`Container(…)\`・\`Rel(…)\` など）で記載してください。`);
      return;
    }
    const indent = raw.slice(0, raw.indexOf(fn));
    if (fn in ELEMENTS) {
      const [to, row] = ELEMENTS[fn];
      const [alias, label, tech, description] = values;
      kinds[alias] = tech ? `[${row}: ${tech}]` : `[${row}]`;
      lines.push(`${indent}${to}(${alias}, ${q(label)}, ${q(description)})`);
      return;
    }
    if (fn === "Container_Boundary") {
      if (open) parents.push(values[0]);
      lines.push(`${indent}Boundary(${values[0]}, ${q(`${values[1]} ［Container］`)}) ${open}`);
      return;
    }
    if (NODES.has(fn)) {
      nodes.add(values[0]);
      if (fn === "Node_L" || fn === "Node_R") sides.push({ id: values[0], side: fn.at(-1), parent: parents.at(-1) });
      if (open) parents.push(values[0]);
      lines.push(`${indent}Boundary(${values[0]}, ${q(values[2] ? `${values[1]} ［${values[2]}］` : values[1])}) ${open}`);
      return;
    }
    const rel = /^(RelIndex|(?:Bi)?Rel(?:_\w+)?)$/.exec(fn);
    if (rel) {
      // RelIndex の第 1 引数は Mermaid と同じく読まず、記載の順の番号にする
      const [from, to, label, tech] = fn === "RelIndex" ? values.slice(1) : values;
      index += 1;
      const name = fn === "RelIndex" ? "Rel" : fn;
      lines.push(`${indent}${name}(${from}, ${to}, ${q(dynamic ? `${index}: ${label}` : label)}${tech ? `, ${q(tech)}` : ""})`);
      return;
    }
    lines.push(raw);
  });
  const layout = {};
  for (const parent of new Set(sides.map((entry) => entry.parent))) {
    const group = sides.filter((entry) => entry.parent === parent);
    const [anchor] = group;
    for (const entry of group) layout[entry.id] = { order: entry.side === "L" ? 0 : 2, ...(entry === anchor ? {} : { align: anchor.id }) };
  }
  return { source: lines.join("\n"), kinds, nodes, unreadable, layout };
};

/** 4 種類の C4 図の map */
export const createC4KindMap = (host, spec, initial = {}) => {
  const { source, kinds, nodes, unreadable, layout } = toContext(spec.source);
  const patch = () => {
    for (const [id, row] of Object.entries(kinds)) {
      const element = host.querySelector(`[data-node="${CSS.escape(id)}"] .mdmark-diagram-node-kind`);
      if (element && element.textContent !== row) element.textContent = row;
    }
    for (const id of nodes) host.querySelector(`[data-group="${CSS.escape(id)}"], [data-box="${CSS.escape(id)}"]`)?.classList.add("c4k-node");
  };
  // 関係の相手が読めなかった行の要素なら、その関係も描かない
  const known = new Set([...source.matchAll(/^\s*\w+\((\w+),/gm)].map((match) => match[1]));
  const drawn = source.split("\n").filter((line) => !/^\s*(?:Bi)?Rel\w*\(/.test(line) || line.match(/\((\w+),\s*(\w+)/)?.slice(1).every((id) => known.has(id))).join("\n");
  const figure = document.createElement("div");
  if (unreadable.length) {
    const box = document.createElement("div");
    box.className = "map-warning";
    box.setAttribute("role", "note");
    box.innerHTML = `<p>書き方の警告</p><ul>${unreadable.map((text) => `<li>${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</li>`).join("")}</ul>`;
    host.append(box);
  }
  host.append(figure);
  new MutationObserver(patch).observe(figure, { childList: true, subtree: true });
  createC4Map(figure, { ...spec, source: drawn, data: { ...spec.data, layout: { ...layout, ...(spec.data?.layout ?? {}) } } }, initial);
  patch();
};
