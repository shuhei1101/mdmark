// map の ER 図・状態遷移図のモック: erDiagram・stateDiagram-v2 の Mermaid と補足を、構成図のモック（#445 の createMap）の入力に読み替えて描く。
// 配置・中へ入る・開閉・案内・再生・ツールチップは構成図と共通で、種類に固有の部分（列の行・多重度・経路・開始と終了の形）だけをここで足す

import { createMap } from "../../445/assets/map-mock.js";

/** 多重度の記号（Mermaid の片端）と、端に出す文字 */
const CARDINALITY = { "||": "1", "|o": "0..1", "o|": "0..1", "}|": "1..n", "|{": "1..n", "}o": "0..n", "o{": "0..n" };
const MANY = new Set(["1..n", "0..n"]);

/** 使う側の設定の種類（ER 図のテーブル・状態遷移図の状態） */
const KINDS = {
  table: { label: "テーブル", shape: "rect" },
  state: { label: "", shape: "rounded" },
  start: { label: "", shape: "start" },
  end: { label: "", shape: "end" },
  choice: { label: "", shape: "choice" },
  note: { label: "注記", shape: "rect" },
};

/** erDiagram を、テーブル・列・関連に読む */
export const parseEr = (source) => {
  const tables = new Map();
  const relations = [];
  let current;
  for (const raw of source.split("\n").slice(1)) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (!text) continue;
    if (current) {
      if (text === "}") current = undefined;
      else {
        const column = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/.exec(text);
        if (column) current.columns.push({ type: column[1], name: column[2], keys: column[3]?.split(/\s*,\s*/) ?? [], comment: column[4] });
      }
      continue;
    }
    const open = /^(\S+)\s*\{$/.exec(text);
    if (open) {
      current = { name: open[1], columns: [] };
      tables.set(current.name, current);
      continue;
    }
    const rel = /^(\S+)\s+([|}o][|o])(--|\.\.)([|o][|{o])\s+(\S+)\s*:\s*"?([^"]*)"?$/.exec(text);
    if (rel) {
      for (const name of [rel[1], rel[5]]) if (!tables.has(name)) tables.set(name, { name, columns: [] });
      relations.push({ from: rel[1], to: rel[5], fromCard: CARDINALITY[rel[2]], toCard: CARDINALITY[rel[4]], dotted: rel[3] === "..", label: rel[6] });
    }
  }
  return { tables: [...tables.values()], relations };
};

/** stateDiagram-v2 を、状態・遷移・入れ子の状態・注記に読む。[*] は入れ子ごとの開始・終了の状態にする */
export const parseState = (source) => {
  const states = new Map();
  const transitions = [];
  const notes = [];
  const boxes = [];
  const stack = [];
  let direction = "TB";
  const scope = () => stack.at(-1)?.id ?? "root";
  const ensure = (id, extra = {}) => {
    if (!states.has(id)) states.set(id, { id, label: id, kind: "state", parent: stack.at(-1)?.id, ...extra });
    return states.get(id);
  };
  const ref = (token, side) => {
    if (token !== "[*]") return ensure(token).id;
    const id = `${side}_${scope()}`;
    ensure(id, { label: side === "start" ? "開始" : "終了", kind: side });
    return id;
  };
  for (const raw of source.split("\n").slice(1)) {
    const text = raw.replace(/%%.*$/, "").trim();
    if (!text) continue;
    const dir = /^direction\s+(\w+)$/.exec(text);
    if (dir) {
      if (stack.length) stack.at(-1).direction = dir[1];
      else direction = dir[1];
      continue;
    }
    const alias = /^state\s+"([^"]+)"\s+as\s+(\S+)$/.exec(text);
    if (alias) {
      ensure(alias[2]).label = alias[1];
      continue;
    }
    const choice = /^state\s+(\S+)\s+<<choice>>$/.exec(text);
    if (choice) {
      ensure(choice[1]).kind = "choice";
      continue;
    }
    const open = /^state\s+(?:"([^"]+)"\s+as\s+)?(\S+)\s*\{$/.exec(text);
    if (open) {
      const box = { id: open[2], title: open[1] ?? open[2], parent: stack.at(-1)?.id };
      boxes.push(box);
      stack.push(box);
      continue;
    }
    if (text === "}") {
      stack.pop();
      continue;
    }
    const note = /^note\s+(right|left)\s+of\s+(\S+)\s*:\s*(.+)$/.exec(text);
    if (note) {
      notes.push({ side: note[1], of: note[2], text: note[3] });
      continue;
    }
    // 入れ子の中の状態の宣言（入れ子の外で先に出た状態も、入れ子の中へ移す）
    if (/^[^\s:]+$/.test(text) && stack.length) {
      ensure(text).parent = stack.at(-1).id;
      continue;
    }
    const move = /^(\S+)\s*-->\s*(\S+)(?:\s*:\s*(.+))?$/.exec(text);
    if (move) transitions.push({ from: ref(move[1], "start"), to: ref(move[2], "end"), label: move[3] });
  }
  return { direction, states: [...states.values()].filter((item) => !boxes.some((box) => box.id === item.id)), transitions, notes, boxes };
};

const quote = (text) => `"${String(text).replaceAll('"', "'")}"`;
const SVG = "http://www.w3.org/2000/svg";

/** フォーカスとポインターで出すツールチップ（構成図のノードの説明と同じ規則の見た目）。マーカーの要素に付ける */
const attachTip = (marker, text, at) => {
  const tip = document.createElement("div");
  tip.className = "map-wire-tip er-tip";
  tip.setAttribute("role", "tooltip");
  tip.id = `er-tip-${Math.random().toString(36).slice(2)}`;
  tip.textContent = text;
  tip.hidden = true;
  // 図の中に置くマーカーは、マーカーの下に出す（図の中身の座標）
  if (at) Object.assign(tip.style, { left: `${at[0] - 12}px`, top: `${at[1] + 18}px` });
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

/** 2 つのテーブルをつなぐ最短の経路を全て。戻り値は経路に乗る関連の番号と、たどる向き（元 → 先）の並び */
const shortestPaths = (relations, a, b) => {
  const distance = (origin) => {
    const dist = new Map([[origin, 0]]);
    const queue = [origin];
    while (queue.length) {
      const table = queue.shift();
      for (const rel of relations) {
        const next = rel.from === table ? rel.to : rel.to === table ? rel.from : undefined;
        if (next !== undefined && !dist.has(next)) {
          dist.set(next, dist.get(table) + 1);
          queue.push(next);
        }
      }
    }
    return dist;
  };
  const fromA = distance(a);
  const fromB = distance(b);
  const total = fromA.get(b);
  if (total === undefined) return undefined;
  const steps = [];
  relations.forEach((rel, index) => {
    for (const [u, v] of [[rel.from, rel.to], [rel.to, rel.from]]) {
      if (fromA.get(u) !== undefined && fromB.get(v) !== undefined && fromA.get(u) + 1 + fromB.get(v) === total) steps.push({ index, table: u, to: v });
    }
  });
  return steps;
};

/** 線の d（直角に曲がる点の並び） */
const pathD = (points) => points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");

/** 図の中の SVG の文字（背景を持つ）を足す */
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

/** ER 図の map: テーブルを列の行を持つノード、補足の groups を分類のグループ、関連を FK の列の行から引く線にする */
export const createErMap = (host, { id, title, source, data = {} }, initial = {}) => {
  const er = parseEr(source);
  const groups = data.groups ?? {};
  const groupOf = new Map(Object.entries(groups).flatMap(([gid, group]) => group.tables.map((name) => [name, gid])));
  const lines = ["flowchart LR"];
  const emit = (parent, indent) => {
    for (const [gid, group] of Object.entries(groups).filter(([, group]) => (group.parent ?? undefined) === parent)) {
      lines.push(`${indent}subgraph ${gid} [${group.title}]`, `${indent}  direction TB`);
      emit(gid, `${indent}  `);
      lines.push(`${indent}end`);
    }
    for (const table of er.tables.filter((table) => groupOf.get(table.name) === parent)) lines.push(`${indent}${table.name}[${quote(table.name)}]:::table`);
  };
  emit(undefined, "  ");
  // 関連のラベルは、引き直した線の上にここで描く（構成図のラベルの置き方は使わない）
  for (const rel of er.relations) lines.push(`  ${rel.from} ${rel.dotted ? "-.-" : "---"} ${rel.to}`);
  // 補足の notes のキー（r{番号}）を、構成図の線の ID（L{番号 - 1}）に読み替える
  const notes = Object.fromEntries(Object.entries(data.notes ?? {}).filter(([key]) => !key.includes(".")).map(([key, value]) => [/^r(\d+)$/.test(key) ? `L${Number(key.slice(1)) - 1}` : key, value.text ?? value]));
  const tablesUnder = (gid) => [...groupOf].filter(([, owner]) => owner === gid || groups[owner]?.parent === gid).length;
  let paths;
  /** 関連の端につなぐ列: 相手を指す FK の列、無ければ PK の列 */
  const columnFor = (table, other) =>
    table.columns.find((column) => column.keys.includes("FK") && column.name.startsWith(other)) ?? table.columns.find((column) => column.keys.includes("PK"));
  return createMap(
    host,
    {
      id,
      title,
      flow: lines.join("\n"),
      data: { ...data, notes, layout: { ...Object.fromEntries(er.tables.map((table) => [table.name, { width: 240 }])), ...(data.layout ?? {}) } },
      // 関連の線は矢じりを持たない（向きは両端の多重度で表す）
      config: { kinds: KINDS, lines: { "-->": { head: "none" }, "-.->": { dash: "dashed", head: "none" } } },
      interval: data.interval,
      collapsedTag: (gid) => `テーブル ${tablesUnder(gid)}`,
      decorateNode: (element, nodeId, { faded, collapsed, toggle }) => {
        const table = er.tables.find((item) => item.name === nodeId);
        if (!table || faded) return;
        const closed = collapsed.has(nodeId);
        const head = element.querySelector(".mdmark-diagram-node-kind");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "er-toggle";
        button.setAttribute("aria-expanded", String(!closed));
        button.setAttribute("aria-label", `${table.name}の列を${closed ? "開く" : "閉じる"}`);
        button.textContent = closed ? `列 ${table.columns.length}` : "▾";
        button.addEventListener("click", () => toggle(nodeId));
        head?.append(button);
        if (closed) return;
        const list = document.createElement("div");
        list.className = "er-columns";
        list.setAttribute("role", "list");
        for (const column of table.columns) {
          const row = document.createElement("div");
          row.className = "er-column";
          row.setAttribute("role", "listitem");
          row.dataset.column = column.name;
          const text = data.notes?.[`${table.name}.${column.name}`]?.text ?? column.comment;
          row.innerHTML = `<span class="er-key">${column.keys.join(",")}</span><span class="er-name">${column.name}</span><span class="er-type">${column.type}</span>`;
          const cell = document.createElement("span");
          cell.className = "er-note-cell";
          if (text) {
            const mark = Object.assign(document.createElement("button"), { type: "button", className: "er-note", textContent: "i" });
            mark.setAttribute("aria-label", `${column.name}の説明`);
            cell.append(mark);
            attachTip(mark, text);
          }
          row.append(cell);
          list.append(row);
        }
        element.append(list);
      },
      selectionOf: (selected) => {
        paths = undefined;
        if (selected.size === 1) {
          const [only] = selected;
          const edges = er.relations.flatMap((rel, index) => (rel.from === only || rel.to === only ? [`L${index}`] : []));
          const nodes = new Set([only, ...er.relations.flatMap((rel) => (rel.from === only ? [rel.to] : rel.to === only ? [rel.from] : []))]);
          return { nodes, edges: new Set(edges) };
        }
        if (selected.size !== 2) return undefined;
        const [a, b] = selected;
        paths = shortestPaths(er.relations, a, b);
        if (!paths) return { nodes: new Set(selected), edges: new Set() };
        return { nodes: new Set([a, b, ...paths.flatMap((step) => [step.table, step.to])]), edges: new Set(paths.map((step) => `L${step.index}`)) };
      },
      afterRender: (figure, layout) => {
        const svg = figure.querySelector(".mdmark-diagram-wires");
        const stage = figure.querySelector(".mdmark-diagram-stage");
        const rectOf = (name) => {
          const element = stage.querySelector(`[data-node="${CSS.escape(name)}"]`);
          return element ? { element, x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight } : undefined;
        };
        /** つなぐ列の行の中ほどの高さ（列を閉じたテーブル・閉じた分類は無い） */
        const rowY = (rect, table, other) => {
          const column = table && columnFor(table, other);
          const row = column ? rect.element.querySelector(`[data-column="${CSS.escape(column.name)}"]`) : null;
          if (!row) return undefined;
          let top = row.offsetTop;
          for (let parent = row.offsetParent; parent && parent !== rect.element; parent = parent.offsetParent) top += parent.offsetTop;
          return rect.y + top + row.offsetHeight / 2;
        };
        /**
         * 自動配置の経路の端を、列の行の高さの左右の辺へ付け替える。経路の残りは自動配置のまま使い、ノードを横切らない。
         * 上下の辺から出ていた端は、次の点のある側の辺から出して、ノードの外で元の経路へ戻す
         */
        const reanchor = (points, rect, y, side) => {
          if (y === undefined) return points;
          const [p0, p1] = points;
          const onSide = p0[0] === rect.x || p0[0] === rect.x + rect.w;
          const chosen = side ?? (onSide ? (p0[0] === rect.x ? "left" : "right") : p1[0] >= rect.x + rect.w / 2 ? "right" : "left");
          const sx = chosen === "right" ? rect.x + rect.w : rect.x;
          const ox = sx + (chosen === "right" ? 14 : -14);
          return onSide && !side ? [[sx, y], [ox, y], [ox, p0[1]], ...points.slice(1)] : [[sx, y], [ox, y], [ox, p1[1]], ...points.slice(1)];
        };
        for (const edge of layout.edges) {
          const index = Number(edge.id.slice(1));
          const rel = er.relations[index];
          const fromRect = rectOf(edge.from);
          const toRect = rectOf(edge.to);
          const wire = svg?.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
          const path = wire?.matches("path") ? wire : wire?.querySelector("path");
          if (!rel || !fromRect || !toRect || !path || edge.points.length < 2) continue;
          const fromTable = er.tables.find((table) => table.name === edge.from);
          const toTable = er.tables.find((table) => table.name === edge.to);
          const ends = data.layout?.[`r${index + 1}`]?.ends;
          let points = reanchor(edge.points, fromRect, rowY(fromRect, fromTable, edge.to), ends?.from?.side);
          points = reanchor(points.slice().reverse(), toRect, rowY(toRect, toTable, edge.from), ends?.to?.side).reverse();
          const oldD = path.getAttribute("d");
          path.setAttribute("d", pathD(points));
          for (const hit of svg.querySelectorAll(".map-wire-hit")) if (hit.getAttribute("d") === oldD) hit.setAttribute("d", pathD(points));
          edge.points = points;
          const dimmed = wire.classList.contains("map-dim") ? " map-dim" : "";
          // 多重度: 端の横の区間の上側に、ノードから離して置く
          const fromCard = edge.from === rel.from ? rel.fromCard : rel.toCard;
          const toCard = edge.to === rel.to ? rel.toCard : rel.fromCard;
          for (const [[x, y], [nx], card] of [[points[0], points[1], fromCard], [points.at(-1), points.at(-2), toCard]]) {
            const right = nx >= x;
            svgText(svg, x + (right ? 4 : -4), y - 5, card, `er-card${dimmed}`, right ? "start" : "end");
          }
          // ラベルとマーカー: 両端の区間を除いた最も長い区間の中ほど（ラベルは片側、行が増えるマーカーは反対側）
          const inner = points.slice(2, -1).map((point, at) => [points[at + 1], point]).filter(([a, b]) => a[0] !== b[0] || a[1] !== b[1]);
          const segments = inner.length ? inner : [[points[0], points.at(-1)]];
          const [a, b] = segments.sort((u, v) => Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]) - Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1]))[0];
          const vertical = a[0] === b[0];
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          if (rel.label) svgText(svg, vertical ? mid[0] + 8 : mid[0], vertical ? mid[1] + 4 : mid[1] - 8, rel.label, `er-label${dimmed}`, vertical ? "start" : "middle");
          edge.markAt = vertical ? [mid[0] - 22, mid[1]] : [mid[0], mid[1] + 20];
        }
        // 経路のうち 1 の側から多の側へたどる関連に、行が増える旨のマーカーを付ける（ラベルの反対側・多重度とデータの印の通り道から離す）
        for (const step of paths ?? []) {
          const rel = er.relations[step.index];
          const toCard = step.to === rel.to ? rel.toCard : rel.fromCard;
          if (!MANY.has(toCard)) continue;
          const edge = layout.edges.find((item) => item.id === `L${step.index}`);
          if (!edge?.markAt) continue;
          const at = edge.markAt;
          const mark = document.createElement("button");
          mark.type = "button";
          mark.className = "er-fanout";
          mark.textContent = "×n";
          mark.setAttribute("aria-label", `${step.table} から ${step.to} で行が増える`);
          mark.style.left = `${at[0]}px`;
          mark.style.top = `${at[1]}px`;
          stage.append(mark);
          attachTip(mark, `${step.table} から ${step.to} へたどると、${step.table} の 1 行に ${step.to} の行が複数つながり、行が増えます`, at);
        }
      },
    },
    initial,
  );
};

/** 状態遷移図の map: 状態をノード、入れ子の状態をグループ、遷移を線、注記を点線でつないだノードにし、遷移の記載順の再生を持つ */
export const createStateMap = (host, { id, title, source, data = {} }, initial = {}) => {
  const chart = parseState(source);
  const isBox = (stateId) => chart.boxes.some((box) => box.id === stateId);
  // 入れ子の状態そのものへの遷移は中の開始へ、入れ子の状態からの遷移は中の終了から引く。中に [*] が無い入れ子の状態は、開始・終了を補って描く
  for (const move of chart.transitions) {
    for (const [key, side] of [["to", "start"], ["from", "end"]]) {
      if (!isBox(move[key])) continue;
      const box = move[key];
      const synthetic = `${side}_${box}`;
      if (!chart.states.some((item) => item.id === synthetic)) chart.states.push({ id: synthetic, label: side === "start" ? "開始" : "終了", kind: side, parent: box });
      move[key] = synthetic;
    }
  }
  const lines = [`flowchart ${chart.direction}`];
  const emit = (parent, indent) => {
    for (const box of chart.boxes.filter((item) => item.parent === parent)) {
      lines.push(`${indent}subgraph ${box.id} [${box.title}]`);
      if (box.direction) lines.push(`${indent}  direction ${box.direction}`);
      emit(box.id, `${indent}  `);
      lines.push(`${indent}end`);
    }
    for (const item of chart.states.filter((state) => state.parent === parent)) lines.push(`${indent}${item.id}[${quote(item.kind === "state" ? item.label : " ")}]:::${item.kind}`);
    chart.notes.forEach((note, index) => {
      if (chart.states.find((item) => item.id === note.of)?.parent === parent) lines.push(`${indent}note_${index}[${quote(note.text)}]:::note`);
    });
  };
  emit(undefined, "  ");
  for (const move of chart.transitions) lines.push(`  ${move.from} -->${move.label ? `|${move.label}|` : ""} ${move.to}`);
  // 注記の点線は遷移の後ろに置き、遷移の線の ID（L{記載順 - 1}）を変えない
  chart.notes.forEach((note, index) => lines.push(note.side === "left" ? `  note_${index} -.- ${note.of}` : `  ${note.of} -.- note_${index}`));
  const noteEdgeIds = new Set(chart.notes.map((_, index) => `L${chart.transitions.length + index}`));
  const notes = Object.fromEntries(Object.entries(data.notes ?? {}).map(([key, value]) => [/^t(\d+)$/.test(key) ? `L${Number(key.slice(1)) - 1}` : key, value.text ?? value]));
  const small = Object.fromEntries(chart.states.filter((item) => item.kind !== "state").map((item) => [item.id, { width: item.kind === "choice" ? 40 : 32 }]));
  const statesUnder = (boxId) => chart.states.filter((item) => item.parent === boxId && item.kind === "state").length;
  const nameOf = (stateId) => {
    const item = chart.states.find((entry) => entry.id === stateId);
    return item?.kind === "start" ? "開始" : item?.kind === "end" ? "終了" : (item?.label ?? stateId);
  };
  // 遷移の再生: 補足の walkthroughs が無いときは、遷移を記載順の手順にして、構成図の案内と同じ帯で進める
  const walkthroughs = data.walkthroughs?.length
    ? data.walkthroughs
    : chart.transitions.map((move, index) => ({
        title: `${nameOf(move.from)} → ${nameOf(move.to)}${move.label ? `：${move.label}` : ""}`,
        text: data.notes?.[`t${index + 1}`]?.text ?? "",
        highlight: [move.from, move.to],
      }));
  return createMap(
    host,
    {
      id,
      title,
      flow: lines.join("\n"),
      data: { ...data, notes, walkthroughs, layout: { ...small, ...(data.layout ?? {}) } },
      config: { kinds: KINDS, lines: { "-.->": { dash: "dashed", head: "none" } } },
      interval: data.interval,
      collapsedTag: (boxId) => `状態 ${statesUnder(boxId)}`,
      selectionOf: (selected) => {
        if (selected.size !== 1) return undefined;
        const [only] = selected;
        const edges = chart.transitions.flatMap((move, index) => (move.from === only || move.to === only ? [`L${index}`] : []));
        const nodes = new Set([only, ...chart.transitions.flatMap((move) => (move.from === only ? [move.to] : move.to === only ? [move.from] : []))]);
        return { nodes, edges: new Set(edges) };
      },
      afterRender: (figure, layout, { selected, step: stepIndex }) => {
        const svg = figure.querySelector(".mdmark-diagram-wires");
        const stage = figure.querySelector(".mdmark-diagram-stage");
        // 注記の点線は矢じりを持たない
        for (const noteId of noteEdgeIds) svg?.querySelector(`[data-wire="${noteId}"]`)?.classList.add("er-note-line");
        // 同じ状態への遷移: 状態の右の辺から出て、上を回って上の辺へ戻る線とラベル
        const marker = svg?.querySelector("path[marker-end]")?.getAttribute("marker-end");
        chart.transitions.forEach((move, index) => {
          if (move.from !== move.to) return;
          const element = stage.querySelector(`[data-node="${CSS.escape(move.from)}"]`);
          if (!element || !svg) return;
          const x = element.offsetLeft;
          const y = element.offsetTop;
          const w = element.offsetWidth;
          const points = [[x + w, y + 14], [x + w + 20, y + 14], [x + w + 20, y - 20], [x + w / 2, y - 20], [x + w / 2, y]];
          const loop = document.createElementNS(SVG, "path");
          loop.setAttribute("d", pathD(points));
          loop.setAttribute("class", "er-self");
          if (marker) loop.setAttribute("marker-end", marker);
          loop.dataset.wire = `L${index}`;
          const others = selected.size ? !selected.has(move.from) : stepIndex !== undefined && !(walkthroughs[stepIndex]?.highlight ?? []).includes(move.from);
          const active = stepIndex !== undefined && walkthroughs[stepIndex]?.highlight?.[0] === move.from && walkthroughs[stepIndex]?.highlight?.[1] === move.to;
          if (others) loop.classList.add("map-dim");
          if (active) loop.classList.add("er-self-active");
          svg.append(loop);
          if (move.label) svgText(svg, x + w / 2 + 8, y - 26, move.label, `er-label${others ? " map-dim" : ""}`, "start");
        });
      },
    },
    initial,
  );
};
