// モックの自動配置と記法の読み取り: PoC（#446、commit 3e4d731e8 の poc/map/layout.ts・parse.ts）をまとめ、中へ入ったときの外の要素の選び方・グループのタイトルの高さ（36px）・ノードの大きさ（今のフロー図のノードの外観に合わせる）を修正し、両向きの矢印（<-->）の読み取りと、シーケンス図の全ての記法（複合フラグメント・注記・活性化・まとまり・autonumber・矢印の種類）の読み取り・`%% block: 名前` のブロックの名前・測ったノードの大きさでの配置を追加したもの。手で修正しない
// check.ts
var LABEL_METRICS = {
  kindSize: 11,
  nameSize: 14,
  subSize: 12,
  lineHeight: 1.4,
  padY: 6,
  padX: 10
};

// layout.ts
var MAP_LAYOUT = {
  maxWidth: 220,
  minWidth: 120,
  gapItem: 48,
  gapRank: 64,
  boxPad: 24,
  boxTitle: 36,
  margin: 24,
  /** 線を引く通り道の、矩形からの離れ */
  clearance: 12,
  bendCost: 30,
  /** 箱の枠を出入りする 1 回の重み。最短より出入りを増やさないために大きくする */
  borderCost: 1e5
};
var isWide = (char) => {
  const code = char.codePointAt(0) ?? 0;
  return !(code <= 126 || code >= 65377 && code <= 65439);
};
var splitLines = (text, fontSize, width) => {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    let used = 0;
    for (const char of paragraph) {
      const advance = isWide(char) ? fontSize : fontSize * 0.6;
      if (used > 0 && used + advance > width) {
        lines.push(line);
        line = "";
        used = 0;
      }
      line += char;
      used += advance;
    }
    lines.push(line);
  }
  return lines;
};
var textWidth = (text, fontSize) => Math.max(...text.split("\n").map((line) => [...line].reduce((sum, char) => sum + (isWide(char) ? fontSize : fontSize * 0.6), 0)));
var sizeLeaf = (label, width, size) => {
  const { nameSize, kindSize, lineHeight, padX, padY } = LABEL_METRICS;
  if (size) return { w: size.w, h: size.h, lines: [label] };
  const w = width ?? Math.min(MAP_LAYOUT.maxWidth, Math.max(MAP_LAYOUT.minWidth, Math.ceil(textWidth(label, nameSize)) + padX * 2));
  const lines = splitLines(label, nameSize, w - padX * 2);
  const count = lines.length;
  const h = Math.ceil((kindSize + count * nameSize) * lineHeight) + padY * 2 + 16;
  return { w, h, lines };
};
var buildView = (chart, options, overrides) => {
  const boxParent = new Map(chart.boxes.map((box) => [box.id, box.parent]));
  const parentOf = (id) => chart.nodes.find((node) => node.id === id)?.parent ?? boxParent.get(id);
  const chain = (id) => {
    const result = [];
    for (let current = parentOf(id); current !== void 0; current = boxParent.get(current)) {
      result.push(current);
    }
    return result;
  };
  const collapsed = new Set(options.collapsed ?? []);
  const inEntered = (id) => options.enter === void 0 || chain(id).includes(options.enter) || id === options.enter;
  const visibleOf = (nodeId) => {
    const ancestors = chain(nodeId).reverse();
    if (!inEntered(nodeId)) {
      const enterChain = chain(options.enter);
      const outer = ancestors.find((box) => box !== options.enter && !enterChain.includes(box));
      return { id: outer ?? nodeId, faded: true };
    }
    const closed = ancestors.find((box) => collapsed.has(box));
    return { id: closed ?? nodeId, faded: false };
  };
  const pick = options.edges === void 0 ? void 0 : new Set(options.edges);
  const merged = /* @__PURE__ */ new Map();
  const used = /* @__PURE__ */ new Set();
  for (const edge of chart.edges) {
    if (pick && !pick.has(edge.id)) {
      continue;
    }
    const from = visibleOf(edge.from);
    const to = visibleOf(edge.to);
    if (from.id === to.id || from.faded && to.faded) {
      continue;
    }
    const key = `${from.id}->${to.id}`;
    const found = merged.get(key);
    if (found) {
      found.count += 1;
      found.label = `${found.count} \u672C`;
    } else {
      merged.set(key, { id: edge.id, from: from.id, to: to.id, count: 1, label: edge.label });
    }
    used.add(from.id);
    used.add(to.id);
  }
  const fadedIds = /* @__PURE__ */ new Set();
  for (const edge of chart.edges) {
    for (const end of [edge.from, edge.to]) {
      const visible = visibleOf(end);
      if (visible.faded && used.has(visible.id)) {
        fadedIds.add(visible.id);
      }
    }
  }
  const keepNode = (id) => pick === void 0 || used.has(id);
  const makeLeaf = (id, label, faded) => ({
    kind: "leaf",
    id,
    label,
    faded,
    ...sizeLeaf(label, overrides[id]?.width, overrides[id]?.size)
  });
  const countInside = (boxId) => chart.nodes.filter((node) => chain(node.id).includes(boxId)).length;
  const makeBox = (boxId, title, direction) => {
    const children = [];
    for (const box of chart.boxes.filter((item) => item.parent === boxId)) {
      if (collapsed.has(box.id)) {
        if (keepNode(box.id)) {
          children.push(makeLeaf(box.id, `${box.title}\uFF08${countInside(box.id)}\uFF09`, false));
        }
        continue;
      }
      const child = makeBox(box.id, box.title, box.direction ?? direction);
      if (child.children.length > 0) {
        children.push(child);
      }
    }
    for (const node of chart.nodes.filter((item) => item.parent === boxId)) {
      if (keepNode(node.id)) {
        children.push(makeLeaf(node.id, node.label, false));
      }
    }
    return { kind: "box", id: boxId ?? "", title, direction, children, w: 0, h: 0 };
  };
  let root;
  if (options.enter === void 0) {
    root = makeBox(void 0, "", chart.direction);
  } else {
    const entered = chart.boxes.find((box) => box.id === options.enter);
    if (!entered) {
      throw new Error(`\u5165\u308B\u7BB1\u304C\u3042\u308A\u307E\u305B\u3093: ${options.enter}`);
    }
    const inner = makeBox(entered.id, entered.title, entered.direction ?? chart.direction);
    const outside = [...fadedIds].map((id) => {
      const box = chart.boxes.find((item) => item.id === id);
      return makeLeaf(id, box?.title ?? chart.nodes.find((node) => node.id === id)?.label ?? id, true);
    });
    root = { kind: "box", id: "", title: "", direction: chart.direction, children: [inner, ...outside], w: 0, h: 0 };
  }
  return { root, edges: [...merged.values()] };
};
var assignRanks = (ids, links) => {
  const out = new Map(ids.map((id) => [id, []]));
  for (const [from, to] of links) {
    out.get(from)?.push(to);
  }
  const state = /* @__PURE__ */ new Map();
  const forward = [];
  const visit = (id) => {
    state.set(id, "open");
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === "open") {
        continue;
      }
      forward.push([id, next]);
      if (!state.has(next)) {
        visit(next);
      }
    }
    state.set(id, "done");
  };
  for (const id of ids) {
    if (!state.has(id)) {
      visit(id);
    }
  }
  const rank = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const [from, to] of forward) {
      const next = (rank.get(from) ?? 0) + 1;
      if (next > (rank.get(to) ?? 0)) {
        rank.set(to, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return rank;
};
var layoutBox = (box, links, overrides, placed) => {
  for (const child of box.children) {
    if (child.kind === "box") {
      layoutBox(child, links, overrides, placed);
    }
  }
  const ids = box.children.map((child) => child.id);
  const owner = /* @__PURE__ */ new Map();
  const collect = (item, top2) => {
    owner.set(item.id, top2);
    if (item.kind === "box") {
      for (const child of item.children) {
        collect(child, top2);
      }
    }
  };
  for (const child of box.children) {
    collect(child, child.id);
  }
  const lifted = [];
  for (const [from, to] of links) {
    const a = owner.get(from);
    const b = owner.get(to);
    if (a !== void 0 && b !== void 0 && a !== b) {
      lifted.push([a, b]);
    }
  }
  const rank = assignRanks(ids, lifted);
  for (const id of ids) {
    const target = overrides[id]?.align;
    if (target !== void 0 && rank.has(target)) {
      const value = Math.max(rank.get(id) ?? 0, rank.get(target) ?? 0);
      rank.set(id, value);
      rank.set(target, value);
    }
  }
  const rankCount = Math.max(0, ...rank.values()) + 1;
  const rows = Array.from({ length: rankCount }, () => []);
  for (const id of ids) {
    rows[rank.get(id) ?? 0]?.push(id);
  }
  const position = /* @__PURE__ */ new Map();
  const sortRow = (row, neighbors) => {
    const score = (id) => {
      const fixed2 = overrides[id]?.order;
      if (fixed2 !== void 0) {
        return -1e3 + fixed2;
      }
      const near = neighbors(id).map((n) => position.get(n)).filter((value) => value !== void 0);
      return near.length === 0 ? position.get(id) ?? 0 : near.reduce((sum, value) => sum + value, 0) / near.length;
    };
    row.sort((a, b) => score(a) - score(b));
    row.forEach((id, index) => {
      position.set(id, index);
    });
  };
  rows.forEach((row) => {
    row.forEach((id, index) => {
      position.set(id, index);
    });
  });
  const preds = (id) => lifted.filter(([, to]) => to === id).map(([from]) => from);
  const succs = (id) => lifted.filter(([from]) => from === id).map(([, to]) => to);
  for (let sweep = 0; sweep < 4; sweep++) {
    if (sweep % 2 === 0) {
      rows.forEach((row) => sortRow(row, preds));
    } else {
      [...rows].reverse().forEach((row) => sortRow(row, succs));
    }
  }
  const byId = new Map(box.children.map((child) => [child.id, child]));
  const vertical = box.direction === "TB";
  const main = (item) => vertical ? item.h : item.w;
  const cross = (item) => vertical ? item.w : item.h;
  const rowCross = rows.map((row) => row.reduce((sum, id) => sum + cross(byId.get(id)), 0) + Math.max(0, row.length - 1) * MAP_LAYOUT.gapItem);
  const widest = Math.max(0, ...rowCross);
  const locals = [];
  let along = 0;
  rows.forEach((row, index) => {
    const depth = Math.max(0, ...row.map((id) => main(byId.get(id))));
    let at = (widest - (rowCross[index] ?? 0)) / 2;
    for (const id of row) {
      const item = byId.get(id);
      const offset = (depth - main(item)) / 2;
      const p = vertical ? { x: at, y: along + offset } : { x: along + offset, y: at };
      locals.push({ item, ...p });
      at += cross(item) + MAP_LAYOUT.gapItem;
    }
    along += depth + MAP_LAYOUT.gapRank;
  });
  const fixed = locals.filter((local) => overrides[local.item.id]?.pos !== void 0);
  for (const local of fixed) {
    const pos = overrides[local.item.id]?.pos;
    local.x = pos.x;
    local.y = pos.y;
  }
  const gap = MAP_LAYOUT.gapItem;
  for (let pass = 0; pass < locals.length * 2; pass++) {
    let moved = false;
    for (const local of locals) {
      if (fixed.includes(local)) {
        continue;
      }
      for (const other of locals) {
        if (other === local) {
          continue;
        }
        const hit = local.x < other.x + other.item.w + gap && other.x < local.x + local.item.w + gap && local.y < other.y + other.item.h + gap && other.y < local.y + local.item.h + gap;
        if (hit && (fixed.includes(other) || locals.indexOf(other) < locals.indexOf(local))) {
          if (vertical) {
            local.x = other.x + other.item.w + gap;
          } else {
            local.y = other.y + other.item.h + gap;
          }
          moved = true;
        }
      }
    }
    if (!moved) {
      break;
    }
  }
  const minX = Math.min(0, ...locals.map((local) => local.x));
  const minY = Math.min(0, ...locals.map((local) => local.y));
  for (const local of locals) {
    local.x -= minX;
    local.y -= minY;
  }
  const contentW = Math.max(0, ...locals.map((local) => local.x + local.item.w));
  const contentH = Math.max(0, ...locals.map((local) => local.y + local.item.h));
  const top = box.id === "" ? 0 : MAP_LAYOUT.boxTitle;
  const pad = box.id === "" ? 0 : MAP_LAYOUT.boxPad;
  box.w = contentW + pad * 2;
  box.h = contentH + pad * 2 + top;
  placed.set(box.id, locals.map((local) => ({ ...local, x: local.x + pad, y: local.y + pad + top })));
};
var createHeap = () => {
  let costs = new Float64Array(1024);
  let values = new Int32Array(1024);
  let length = 0;
  return {
    push: (cost, value) => {
      if (length === costs.length) {
        const nextCosts = new Float64Array(length * 2);
        nextCosts.set(costs);
        costs = nextCosts;
        const nextValues = new Int32Array(length * 2);
        nextValues.set(values);
        values = nextValues;
      }
      let i = length;
      length += 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (costs[p] <= cost) {
          break;
        }
        costs[i] = costs[p];
        values[i] = values[p];
        i = p;
      }
      costs[i] = cost;
      values[i] = value;
    },
    pop: () => {
      if (length === 0) {
        return void 0;
      }
      const top = values[0];
      length -= 1;
      const cost = costs[length];
      const value = values[length];
      let i = 0;
      for (; ; ) {
        const l = i * 2 + 1;
        if (l >= length) {
          break;
        }
        const r = l + 1;
        const m = r < length && costs[r] < costs[l] ? r : l;
        if (costs[m] >= cost) {
          break;
        }
        costs[i] = costs[m];
        values[i] = values[m];
        i = m;
      }
      costs[i] = cost;
      values[i] = value;
      return top;
    },
    size: () => length
  };
};
var strictlyInside = (x, y, rect) => x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
var routeEdges = (leaves, boxes, edges) => {
  const m = MAP_LAYOUT.clearance;
  const rects = [
    ...leaves.map((leaf) => ({ ...leaf, leaf: true })),
    ...boxes.map((box) => ({ ...box, leaf: false }))
  ];
  const xsSet = /* @__PURE__ */ new Set();
  const ysSet = /* @__PURE__ */ new Set();
  for (const rect of rects) {
    xsSet.add(rect.x - m).add(rect.x + rect.w + m).add(rect.x + rect.w / 2);
    ysSet.add(rect.y - m).add(rect.y + rect.h + m).add(rect.y + rect.h / 2);
    if (!rect.leaf) {
      xsSet.add(rect.x + m).add(rect.x + rect.w - m);
      ysSet.add(rect.y + m).add(rect.y + rect.h - m);
    }
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  const nx = xs.length;
  const ny = ys.length;
  const indexOfRect = new Map(rects.map((rect, index) => [rect.id, index]));
  const inside = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = xs[i];
      const y = ys[j];
      const list = [];
      rects.forEach((rect, index) => {
        if (strictlyInside(x, y, rect)) {
          list.push(index);
        }
      });
      inside.push(list);
    }
  }
  const ancestorsOf = new Map(leaves.map((leaf) => [leaf.id, leaf.ancestors]));
  const xIndex = new Map(xs.map((x, i) => [x, i]));
  const yIndex = new Map(ys.map((y, j) => [y, j]));
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  return edges.map((edge) => {
    const source = leaves.find((leaf) => leaf.id === edge.from);
    const target = leaves.find((leaf) => leaf.id === edge.to);
    const fromAnc = ancestorsOf.get(edge.from) ?? [];
    const toAnc = ancestorsOf.get(edge.to) ?? [];
    const allowed = new Set([...fromAnc, ...toAnc].map((id) => indexOfRect.get(id)));
    const common = fromAnc.filter((id) => toAnc.includes(id));
    const lca = common[0] === void 0 ? void 0 : indexOfRect.get(common[0]);
    const crossing = [...fromAnc, ...toAnc].filter((id) => !common.includes(id)).map((id) => indexOfRect.get(id));
    const total = nx * ny;
    const blockedAt = new Uint8Array(total);
    const maskAt = new Uint8Array(total);
    for (let point = 0; point < total; point++) {
      const list = inside[point];
      let isBlocked = lca !== void 0 && !list.includes(lca);
      let mask = 0;
      for (const index of list) {
        if (!allowed.has(index)) {
          isBlocked = true;
        }
        const bit = crossing.indexOf(index);
        if (bit >= 0) {
          mask |= 1 << bit;
        }
      }
      blockedAt[point] = isBlocked ? 1 : 0;
      maskAt[point] = mask;
    }
    const blocked = (point) => blockedAt[point] === 1;
    const crossCost = (a, b) => {
      let diff = maskAt[a] ^ maskAt[b];
      let count = 0;
      while (diff) {
        count += diff & 1;
        diff >>= 1;
      }
      return count * MAP_LAYOUT.borderCost;
    };
    const ports = (leaf) => {
      const cx = leaf.x + leaf.w / 2;
      const cy = leaf.y + leaf.h / 2;
      const list = [
        { x: leaf.x + leaf.w + m, y: cy, dir: 0, border: [leaf.x + leaf.w, cy] },
        { x: cx, y: leaf.y + leaf.h + m, dir: 1, border: [cx, leaf.y + leaf.h] },
        { x: leaf.x - m, y: cy, dir: 2, border: [leaf.x, cy] },
        { x: cx, y: leaf.y - m, dir: 3, border: [cx, leaf.y] }
      ];
      return list.map((port) => ({ point: yIndex.get(port.y) * nx + xIndex.get(port.x), dir: port.dir, border: port.border })).filter((port) => !blocked(port.point));
    };
    const starts = ports(source);
    const goals = ports(target);
    const goalSet = new Map(goals.map((goal2) => [goal2.point, goal2]));
    const tx = target.x + target.w / 2;
    const ty = target.y + target.h / 2;
    const goalMask = goals[0] === void 0 ? 0 : maskAt[goals[0].point];
    const heuristic = (point) => {
      let diff = maskAt[point] ^ goalMask;
      let count = 0;
      while (diff) {
        count += diff & 1;
        diff >>= 1;
      }
      const distance = Math.abs(xs[point % nx] - tx) + Math.abs(ys[Math.floor(point / nx)] - ty) - target.w / 2 - target.h / 2;
      return Math.max(0, distance) + count * MAP_LAYOUT.borderCost;
    };
    const best = new Float64Array(nx * ny * 4).fill(Number.POSITIVE_INFINITY);
    const back = new Int32Array(nx * ny * 4).fill(-1);
    const heap = createHeap();
    for (const start of starts) {
      const state = start.point * 4 + start.dir;
      best[state] = 0;
      heap.push(heuristic(start.point), state);
    }
    let reached = -1;
    while (heap.size() > 0) {
      const state = heap.pop();
      const point = state >> 2;
      const dir = state & 3;
      if (goalSet.has(point)) {
        reached = state;
        break;
      }
      const cost = best[state];
      const i = point % nx;
      const j = Math.floor(point / nx);
      for (let d = 0; d < 4; d++) {
        if (d === (dir + 2 & 3)) {
          continue;
        }
        const ni = i + DX[d];
        const nj = j + DY[d];
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) {
          continue;
        }
        const next = nj * nx + ni;
        if (blocked(next)) {
          continue;
        }
        const length = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
        const nextCost = cost + length + (d === dir ? 0 : MAP_LAYOUT.bendCost) + crossCost(point, next);
        const nextState = next * 4 + d;
        if (nextCost < best[nextState]) {
          best[nextState] = nextCost;
          back[nextState] = state;
          heap.push(nextCost + heuristic(next), nextState);
        }
      }
    }
    if (reached < 0) {
      throw new Error(`\u7DDA\u3092\u5F15\u3051\u307E\u305B\u3093: ${edge.id}`);
    }
    const path = [];
    for (let state = reached; state >= 0; state = back[state]) {
      const point = state >> 2;
      path.unshift([xs[point % nx], ys[Math.floor(point / nx)]]);
    }
    const startPort = starts.find((start) => start.point === (path[0] ? yIndex.get(path[0][1]) * nx + xIndex.get(path[0][0]) : -1));
    const goal = goalSet.get(reached >> 2);
    const points = [
      ...startPort ? [startPort.border] : [],
      ...path,
      ...goal ? [goal.border] : []
    ];
    const simplified = points.filter((p, index) => {
      const prev = points[index - 1];
      const next = points[index + 1];
      if (!prev || !next) return true;
      return !(prev[0] === p[0] && p[0] === next[0] || prev[1] === p[1] && p[1] === next[1]);
    });
    return { ...edge, points: simplified };
  });
};
var layoutMap = (chart, options = {}, overrides = {}) => {
  const { root, edges } = buildView(chart, options, overrides);
  const links = edges.map((edge) => [edge.from, edge.to]);
  const placed = /* @__PURE__ */ new Map();
  layoutBox(root, links, overrides, placed);
  const leaves = [];
  const boxes = [];
  const walk = (box, ox, oy, ancestors) => {
    for (const local of placed.get(box.id) ?? []) {
      const x = ox + local.x;
      const y = oy + local.y;
      const item = local.item;
      if (item.kind === "leaf") {
        leaves.push({ id: item.id, x, y, w: item.w, h: item.h, lines: item.lines, faded: item.faded, ancestors });
      } else {
        boxes.push({ id: item.id, title: item.title, x, y, w: item.w, h: item.h, ancestors });
        walk(item, x, y, [item.id, ...ancestors]);
      }
    }
  };
  const margin = MAP_LAYOUT.margin;
  walk(root, margin, margin, []);
  return {
    width: root.w + margin * 2,
    height: root.h + margin * 2,
    leaves,
    boxes,
    edges: routeEdges(leaves, boxes, edges)
  };
};

// parse.ts
var SHAPES = [
  { open: "([", close: "])", shape: "stadium" },
  { open: "((", close: "))", shape: "circle" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "diamond" },
  { open: ">", close: "]", shape: "flag" }
];
var ARROWS = [
  { re: /^<-->/, line: "solid", arrow: true, both: true },
  { re: /^<-\.->/, line: "dotted", arrow: true, both: true },
  { re: /^<==>/, line: "thick", arrow: true, both: true },
  { re: /^--\s+(.+?)\s+-->/, line: "solid", arrow: true },
  { re: /^--\s+(.+?)\s+---/, line: "solid", arrow: false },
  { re: /^-\.\s+(.+?)\s+\.->/, line: "dotted", arrow: true },
  { re: /^==\s+(.+?)\s+==>/, line: "thick", arrow: true },
  { re: /^-->/, line: "solid", arrow: true },
  { re: /^---/, line: "solid", arrow: false },
  { re: /^-\.->/, line: "dotted", arrow: true },
  { re: /^-\.-/, line: "dotted", arrow: false },
  { re: /^==>/, line: "thick", arrow: true },
  { re: /^===/, line: "thick", arrow: false }
];
var ID_RE = /^[A-Za-z0-9_\u0080-￿]+/;
var EDGE_ID_RE = /^([A-Za-z0-9_]+)@(?=[-=])/;
var IGNORED_RE = /^(classDef|style|linkStyle|click|accTitle|accDescr)\b/;
var skipSpace = (cursor) => {
  while (cursor.pos < cursor.text.length && /\s/.test(cursor.text[cursor.pos] ?? "")) {
    cursor.pos += 1;
  }
};
var rest = (cursor) => cursor.text.slice(cursor.pos);
var readShape = (cursor) => {
  const tail = rest(cursor);
  for (const { open, close, shape } of SHAPES) {
    if (!tail.startsWith(open)) {
      continue;
    }
    let body = tail.slice(open.length);
    let consumed = open.length;
    let label;
    if (body.startsWith('"')) {
      const end = body.indexOf('"', 1);
      if (end < 0) {
        return void 0;
      }
      label = body.slice(1, end);
      body = body.slice(end + 1);
      consumed += end + 1;
      if (!body.startsWith(close)) {
        return void 0;
      }
    } else {
      const end = body.indexOf(close);
      if (end < 0) {
        return void 0;
      }
      label = body.slice(0, end);
      consumed += end;
    }
    cursor.pos += consumed + close.length;
    return { label: label.replace(/<br\s*\/?>/g, "\n"), shape };
  }
  return void 0;
};
var readNode = (cursor) => {
  skipSpace(cursor);
  const match = ID_RE.exec(rest(cursor));
  if (!match) {
    return void 0;
  }
  if (EDGE_ID_RE.test(rest(cursor))) {
    return void 0;
  }
  cursor.pos += match[0].length;
  const ref = { id: match[0], classes: [] };
  const shape = readShape(cursor);
  if (shape) {
    ref.label = shape.label;
    ref.shape = shape.shape;
  }
  const cls = /^:::([A-Za-z0-9_-]+)/.exec(rest(cursor));
  if (cls?.[1]) {
    ref.classes.push(cls[1]);
    cursor.pos += cls[0].length;
  }
  return ref;
};
var readGroup = (cursor) => {
  const group = [];
  for (; ; ) {
    const node = readNode(cursor);
    if (!node) {
      return void 0;
    }
    group.push(node);
    skipSpace(cursor);
    if (!rest(cursor).startsWith("&")) {
      return group;
    }
    cursor.pos += 1;
  }
};
var readArrow = (cursor) => {
  skipSpace(cursor);
  let id;
  const idMatch = EDGE_ID_RE.exec(rest(cursor));
  if (idMatch) {
    id = idMatch[1];
    cursor.pos += idMatch[0].length;
  }
  for (const { re, line, arrow, both = false } of ARROWS) {
    const match = re.exec(rest(cursor));
    if (!match) {
      continue;
    }
    cursor.pos += match[0].length;
    let label = match[1];
    const pipe = /^\|([^|]*)\|/.exec(rest(cursor));
    if (pipe) {
      label = pipe[1];
      cursor.pos += pipe[0].length;
    }
    return { id, line, arrow, both, label: label?.replace(/^"|"$/g, "") };
  }
  return void 0;
};
var readStatement = (text) => {
  const cursor = { text, pos: 0 };
  const first = readGroup(cursor);
  if (!first) {
    return void 0;
  }
  const groups = [first];
  const arrows = [];
  for (; ; ) {
    skipSpace(cursor);
    if (cursor.pos >= text.length) {
      return { groups, arrows };
    }
    const arrow = readArrow(cursor);
    if (!arrow) {
      return void 0;
    }
    const next = readGroup(cursor);
    if (!next) {
      return void 0;
    }
    arrows.push(arrow);
    groups.push(next);
  }
};
var toDirection = (value) => {
  if (value === "TB" || value === "TD" || value === "BT") {
    return "TB";
  }
  if (value === "LR" || value === "RL") {
    return "LR";
  }
  return void 0;
};
var parseFlowchart = (source) => {
  const lines = source.split("\n");
  const header = /^\s*(flowchart|graph)\s+(\w+)/.exec(lines[0] ?? "");
  const direction = toDirection(header?.[2] ?? "TB") ?? "TB";
  const nodes = /* @__PURE__ */ new Map();
  const boxes = [];
  const edges = [];
  const warnings = [];
  const stack = [];
  const boxIds = /* @__PURE__ */ new Set();
  const touch = (ref) => {
    if (boxIds.has(ref.id)) {
      return;
    }
    const parent = stack.at(-1)?.id;
    const existing = nodes.get(ref.id);
    if (existing) {
      if (ref.label !== void 0) {
        existing.label = ref.label;
        existing.shape = ref.shape ?? existing.shape;
        existing.parent = parent;
      }
      existing.classes.push(...ref.classes);
      return;
    }
    nodes.set(ref.id, {
      id: ref.id,
      label: ref.label ?? ref.id,
      shape: ref.shape ?? "rect",
      classes: [...ref.classes],
      parent
    });
  };
  lines.slice(1).forEach((raw, index) => {
    const lineNo = index + 2;
    const text = raw.replace(/%%.*$/, "").trim().replace(/;$/, "");
    if (text === "") {
      return;
    }
    const subgraph = /^subgraph\s+([^\s[]+)\s*(?:\[\s*"?([^"\]]*)"?\s*\])?\s*$/.exec(text);
    if (subgraph?.[1]) {
      const box = {
        id: subgraph[1],
        title: subgraph[2] ?? subgraph[1],
        parent: stack.at(-1)?.id,
        direction: void 0
      };
      boxes.push(box);
      boxIds.add(box.id);
      stack.push(box);
      return;
    }
    if (text === "end") {
      if (!stack.pop()) {
        warnings.push({ line: lineNo, text: raw });
      }
      return;
    }
    const dir = /^direction\s+(\w+)$/.exec(text);
    if (dir?.[1]) {
      const current = stack.at(-1);
      const value = toDirection(dir[1]);
      if (current && value) {
        current.direction = value;
      } else {
        warnings.push({ line: lineNo, text: raw });
      }
      return;
    }
    const classLine = /^class\s+([\w,\s]+?)\s+([\w-]+)$/.exec(text);
    if (classLine?.[1] && classLine[2]) {
      for (const id of classLine[1].split(",").map((part) => part.trim())) {
        nodes.get(id)?.classes.push(classLine[2]);
      }
      return;
    }
    if (IGNORED_RE.test(text)) {
      return;
    }
    const statement = readStatement(text);
    if (!statement) {
      warnings.push({ line: lineNo, text: raw });
      return;
    }
    statement.groups.forEach((group) => {
      group.forEach(touch);
    });
    statement.arrows.forEach((arrow, at) => {
      for (const from of statement.groups[at] ?? []) {
        for (const to of statement.groups[at + 1] ?? []) {
          edges.push({
            id: arrow.id ?? `L${edges.length}`,
            from: from.id,
            to: to.id,
            line: arrow.line,
            arrow: arrow.arrow,
            both: arrow.both,
            label: arrow.label
          });
        }
      }
    });
  });
  return { direction, nodes: [...nodes.values()], boxes, edges, warnings };
};
var SEQ_ID = "[\\w\\u0080-\\uffff]+";
var SEQ_ARROWS = {
  "<<-->>": { dotted: true, head: "filled", both: true },
  "<<->>": { dotted: false, head: "filled", both: true },
  "-->>": { dotted: true, head: "filled", both: false },
  "->>": { dotted: false, head: "filled", both: false },
  "--x": { dotted: true, head: "cross", both: false },
  "-x": { dotted: false, head: "cross", both: false },
  "--)": { dotted: true, head: "async", both: false },
  "-)": { dotted: false, head: "async", both: false },
  "-->": { dotted: true, head: "none", both: false },
  "->": { dotted: false, head: "none", both: false }
};
var ARROW_RE = Object.keys(SEQ_ARROWS).map((arrow) => arrow.replace(/[()]/g, "\\$&")).join("|");
var MESSAGE_RE = new RegExp(`^(${SEQ_ID})\\s*(${ARROW_RE})\\s*([+-]?)(${SEQ_ID})\\s*:\\s*(.*)$`);
var FRAGMENT_RE = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/;
var SECTION_RE = /^(else|and|option)\b\s*(.*)$/;
var NOTE_RE = new RegExp(`^note\\s+(left of|right of|over)\\s+(${SEQ_ID}(?:\\s*,\\s*${SEQ_ID})?)\\s*:\\s*(.*)$`, "i");
var parseSequence = (source) => {
  const participants = /* @__PURE__ */ new Map();
  const messages = [];
  const fragments = [];
  const notes = [];
  const activations = [];
  const groups = [];
  const warnings = [];
  const open = [];
  const active = /* @__PURE__ */ new Map();
  let group;
  let autonumber = false;
  let pendingBlock;
  const ensure = (id) => {
    if (!participants.has(id)) participants.set(id, { id, label: id, actor: false });
  };
  const activate = (id, at) => {
    const list = active.get(id) ?? [];
    list.push(at);
    active.set(id, list);
  };
  const deactivate = (id, at, line, raw) => {
    const start = active.get(id)?.pop();
    if (start === void 0) {
      warnings.push({ line, text: raw });
      return;
    }
    activations.push({ id, start, end: at, depth: active.get(id)?.length ?? 0 });
  };
  source.split("\n").slice(1).forEach((raw, index) => {
    const line = index + 2;
    const block = /^\s*%%\s*block:\s*(.*)$/.exec(raw);
    if (block) {
      pendingBlock = (block[1] ?? "").trim();
      return;
    }
    const text = raw.replace(/%%.*$/, "").trim();
    if (text === "") return;
    const blockName = pendingBlock;
    pendingBlock = void 0;
    if (text === "autonumber") {
      autonumber = true;
      return;
    }
    const box = /^box\s*(.*)$/.exec(text);
    if (box) {
      const [, rest2 = ""] = box;
      const color = /^(rgba?\([^)]*\)|transparent|[a-z]+)(?=\s|$)/i.exec(rest2)?.[0];
      group = { label: (color ? rest2.slice(color.length) : rest2).trim(), color, members: [] };
      groups.push(group);
      return;
    }
    const decl = new RegExp(`^(?:create\\s+)?(participant|actor)\\s+(${SEQ_ID})(?:\\s+as\\s+(.+))?$`).exec(text);
    if (decl?.[1] && decl[2]) {
      participants.set(decl[2], { id: decl[2], label: decl[3] ?? decl[2], actor: decl[1] === "actor" });
      group?.members.push(decl[2]);
      return;
    }
    if (new RegExp(`^destroy\\s+${SEQ_ID}$`).test(text)) return;
    const fragment = FRAGMENT_RE.exec(text);
    if (fragment?.[1]) {
      const label = fragment[1] === "rect" ? blockName ?? "" : fragment[2] ?? "";
      const item = {
        kind: fragment[1],
        label,
        depth: open.length,
        sections: [{ start: messages.length, label }],
        start: messages.length,
        end: messages.length
      };
      open.push(item);
      fragments.push(item);
      return;
    }
    const section = SECTION_RE.exec(text);
    if (section) {
      const current = open.at(-1);
      if (!current) warnings.push({ line, text: raw });
      else current.sections.push({ start: messages.length, label: section[2] ?? "" });
      return;
    }
    if (text === "end") {
      if (group && open.length === 0) {
        group = void 0;
        return;
      }
      const current = open.pop();
      if (!current) warnings.push({ line, text: raw });
      else current.end = messages.length;
      return;
    }
    const toggle = new RegExp(`^(activate|deactivate)\\s+(${SEQ_ID})$`).exec(text);
    if (toggle?.[2]) {
      ensure(toggle[2]);
      if (toggle[1] === "activate") activate(toggle[2], messages.length);
      else deactivate(toggle[2], messages.length - 1, line, raw);
      return;
    }
    const note = NOTE_RE.exec(text);
    if (note?.[1] && note[2]) {
      const of = note[2].split(",").map((id) => id.trim());
      for (const id of of) ensure(id);
      notes.push({ after: messages.length, placement: note[1].toLowerCase().startsWith("left") ? "left" : note[1].toLowerCase().startsWith("right") ? "right" : "over", of, text: note[3] ?? "" });
      return;
    }
    const message = MESSAGE_RE.exec(text);
    if (message?.[1] && message[2] && message[4]) {
      ensure(message[1]);
      ensure(message[4]);
      const arrow = SEQ_ARROWS[message[2]];
      const activation = message[3] === "+" ? "+" : message[3] === "-" ? "-" : void 0;
      messages.push({ from: message[1], to: message[4], text: message[5] ?? "", arrow, reply: arrow.dotted, activation });
      const at = messages.length - 1;
      if (activation === "+") activate(message[4], at);
      if (activation === "-") deactivate(message[1], at, line, raw);
      return;
    }
    warnings.push({ line, text: raw });
  });
  for (const item of open) {
    item.end = messages.length;
    warnings.push({ line: 0, text: `${item.kind} \u306B end \u304C\u3042\u308A\u307E\u305B\u3093` });
  }
  return { participants: [...participants.values()], messages, fragments, notes, activations, groups, autonumber, warnings };
};
export {
  layoutMap,
  parseFlowchart,
  parseSequence
};
