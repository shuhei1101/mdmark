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

/** 2 つのテーブルをつなぐ最短の経路（関連の番号の並び） */
const pathBetween = (relations, a, b) => {
  const previous = new Map([[a, undefined]]);
  const queue = [a];
  while (queue.length) {
    const table = queue.shift();
    if (table === b) break;
    relations.forEach((rel, index) => {
      const next = rel.from === table ? rel.to : rel.to === table ? rel.from : undefined;
      if (next !== undefined && !previous.has(next)) {
        previous.set(next, { table, index });
        queue.push(next);
      }
    });
  }
  if (!previous.has(b)) return undefined;
  const steps = [];
  for (let at = b; previous.get(at); at = previous.get(at).table) steps.unshift({ ...previous.get(at), to: at });
  return steps;
};

/** ER 図の map: テーブルを列の行を持つノード、補足の groups を分類のグループ、関連を線にする */
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
  for (const rel of er.relations) lines.push(`  ${rel.from} ${rel.dotted ? "-.-" : "---"}${rel.label ? `|${rel.label}|` : ""} ${rel.to}`);
  // 補足の notes のキー（r{番号}）を、構成図の線の ID（L{番号 - 1}）に読み替える
  const notes = Object.fromEntries(Object.entries(data.notes ?? {}).filter(([key]) => !key.includes(".")).map(([key, value]) => [/^r(\d+)$/.test(key) ? `L${Number(key.slice(1)) - 1}` : key, value.text ?? value]));
  let path;
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
          if (text) {
            const mark = Object.assign(document.createElement("span"), { className: "er-note", tabIndex: 0, textContent: "i", title: text });
            mark.setAttribute("aria-label", `${column.name}の説明: ${text}`);
            cell.append(mark);
          }
          row.append(cell);
          list.append(row);
        }
        element.append(list);
      },
      selectionOf: (selected) => {
        path = undefined;
        if (selected.size === 1) {
          const [only] = selected;
          const edges = er.relations.flatMap((rel, index) => (rel.from === only || rel.to === only ? [`L${index}`] : []));
          const nodes = new Set([only, ...er.relations.flatMap((rel) => (rel.from === only ? [rel.to] : rel.to === only ? [rel.from] : []))]);
          return { nodes, edges: new Set(edges) };
        }
        if (selected.size !== 2) return undefined;
        const [a, b] = selected;
        path = pathBetween(er.relations, a, b);
        if (!path) return { nodes: new Set(selected), edges: new Set() };
        return { nodes: new Set([a, ...path.map((step) => step.to)]), edges: new Set(path.map((step) => `L${step.index}`)) };
      },
      afterRender: (figure, layout) => {
        const svg = figure.querySelector(".mdmark-diagram-wires");
        // ノードと同じ座標系（図の中身の左上が原点）に置く
        const box = figure.querySelector(".mdmark-diagram-stage");
        const ns = "http://www.w3.org/2000/svg";
        layout.edges.forEach((edge) => {
          const index = Number(edge.id.slice(1));
          const rel = er.relations[index];
          if (!rel || edge.points.length < 2) return;
          const ends = [
            [edge.points[0], edge.points[1], edge.from === rel.from ? rel.fromCard : rel.toCard],
            [edge.points.at(-1), edge.points.at(-2), edge.to === rel.to ? rel.toCard : rel.fromCard],
          ];
          for (const [[x, y], [nx, ny], card] of ends) {
            const len = Math.hypot(nx - x, ny - y) || 1;
            const text = document.createElementNS(ns, "text");
            text.setAttribute("x", String(x + ((nx - x) / len) * 14 + ((ny - y) / len) * 8));
            text.setAttribute("y", String(y + ((ny - y) / len) * 14 - ((nx - x) / len) * 8 + 4));
            text.setAttribute("class", "er-card");
            text.textContent = card;
            svg?.append(text);
          }
        });
        // 2 つのテーブルの経路のうち、1 の側から多の側へたどる関連に、行が増える旨のマーカーを付ける
        for (const step of path ?? []) {
          const rel = er.relations[step.index];
          const toCard = step.to === rel.to ? rel.toCard : rel.fromCard;
          if (!MANY.has(toCard)) continue;
          const edge = layout.edges.find((item) => item.id === `L${step.index}`);
          if (!edge) continue;
          const [a, b] = edge.points.slice(Math.floor((edge.points.length - 1) / 2));
          const mark = document.createElement("button");
          mark.type = "button";
          mark.className = "er-fanout";
          mark.textContent = "×n";
          mark.title = `${step.table} から ${step.to} へたどると、${step.table} の 1 行に ${step.to} の行が複数つながり、行が増えます`;
          mark.setAttribute("aria-label", mark.title);
          mark.style.left = `${(a[0] + b[0]) / 2}px`;
          mark.style.top = `${(a[1] + b[1]) / 2}px`;
          box?.append(mark);
        }
      },
    },
    initial,
  );
};

/** 状態遷移図の map: 状態をノード、入れ子の状態をグループ、遷移を線にし、遷移の記載順の再生を持つ */
export const createStateMap = (host, { id, title, source, data = {} }, initial = {}) => {
  const chart = parseState(source);
  const lines = [`flowchart ${chart.direction}`];
  const emit = (parent, indent) => {
    for (const box of chart.boxes.filter((item) => item.parent === parent)) {
      lines.push(`${indent}subgraph ${box.id} [${box.title}]`);
      if (box.direction) lines.push(`${indent}  direction ${box.direction}`);
      emit(box.id, `${indent}  `);
      lines.push(`${indent}end`);
    }
    for (const item of chart.states.filter((state) => state.parent === parent)) lines.push(`${indent}${item.id}[${quote(item.kind === "state" ? item.label : item.kind === "choice" ? "◇" : " ")}]:::${item.kind}`);
  };
  emit(undefined, "  ");
  // 入れ子の状態そのものへの遷移は中の開始へ、入れ子の状態からの遷移は中の終了から引く（モックの配置は線の端にグループを取らない）
  const isBox = (stateId) => chart.boxes.some((box) => box.id === stateId);
  for (const move of chart.transitions) {
    if (isBox(move.to)) move.to = `start_${move.to}`;
    if (isBox(move.from)) move.from = `end_${move.from}`;
    lines.push(`  ${move.from} -->${move.label ? `|${move.label}|` : ""} ${move.to}`);
  }
  const notes = Object.fromEntries(Object.entries(data.notes ?? {}).map(([key, value]) => [/^t(\d+)$/.test(key) ? `L${Number(key.slice(1)) - 1}` : key, value.text ?? value]));
  for (const note of chart.notes) notes[note.of] = [notes[note.of], note.text].filter(Boolean).join("\n");
  const small = Object.fromEntries(chart.states.filter((item) => item.kind !== "state").map((item) => [item.id, { width: item.kind === "choice" ? 40 : 32 }]));
  // 遷移の再生: 補足の walkthroughs が無いときは、遷移を記載順の手順にして、構成図の案内と同じ帯で進める
  const nameOf = (stateId) => {
    const item = chart.states.find((entry) => entry.id === stateId);
    return item?.kind === "start" ? "開始" : item?.kind === "end" ? "終了" : (item?.label ?? stateId);
  };
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
      config: { kinds: KINDS },
      interval: data.interval,
      selectionOf: (selected) => {
        if (selected.size !== 1) return undefined;
        const [only] = selected;
        const edges = chart.transitions.flatMap((move, index) => (move.from === only || move.to === only ? [`L${index}`] : []));
        const nodes = new Set([only, ...chart.transitions.flatMap((move) => (move.from === only ? [move.to] : move.to === only ? [move.from] : []))]);
        return { nodes, edges: new Set(edges) };
      },
    },
    initial,
  );
};
