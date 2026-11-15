// map のクラス図・アーキテクチャ図・C4 図のモック: classDiagram・architecture-beta・C4Context の Mermaid と補足を、構成図のモック（#445 の createMap）の入力に読み替えて描く。
// 配置・中へ入る・開閉・案内・選択・ツールチップは構成図と共通で、種類に固有の部分（メンバーの行・関係の端の形・service のアイコン・要素の種類の行）だけをここで足す

import { createMap } from "../../445/assets/map-mock.js";

const SVG = "http://www.w3.org/2000/svg";
const quote = (text) => `"${String(text).replaceAll('"', "'")}"`;
const pathD = (points) => points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");

/** Lucide のアイコン（architecture-beta の既定のアイコン名ごと） */
const ARCH_ICONS = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  disk: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
  internet: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
};
const iconSvg = (name) =>
  `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ARCH_ICONS[name] ?? ""}</svg>`;

/** フォーカスとポインターで出すツールチップ（構成図の線のツールチップと同じ見た目）。マーカーの要素の後ろに置く */
const attachTip = (marker, text) => {
  const tip = document.createElement("div");
  tip.className = "map-wire-tip er-tip";
  tip.setAttribute("role", "tooltip");
  tip.id = `cac-tip-${Math.random().toString(36).slice(2)}`;
  tip.textContent = text;
  tip.hidden = true;
  marker.setAttribute("aria-describedby", tip.id);
  marker.after(tip);
  const show = () => {
    tip.hidden = false;
  };
  const hide = () => {
    tip.hidden = true;
  };
  marker.addEventListener("focus", show);
  marker.addEventListener("blur", hide);
  marker.addEventListener("pointerenter", show);
  marker.addEventListener("pointerleave", hide);
  marker.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hide();
  });
};

/** 2 つのノードをつなぐ最短の経路を全て。戻り値は経路に乗る線の番号と、経路に乗るノード */
const shortestPaths = (links, a, b) => {
  const distance = (origin) => {
    const dist = new Map([[origin, 0]]);
    const queue = [origin];
    while (queue.length) {
      const node = queue.shift();
      for (const link of links) {
        const next = link.from === node ? link.to : link.to === node ? link.from : undefined;
        if (next !== undefined && !dist.has(next)) {
          dist.set(next, dist.get(node) + 1);
          queue.push(next);
        }
      }
    }
    return dist;
  };
  const fromA = distance(a);
  const fromB = distance(b);
  const total = fromA.get(b);
  if (total === undefined) return { nodes: new Set([a, b]), edges: new Set() };
  const nodes = new Set();
  const edges = new Set();
  links.forEach((link, index) => {
    for (const [u, v] of [[link.from, link.to], [link.to, link.from]]) {
      if (fromA.get(u) !== undefined && fromB.get(v) !== undefined && fromA.get(u) + 1 + fromB.get(v) === total) {
        edges.add(`L${index}`);
        nodes.add(u);
        nodes.add(v);
      }
    }
  });
  return { nodes, edges };
};

/** 1 つ選ぶと相手と線を、2 つ選ぶと最短の経路を残す（ER 図と同じ規則） */
const selectionOver = (links) => (selected) => {
  if (selected.size === 1) {
    const [only] = selected;
    const edges = links.flatMap((link, index) => (link.from === only || link.to === only ? [`L${index}`] : []));
    const nodes = new Set([only, ...links.flatMap((link) => (link.from === only ? [link.to] : link.to === only ? [link.from] : []))]);
    return { nodes, edges: new Set(edges) };
  }
  if (selected.size !== 2) return undefined;
  const [a, b] = selected;
  return shortestPaths(links, a, b);
};

/** 図の中の SVG の文字を足す */
const svgText = (svg, x, y, text, className, anchor = "middle") => {
  const node = document.createElementNS(SVG, "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("text-anchor", anchor);
  node.setAttribute("class", className);
  node.textContent = text;
  svg.append(node);
  return node;
};

/** 線の端の点と、端から線の内側への単位の向き */
const endOf = (points, atStart) => {
  const [p, q] = atStart ? [points[0], points[1]] : [points.at(-1), points.at(-2)];
  const length = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return { p, d: [(q[0] - p[0]) / length, (q[1] - p[1]) / length] };
};

/** 関係の端の形（白抜きの三角・黒と白のひし形・開いた矢じり）を、線の端に描く */
const drawEnd = (svg, points, atStart, kind, dimmed) => {
  if (!kind || points.length < 2) return;
  const { p, d } = endOf(points, atStart);
  const n = [-d[1], d[0]];
  const at = (along, side) => [p[0] + d[0] * along + n[0] * side, p[1] + d[1] * along + n[1] * side];
  const shape = document.createElementNS(SVG, kind === "arrow" ? "polyline" : "polygon");
  const pts = {
    triangle: [p, at(14, 8), at(14, -8)],
    "diamond-filled": [p, at(9, 6), at(18, 0), at(9, -6)],
    "diamond-open": [p, at(9, 6), at(18, 0), at(9, -6)],
    arrow: [at(10, 6), p, at(10, -6)],
  }[kind];
  shape.setAttribute("points", pts.map(([x, y]) => `${x},${y}`).join(" "));
  shape.setAttribute("class", `cac-end cac-end-${kind}${dimmed ? " map-dim" : ""}`);
  svg.append(shape);
};

/** 線の d を差し替え、同じ d を持つ当たり判定の線も差し替える */
const replacePath = (svg, edge, points) => {
  const wire = svg.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
  const path = wire?.matches("path") ? wire : wire?.querySelector("path");
  if (!path) return;
  const oldD = path.getAttribute("d");
  path.setAttribute("d", pathD(points));
  for (const hit of svg.querySelectorAll(".map-wire-hit")) if (hit.getAttribute("d") === oldD) hit.setAttribute("d", pathD(points));
  edge.points = points;
};

/** 同じ点から出る・入る線の端を、辺に沿って 16px ずつずらし、端の形がどちらも見えるようにする */
const SHARED_END_GAP = 16;
const spreadSharedEnds = (svg, edges) => {
  const groups = new Map();
  for (const edge of edges) {
    if (edge.points.length < 2) continue;
    for (const atStart of [true, false]) {
      const point = atStart ? edge.points[0] : edge.points.at(-1);
      const key = `${Math.round(point[0])},${Math.round(point[1])}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ edge, atStart });
    }
  }
  for (const ends of groups.values()) {
    if (ends.length < 2) continue;
    ends.forEach(({ edge, atStart }, index) => {
      const shift = (index - (ends.length - 1) / 2) * SHARED_END_GAP;
      const points = edge.points.map((point) => [...point]);
      const [i, j] = atStart ? [0, 1] : [points.length - 1, points.length - 2];
      // 端の区間が横なら縦に、縦なら横にずらす（隣の点も同じだけずらして直角を保つ）
      const axis = points[i][1] === points[j][1] ? 1 : 0;
      points[i][axis] += shift;
      points[j][axis] += shift;
      replacePath(svg, edge, points);
    });
  }
};

/** 両端の区間を除いた最も長い区間の中ほど（ラベルの置き場所）。区間が 1 つなら、その中ほど */
const middleOf = (points) => {
  const all = points.slice(1).map((point, at) => [points[at], point]);
  const inner = all.length > 2 ? all.slice(1, -1) : all;
  const [a, b] = inner.sort((u, v) => Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) - Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]))[0];
  return { vertical: a[0] === b[0], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
};

/** 種類が決める配置の既定に、補足の layout をキーごとに重ねる */
const mergeLayout = (base, extra = {}) => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(extra)) merged[key] = { ...merged[key], ...value };
  return merged;
};

/** 補足の notes のキー（r{番号}）を、構成図の線の ID（L{番号 - 1}）に読み替え、メンバーのキー（{クラス}.{メンバー}）を外す */
const notesFor = (data) =>
  Object.fromEntries(
    Object.entries(data.notes ?? {})
      .filter(([key]) => !key.includes("."))
      .map(([key, value]) => [/^r(\d+)$/.test(key) ? `L${Number(key.slice(1)) - 1}` : key, value.text ?? value]),
  );

/* ---------- クラス図 ---------- */

/** 関係の記号ごとの、線の種類と左右の端の形 */
const CLASS_LINKS = {
  "<|--": { dotted: false, left: "triangle" },
  "--|>": { dotted: false, right: "triangle" },
  "*--": { dotted: false, left: "diamond-filled" },
  "--*": { dotted: false, right: "diamond-filled" },
  "o--": { dotted: false, left: "diamond-open" },
  "--o": { dotted: false, right: "diamond-open" },
  "-->": { dotted: false, right: "arrow" },
  "<--": { dotted: false, left: "arrow" },
  "..>": { dotted: true, right: "arrow" },
  "<..": { dotted: true, left: "arrow" },
  "..|>": { dotted: true, right: "triangle" },
  "<|..": { dotted: true, left: "triangle" },
  "--": { dotted: false },
  "..": { dotted: true },
};
const LINK_RE = new RegExp(
  `^(\\S+)\\s+(?:"([^"]*)"\\s+)?(${Object.keys(CLASS_LINKS)
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[|*.]/g, "\\$&"))
    .join("|")})\\s+(?:"([^"]*)"\\s+)?(\\S+?)(?:\\s*:\\s*(.+))?$`,
);

/** メンバーの 1 行を、可視性・名前・型・静的・抽象・メソッドに読む */
const parseMember = (text) => {
  let body = text.trim();
  const visibility = /^[+\-#~]/.test(body) ? body[0] : "";
  if (visibility) body = body.slice(1);
  const isStatic = body.endsWith("$");
  const isAbstract = body.endsWith("*");
  if (isStatic || isAbstract) body = body.slice(0, -1);
  const method = /^([^(]+)\(([^)]*)\)\s*(.*)$/.exec(body);
  if (method) return { visibility, name: method[1].trim(), text: `${method[1].trim()}(${method[2]})${method[3] ? ` ${method[3]}` : ""}`, method: true, isStatic, isAbstract };
  const [name, ...rest] = body.split(/\s+/);
  return { visibility, name, text: `${name}${rest.length ? ` ${rest.join(" ")}` : ""}`, method: false, isStatic, isAbstract };
};

/** classDiagram を、クラス・メンバー・関係・namespace・ノートに読む */
export const parseClass = (source) => {
  const classes = new Map();
  const relations = [];
  const notes = [];
  const spaces = [];
  let space;
  let current;
  const ensure = (raw) => {
    const generic = /^([^~]+)~([^~]+)~$/.exec(raw);
    const id = generic ? generic[1] : raw;
    if (!classes.has(id)) classes.set(id, { id, generic: generic?.[2], annotation: undefined, members: [], space: space?.id });
    const item = classes.get(id);
    if (generic) item.generic = generic[2];
    return item;
  };
  for (const raw of source.split("\n").slice(1)) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (!text) continue;
    if (current) {
      if (text === "}") current = undefined;
      else if (/^<<.+>>$/.test(text)) current.annotation = text.slice(2, -2);
      else current.members.push(parseMember(text));
      continue;
    }
    const ns = /^namespace\s+(\S+)\s*\{$/.exec(text);
    if (ns) {
      space = { id: ns[1] };
      spaces.push(space);
      continue;
    }
    if (text === "}") {
      space = undefined;
      continue;
    }
    const open = /^class\s+(\S+?)\s*\{$/.exec(text);
    if (open) {
      current = ensure(open[1]);
      continue;
    }
    const plain = /^class\s+(\S+)$/.exec(text);
    if (plain) {
      ensure(plain[1]);
      continue;
    }
    const annotation = /^<<(.+)>>\s+(\S+)$/.exec(text);
    if (annotation) {
      ensure(annotation[2]).annotation = annotation[1];
      continue;
    }
    const note = /^note\s+for\s+(\S+)\s+"([^"]*)"$/.exec(text);
    if (note) {
      notes.push({ of: note[1], text: note[2] });
      continue;
    }
    const member = /^(\S+)\s*:\s*(.+)$/.exec(text);
    if (member && !LINK_RE.test(text)) {
      ensure(member[1]).members.push(parseMember(member[2]));
      continue;
    }
    const link = LINK_RE.exec(text);
    if (link) {
      const kind = CLASS_LINKS[link[3]];
      relations.push({ from: ensure(link[1]).id, to: ensure(link[5]).id, fromCard: link[2], toCard: link[4], label: link[6], ...kind });
    }
  }
  return { classes: [...classes.values()], relations, notes, spaces };
};

const CLASS_KINDS = {
  class: { label: "クラス", shape: "rect" },
  annotated: { label: "", shape: "rect" },
  note: { label: "ノート", shape: "rect" },
};

/** クラス図の map: クラスをメンバーの行を持つノード、namespace をグループ、関係を端の形を持つ線にする */
export const createClassMap = (host, { id, title, source, data = {} }, initial = {}) => {
  const chart = parseClass(source);
  const lines = ["flowchart LR"];
  for (const space of chart.spaces) {
    lines.push(`  subgraph ${space.id} [${space.id}]`, "    direction TB");
    for (const item of chart.classes.filter((entry) => entry.space === space.id)) lines.push(`    ${item.id}[${quote(item.generic ? `${item.id}<${item.generic}>` : item.id)}]:::${item.annotation ? "annotated" : "class"}`);
    lines.push("  end");
  }
  for (const item of chart.classes.filter((entry) => !entry.space)) lines.push(`  ${item.id}[${quote(item.generic ? `${item.id}<${item.generic}>` : item.id)}]:::${item.annotation ? "annotated" : "class"}`);
  chart.notes.forEach((note, index) => lines.push(`  note_${index}[${quote(note.text)}]:::note`));
  for (const rel of chart.relations) lines.push(`  ${rel.from} ${rel.dotted ? "-.-" : "---"} ${rel.to}`);
  chart.notes.forEach((note, index) => lines.push(`  ${note.of} -.- note_${index}`));
  const noteEdges = new Set(chart.notes.map((_, index) => `L${chart.relations.length + index}`));
  const membersUnder = (spaceId) => chart.classes.filter((item) => item.space === spaceId).length;
  return createMap(
    host,
    {
      id,
      title,
      flow: lines.join("\n"),
      data: { ...data, notes: notesFor(data), layout: mergeLayout(Object.fromEntries(chart.classes.map((item) => [item.id, { width: 220 }])), data.layout) },
      config: { kinds: CLASS_KINDS, lines: { "-->": { head: "none" }, "-.->": { dash: "dashed", head: "none" } } },
      interval: data.interval,
      collapsedTag: (spaceId) => `クラス ${membersUnder(spaceId)}`,
      decorateNode: (element, nodeId, { faded, collapsed, toggle }) => {
        const item = chart.classes.find((entry) => entry.id === nodeId);
        if (!item || faded) return;
        const head = element.querySelector(".mdmark-diagram-node-kind");
        if (item.annotation && head) {
          const mark = Object.assign(document.createElement("span"), { className: "cac-annotation", textContent: `«${item.annotation}»` });
          head.prepend(mark);
          head.classList.remove("is-empty");
        }
        const closed = collapsed.has(nodeId);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "er-toggle";
        button.setAttribute("aria-expanded", String(!closed));
        button.setAttribute("aria-label", `${item.id}のメンバーを${closed ? "開く" : "閉じる"}`);
        button.textContent = closed ? `メンバー ${item.members.length}` : "▾";
        button.addEventListener("click", () => toggle(nodeId));
        head?.append(button);
        if (closed) return;
        for (const group of [item.members.filter((member) => !member.method), item.members.filter((member) => member.method)]) {
          const list = document.createElement("div");
          list.className = "cac-members";
          list.setAttribute("role", "list");
          for (const member of group) {
            const row = document.createElement("div");
            row.className = `cac-member${member.isStatic ? " is-static" : ""}${member.isAbstract ? " is-abstract" : ""}`;
            row.setAttribute("role", "listitem");
            row.innerHTML = `<span class="cac-visibility">${member.visibility}</span><span class="cac-text">${member.text}</span>`;
            const cell = document.createElement("span");
            cell.className = "er-note-cell";
            const text = data.notes?.[`${item.id}.${member.name}`]?.text;
            if (text) {
              const mark = Object.assign(document.createElement("button"), { type: "button", className: "er-note", textContent: "i" });
              mark.setAttribute("aria-label", `${member.name}の説明`);
              cell.append(mark);
              attachTip(mark, text);
            }
            row.append(cell);
            list.append(row);
          }
          element.append(list);
        }
      },
      selectionOf: selectionOver(chart.relations),
      afterRender: (figure, layout) => {
        const svg = figure.querySelector(".mdmark-diagram-wires");
        if (!svg) return;
        for (const noteId of noteEdges) svg.querySelector(`[data-wire="${noteId}"]`)?.classList.add("er-note-line");
        spreadSharedEnds(svg, layout.edges.filter((edge) => chart.relations[Number(edge.id.slice(1))]));
        for (const edge of layout.edges) {
          const rel = chart.relations[Number(edge.id.slice(1))];
          if (!rel || edge.points.length < 2) continue;
          const reversed = edge.from !== rel.from;
          const dimmed = svg.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`)?.classList.contains("map-dim");
          drawEnd(svg, edge.points, true, reversed ? rel.right : rel.left, dimmed);
          drawEnd(svg, edge.points, false, reversed ? rel.left : rel.right, dimmed);
          for (const [atStart, card] of [[true, reversed ? rel.toCard : rel.fromCard], [false, reversed ? rel.fromCard : rel.toCard]]) {
            if (!card) continue;
            const { p, d } = endOf(edge.points, atStart);
            svgText(svg, p[0] + d[0] * 24 - d[1] * 10, p[1] + d[1] * 24 + d[0] * 10 + 4, card, `er-card${dimmed ? " map-dim" : ""}`);
          }
          if (rel.label) {
            const { vertical, mid } = middleOf(edge.points);
            svgText(svg, vertical ? mid[0] - 8 : mid[0], vertical ? mid[1] + 4 : mid[1] - 8, rel.label, `er-label${dimmed ? " map-dim" : ""}`, vertical ? "end" : "middle");
          }
        }
      },
    },
    initial,
  );
};

/* ---------- アーキテクチャ図 ---------- */

const SIDES = { L: "left", R: "right", T: "top", B: "bottom" };

/** architecture-beta を、group・service・junction・線（両端の辺）に読む */
export const parseArch = (source) => {
  const groups = [];
  const items = [];
  const edges = [];
  for (const raw of source.split("\n").slice(1)) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (!text) continue;
    const group = /^group\s+(\w+)(?:\((\w+)\))?\[([^\]]*)\](?:\s+in\s+(\w+))?$/.exec(text);
    if (group) {
      groups.push({ id: group[1], icon: group[2], title: group[3], parent: group[4] });
      continue;
    }
    const service = /^service\s+(\w+)(?:\((\w+)\))?\[([^\]]*)\](?:\s+in\s+(\w+))?$/.exec(text);
    if (service) {
      items.push({ id: service[1], icon: service[2], label: service[3], parent: service[4], kind: "service" });
      continue;
    }
    const junction = /^junction\s+(\w+)(?:\s+in\s+(\w+))?$/.exec(text);
    if (junction) {
      items.push({ id: junction[1], label: "", parent: junction[2], kind: "junction" });
      continue;
    }
    const edge = /^(\w+)(\{group\})?:([LRTB])\s*(<?)--(>?)\s*([LRTB]):(\w+)(\{group\})?$/.exec(text);
    if (edge)
      edges.push({ from: edge[1], fromSide: SIDES[edge[3]], to: edge[7], toSide: SIDES[edge[6]], tail: edge[4] === "<", head: edge[5] === ">", fromGroup: Boolean(edge[2]), toGroup: Boolean(edge[8]) });
  }
  return { groups, items, edges };
};

const ARCH_KINDS = {
  service: { label: "", shape: "rounded" },
  junction: { label: "", shape: "start" },
};

/** アーキテクチャ図の map: group をグループ、service をアイコンを持つノード、junction を小さい点、線を辺の指定に合わせた線にする */
export const createArchMap = (host, { id, title, source, data = {} }, initial = {}) => {
  const chart = parseArch(source);
  const lines = ["flowchart LR"];
  const emit = (parent, indent) => {
    for (const group of chart.groups.filter((entry) => entry.parent === parent)) {
      lines.push(`${indent}subgraph ${group.id} [${group.title}]`);
      emit(group.id, `${indent}  `);
      lines.push(`${indent}end`);
    }
    for (const item of chart.items.filter((entry) => entry.parent === parent)) lines.push(`${indent}${item.id}[${quote(item.label || " ")}]:::${item.kind}`);
  };
  emit(undefined, "  ");
  // 上下の辺でつなぐ線は、同じ段に並べるため逆向きに書いて段の数を増やさない（描く経路は afterRender で辺の指定から引き直す）
  const sameRank = (edge) => edge.fromSide === "bottom" || edge.fromSide === "top";
  for (const edge of chart.edges) {
    const [a, b] = sameRank(edge) ? [edge.to, edge.from] : [edge.from, edge.to];
    lines.push(`  ${a} ${edge.head || edge.tail ? (edge.head && edge.tail ? "<-->" : "-->") : "---"} ${b}`);
  }
  // 上下の辺でつなぐ 2 つは同じ段（左から右の図では縦）に並べる。補足の layout の指定があればそちらを優先する
  const hints = Object.fromEntries(chart.edges.filter(sameRank).map((edge) => [edge.to, { align: edge.from }]));
  const small = Object.fromEntries(chart.items.filter((item) => item.kind === "junction").map((item) => [item.id, { width: 16 }]));
  const servicesUnder = (groupId) => chart.items.filter((item) => item.parent === groupId && item.kind === "service").length;
  return createMap(
    host,
    {
      id,
      title,
      flow: lines.join("\n"),
      data: { ...data, notes: notesFor(data), layout: mergeLayout({ ...hints, ...small }, data.layout) },
      config: { kinds: ARCH_KINDS, lines: { "-->": { head: "filled" } } },
      interval: data.interval,
      collapsedTag: (groupId) => `service ${servicesUnder(groupId)}`,
      decorateNode: (element, nodeId, { faded }) => {
        const item = chart.items.find((entry) => entry.id === nodeId);
        if (!item || faded) return;
        if (item.kind === "junction") {
          element.dataset.shape = "junction";
          return;
        }
        const head = element.querySelector(".mdmark-diagram-node-kind");
        if (head && item.icon) {
          head.innerHTML = iconSvg(item.icon);
          head.classList.remove("is-empty");
        }
      },
      selectionOf: selectionOver(chart.edges.filter((edge) => chart.items.some((item) => item.id === edge.from))),
      afterRender: (figure, layout) => {
        const stage = figure.querySelector(".mdmark-diagram-stage");
        const svg = figure.querySelector(".mdmark-diagram-wires");
        // group のタイトルにアイコンを付ける
        for (const group of chart.groups) {
          const titleRow = stage?.querySelector(`[data-group="${CSS.escape(group.id)}"] .map-group-title, [data-box="${CSS.escape(group.id)}"] .map-group-title`);
          if (titleRow && group.icon && !titleRow.querySelector(".mdmark-diagram-icon")) titleRow.insertAdjacentHTML("afterbegin", iconSvg(group.icon));
        }
        // 線の両端を、Mermaid の辺の指定（補足の layout の ends が無いとき）の辺の中ほどへ付け替える
        // 閉じた group の中のノードは、描いている一番近い外の group（閉じたノード）に読み替える
        const visible = (nodeId) => {
          for (let id = nodeId; id; id = chart.items.find((item) => item.id === id)?.parent ?? chart.groups.find((group) => group.id === id)?.parent) {
            if (stage?.querySelector(`[data-node="${CSS.escape(id)}"]`)) return id;
          }
          return undefined;
        };
        chart.edges.forEach((spec, index) => {
          const from = visible(spec.from);
          const to = visible(spec.to);
          // まとめた線は ID が変わるため、両端で探す
          const edge =
            layout.edges.find((item) => item.id === `L${index}`) ??
            layout.edges.find((item) => [item.from, item.to].sort().join(" ") === [from, to].sort().join(" "));
          const wire = edge && svg?.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
          const path = wire?.matches("path") ? wire : wire?.querySelector("path");
          if (!edge || !path || edge.points.length < 2 || !from || !to || from === to) return;
          const ends = data.layout?.[`r${index + 1}`]?.ends;
          // `{group}` の端は、その service を含む group の枠の辺から引く（group を閉じていれば閉じたノード）
          const rect = (nodeId, ofGroup) => {
            const groupId = ofGroup ? chart.items.find((item) => item.id === nodeId)?.parent : undefined;
            const box = groupId ? stage?.querySelector(`[data-group="${CSS.escape(groupId)}"]`) : null;
            const element = box ?? stage?.querySelector(`[data-node="${CSS.escape(visible(nodeId))}"]`);
            return element ? { x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight } : undefined;
          };
          const anchor = (box, side) =>
            ({ left: [box.x, box.y + box.h / 2], right: [box.x + box.w, box.y + box.h / 2], top: [box.x + box.w / 2, box.y], bottom: [box.x + box.w / 2, box.y + box.h] })[side];
          const a = rect(spec.from, spec.fromGroup);
          const b = rect(spec.to, spec.toGroup);
          if (!a || !b) return;
          const start = anchor(a, ends?.from?.side ?? spec.fromSide);
          const end = anchor(b, ends?.to?.side ?? spec.toSide);
          const out = (point, side) => [point[0] + (side === "right" ? 16 : side === "left" ? -16 : 0), point[1] + (side === "bottom" ? 16 : side === "top" ? -16 : 0)];
          const s1 = out(start, ends?.from?.side ?? spec.fromSide);
          const e1 = out(end, ends?.to?.side ?? spec.toSide);
          // 出る辺と入る辺の向き（横・縦）の組で、直角の折れ方を決める
          const horizontal = (side) => side === "left" || side === "right";
          const fromH = horizontal(ends?.from?.side ?? spec.fromSide);
          const toH = horizontal(ends?.to?.side ?? spec.toSide);
          const mx = (s1[0] + e1[0]) / 2;
          const my = (s1[1] + e1[1]) / 2;
          const points =
            fromH && toH
              ? [start, s1, [mx, s1[1]], [mx, e1[1]], e1, end]
              : !fromH && !toH
                ? [start, s1, [s1[0], my], [e1[0], my], e1, end]
                : fromH
                  ? [start, s1, [s1[0], e1[1]], e1, end]
                  : [start, s1, [e1[0], s1[1]], e1, end];
          replacePath(svg, edge, points);
          // `--` の線は矢じりを持たない
          if (!spec.head && !spec.tail) path.removeAttribute("marker-end");
        });
      },
    },
    initial,
  );
};

/* ---------- C4 図 ---------- */

/** 要素の関数名ごとの、使う側の設定の種類（C4_KINDS のキー） */
const C4_ELEMENTS = {
  Person: "person",
  Person_Ext: "person_ext",
  System: "system",
  System_Ext: "system_ext",
  SystemDb: "system_db",
  SystemDb_Ext: "system_db_ext",
  SystemQueue: "system_queue",
  SystemQueue_Ext: "system_queue_ext",
};
const C4_BOUNDARIES = { Boundary: "", Enterprise_Boundary: "Enterprise", System_Boundary: "Software System" };

/** 関数の引数の並び（"…" と識別子）を読む */
const args = (text) => [...text.matchAll(/"([^"]*)"|([^,\s][^,]*)/g)].map((match) => (match[1] ?? match[2]).trim());

/** C4Context を、境界・要素・関係に読む */
export const parseC4 = (source) => {
  const boundaries = [];
  const elements = [];
  const rels = [];
  const stack = [];
  let title;
  for (const raw of source.split("\n").slice(1)) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (!text) continue;
    if (text === "}") {
      stack.pop();
      continue;
    }
    const heading = /^title\s+(.+)$/.exec(text);
    if (heading) {
      title = heading[1];
      continue;
    }
    const call = /^(\w+)\((.*)\)\s*(\{)?$/.exec(text);
    if (!call) continue;
    const [fn, body, open] = [call[1], call[2], call[3]];
    const values = args(body);
    if (fn in C4_BOUNDARIES) {
      const boundary = { id: values[0], label: values[1] ?? values[0], type: C4_BOUNDARIES[fn], parent: stack.at(-1)?.id };
      boundaries.push(boundary);
      if (open) stack.push(boundary);
      continue;
    }
    if (fn in C4_ELEMENTS) {
      elements.push({ id: values[0], label: values[1] ?? values[0], description: values[2], parent: stack.at(-1)?.id, kind: C4_ELEMENTS[fn], external: fn.endsWith("_Ext") });
      continue;
    }
    const rel = /^(Bi)?Rel(?:_(U|D|L|R|Up|Down|Left|Right|Back))?$/.exec(fn);
    if (rel) rels.push({ from: values[0], to: values[1], label: values[2], tech: values[3], both: Boolean(rel[1]), direction: rel[2]?.[0] });
  }
  return { title, boundaries, elements, rels };
};

const C4_KINDS = {
  person: { label: "[Person]", icon: "user", shape: "rounded" },
  person_ext: { label: "[External Person]", icon: "user", shape: "rounded", color: "gray" },
  system: { label: "[Software System]", shape: "rect" },
  system_ext: { label: "[External Software System]", shape: "rect", color: "gray" },
  system_db: { label: "[Software System]", icon: "database", shape: "rect" },
  system_db_ext: { label: "[External Software System]", icon: "database", shape: "rect", color: "gray" },
  system_queue: { label: "[Software System]", shape: "pill" },
  system_queue_ext: { label: "[External Software System]", shape: "pill", color: "gray" },
};

/** C4 図の map: 境界を破線のグループ、要素を種類の行と説明を持つノード、関係をラベルと技術を持つ線にする */
export const createC4Map = (host, { id, title, source, data = {} }, initial = {}) => {
  const chart = parseC4(source);
  const lines = ["flowchart TB"];
  const emit = (parent, indent) => {
    for (const boundary of chart.boundaries.filter((entry) => entry.parent === parent)) {
      lines.push(`${indent}subgraph ${boundary.id} [${boundary.label}${boundary.type ? ` ［${boundary.type}］` : ""}]`, `${indent}  direction TB`);
      emit(boundary.id, `${indent}  `);
      lines.push(`${indent}end`);
    }
    for (const element of chart.elements.filter((entry) => entry.parent === parent)) lines.push(`${indent}${element.id}[${quote(element.label)}]:::${element.kind}`);
  };
  emit(undefined, "  ");
  // Rel_R・Rel_L は、同じ段に並べるため逆向きに書いて段の数を増やさない（描いた線は afterRender で向きを戻す）
  const isSideways = (rel) => rel.direction === "R" || rel.direction === "L";
  for (const rel of chart.rels) {
    const label = [rel.label, rel.tech ? `[${rel.tech}]` : ""].filter(Boolean).join(" ");
    const [a, b] = isSideways(rel) ? [rel.to, rel.from] : [rel.from, rel.to];
    lines.push(`  ${a} ${rel.both ? "<-->" : "-->"}${label ? `|${label}|` : ""} ${b}`);
  }
  // Rel_R・Rel_L の相手は同じ段（上から下の図では横）に並べる。補足の layout の座標・並び順があればそちらを優先する
  const sideways = chart.rels.filter(isSideways);
  const hints = mergeLayout(
    Object.fromEntries(sideways.map((rel) => [rel.to, { align: rel.from, order: rel.direction === "R" ? 2 : 0 }])),
    Object.fromEntries(sideways.map((rel) => [rel.from, { order: 1 }])),
  );
  const elementsUnder = (boundaryId) => chart.elements.filter((element) => element.parent === boundaryId).length;
  return createMap(
    host,
    {
      id,
      title: title ?? chart.title,
      flow: lines.join("\n"),
      data: { ...data, notes: notesFor(data), layout: mergeLayout(mergeLayout(Object.fromEntries(chart.elements.map((element) => [element.id, { width: 220 }])), hints), data.layout) },
      config: { kinds: C4_KINDS },
      interval: data.interval,
      collapsedTag: (boundaryId) => `要素 ${elementsUnder(boundaryId)}`,
      decorateNode: (element, nodeId, { faded }) => {
        const item = chart.elements.find((entry) => entry.id === nodeId);
        if (!item || faded) return;
        if (item.external) element.classList.add("cac-external");
        if (!item.description) return;
        element.append(Object.assign(document.createElement("p"), { className: "cac-description", textContent: item.description }));
      },
      selectionOf: selectionOver(chart.rels),
      afterRender: (figure, layout) => {
        const svg = figure.querySelector(".mdmark-diagram-wires");
        chart.rels.forEach((rel, index) => {
          const edge = layout.edges.find((item) => item.id === `L${index}`);
          if (svg && edge && isSideways(rel) && !rel.both) replacePath(svg, edge, edge.points.slice().reverse());
        });
        if (svg) spreadSharedEnds(svg, layout.edges);
        for (const boundary of chart.boundaries) figure.querySelector(`[data-group="${CSS.escape(boundary.id)}"], [data-box="${CSS.escape(boundary.id)}"]`)?.classList.add("cac-boundary");
      },
    },
    initial,
  );
};
