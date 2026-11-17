// map のマインドマップのモック: mindmap の Mermaid と補足を、根を中央に配置して枝を左右の外へ広げる木の配置で描く。
// 図の枠・拡大と縮小・リサイズハンドル・説明のマーカーは今のフロー図の部品（flow）を使用し、項目の形状・枝の線・開閉・中へ入る・選択・案内をここで追加する

import { mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.12.0/dist/index.js";

const SVG = "http://www.w3.org/2000/svg";

/** 1 レイヤー目の枝ごとに順に割り当てる色の名前 */
const BRANCH_COLORS = ["blue", "green", "orange", "purple", "red", "yellow"];
/** 項目の大きさ: 文字の幅の見積もり・幅の上限・余白 */
const CHAR_WIDE = 14;
const CHAR_NARROW = 8;
const LINE_HEIGHT = 20;
const ITEM_MAX_WIDTH = 200;
const ITEM_PAD_X = 26;
/** 項目の幅の下限（説明のマーカーの分を含む） */
const ITEM_MIN_WIDTH = 72;
/** 名前の右に空ける説明のマーカーの幅 */
const INFO_WIDTH = 20;
const ITEM_PAD_Y = 8;
/** 形状ごとに名前の周りへ足す余白（切り抜く形状は角が欠けるため広く取る） */
const SHAPE_PAD = { square: 0, rounded: 0, circle: 4, bang: 24, cloud: 16, hexagon: 20, plain: 0 };
/** 配置の間隔: 同じ親の子の縦の間・レイヤーの横の間・図の外周 */
const GAP_Y = 16;
const GAP_X = 72;
const MARGIN = 32;
/** 開閉と中へ入るボタンを並べた持ち手の幅（項目の外側の辺に付ける） */
const GRIP_WIDTH = 64;
/** 最初に表示する枠の高さの上限（超える図は枠の中で縦にスクロールする） */
const MAX_INITIAL_HEIGHT = 560;

/** 今の図のボタンと同じ Lucide のアイコン */
const ICONS = {
  back: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  enter: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  collapse: '<path d="m15 18-6-6 6-6"/>',
  expand: '<path d="m9 18 6-6-6-6"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  resize: '<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>',
};
const icon = (name) =>
  `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const toolButton = (name, label, onClick, attrs = {}) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mdmark-diagram-tool";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon(name);
  for (const [key, value] of Object.entries(attrs)) button.setAttribute(key, value);
  button.addEventListener("click", onClick);
  return button;
};

/* ---------- 読み取り ---------- */

/** 形状の記号（外側から順に照合する）。text は記号の内側 */
const SHAPE_RE = [
  ["circle", /^(.*?)\(\((.+)\)\)$/],
  ["bang", /^(.*?)\)\)(.+)\(\($/],
  ["cloud", /^(.*?)\)(.+)\($/],
  ["hexagon", /^(.*?)\{\{(.+)\}\}$/],
  ["rounded", /^(.*?)\((.+)\)$/],
  ["square", /^(.*?)\[(.+)\]$/],
];

/**
 * mindmap の Mermaid を項目の木にする。字下げの深さで親子を決め、::icon() と ::: の行は直前の項目に付けて描かない。
 * 戻り値: { root, items（記載順）, problems（読めない行の行番号と内容） }
 */
export const parseMindmap = (source) => {
  const lines = source.split("\n");
  const items = [];
  const problems = [];
  const stack = [];
  let root;
  lines.forEach((raw, index) => {
    if (index === 0 || raw.trim() === "" || raw.trim().startsWith("%%")) return;
    const indent = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text.startsWith("::icon(") || text.startsWith(":::")) return;
    if (root && indent <= root.indent) {
      problems.push({ line: index + 1, text, reason: "根が 2 つ以上あるため、この行を読み飛ばしました" });
      return;
    }
    let shape = "plain";
    let id;
    let label = text;
    for (const [name, re] of SHAPE_RE) {
      const match = re.exec(text);
      if (match) {
        shape = name;
        id = match[1].trim() || undefined;
        label = match[2].trim();
        break;
      }
    }
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1);
    const item = { indent, id, label, shape, parent, children: [], order: items.length };
    if (parent) parent.children.push(item);
    else root = item;
    items.push(item);
    stack.push(item);
  });
  // 状態の保存と補足のキー: ID、無ければ表示する文字。同じ文字の項目が 2 つ以上あるときは、状態の保存だけ記載順の n{番号}
  const counts = new Map();
  for (const item of items) if (!item.id) counts.set(item.label, (counts.get(item.label) ?? 0) + 1);
  for (const item of items) {
    item.key = item.id ?? item.label;
    item.stateKey = item.id ?? (counts.get(item.label) > 1 ? `n${item.order}` : item.label);
  }
  return { root, items, problems };
};

/* ---------- 配置 ---------- */

/** 名前の文字の幅を見積もり、項目の幅と高さを決める（描いた後に測って足りなければ測った大きさで配置し直す） */
const sizeOf = (item, measured) => {
  if (measured.has(item.stateKey)) return measured.get(item.stateKey);
  const textWidth = [...item.label].reduce((sum, ch) => sum + (/[\x20-\x7e]/.test(ch) ? CHAR_NARROW : CHAR_WIDE), 0);
  const pad = SHAPE_PAD[item.shape];
  const inner = Math.min(ITEM_MAX_WIDTH - ITEM_PAD_X * 2, textWidth);
  const rows = Math.max(1, Math.ceil(textWidth / (ITEM_MAX_WIDTH - ITEM_PAD_X * 2)));
  const w = Math.max(ITEM_MIN_WIDTH, inner + ITEM_PAD_X * 2 + pad * 2 + (item.hasNote ? INFO_WIDTH : 0));
  const h = rows * LINE_HEIGHT + ITEM_PAD_Y * 2 + pad;
  if (item.shape === "circle") {
    const side = Math.max(w, h);
    return { w: side, h: side };
  }
  return { w, h };
};

/**
 * 木の配置: 根を中央に置き、根の子を左右に振り分ける（記載順に、子孫の高さの合計が小さい側へ）。
 * 各側は深いレイヤーほど外へ並べ、同じ親の子は記載順に上から並べる。親は子の並びの縦の中央に置く。
 * 閉じた項目の子孫は配置しない
 */
const layoutTree = (top, { collapsed, measured }) => {
  const visibleChildren = (item) => (collapsed.has(item.stateKey) ? [] : item.children);
  const size = new Map();
  const measure = (item) => {
    const own = sizeOf(item, measured);
    const kids = visibleChildren(item);
    const kidsHeight = kids.reduce((sum, kid) => sum + measure(kid) + GAP_Y, -GAP_Y);
    const block = Math.max(own.h, kids.length ? kidsHeight : 0);
    size.set(item, { ...own, block });
    return block;
  };
  measure(top);
  const sides = { right: [], left: [] };
  const totals = { right: 0, left: 0 };
  for (const kid of visibleChildren(top)) {
    const side = totals.right <= totals.left ? "right" : "left";
    sides[side].push(kid);
    totals[side] += size.get(kid).block + GAP_Y;
  }
  // レイヤーごとの横の位置: 側ごとに、そのレイヤーの項目の最大の幅を積む
  const columnWidths = { right: [], left: [] };
  const collect = (item, depth, side) => {
    const own = size.get(item);
    const extra = item.children.length ? GRIP_WIDTH : 0;
    columnWidths[side][depth] = Math.max(columnWidths[side][depth] ?? 0, own.w + extra);
    for (const kid of visibleChildren(item)) collect(kid, depth + 1, side);
  };
  for (const side of ["right", "left"]) for (const kid of sides[side]) collect(kid, 0, side);
  const placed = [];
  const topSize = size.get(top);
  const rootX = 0;
  const columnX = (side, depth) => {
    let x = topSize.w / 2 + GAP_X;
    for (let d = 0; d < depth; d += 1) x += columnWidths[side][d] + GAP_X;
    return side === "right" ? x : -x;
  };
  const place = (item, depth, side, top_) => {
    const own = size.get(item);
    const kids = visibleChildren(item);
    const x = side === "right" ? columnX(side, depth) : columnX(side, depth) - own.w;
    const y = top_ + (own.block - own.h) / 2;
    placed.push({ item, x, y, w: own.w, h: own.h, side, depth: depth + 1 });
    let cursor = top_ + (own.block - kids.reduce((sum, kid) => sum + size.get(kid).block + GAP_Y, -GAP_Y)) / 2;
    for (const kid of kids) {
      place(kid, depth + 1, side, cursor);
      cursor += size.get(kid).block + GAP_Y;
    }
  };
  const height = Math.max(topSize.h, totals.right - GAP_Y, totals.left - GAP_Y);
  for (const side of ["right", "left"]) {
    let cursor = (height - (totals[side] - GAP_Y)) / 2;
    for (const kid of sides[side]) {
      place(kid, 0, side, cursor);
      cursor += size.get(kid).block + GAP_Y;
    }
  }
  placed.push({ item: top, x: rootX - topSize.w / 2, y: (height - topSize.h) / 2, w: topSize.w, h: topSize.h, side: "root", depth: 0 });
  // 座標を図の外周の余白から始める
  const minX = Math.min(...placed.map((p) => p.x - (p.side === "left" && p.item.children.length ? GRIP_WIDTH : 0)));
  for (const p of placed) {
    p.x += MARGIN - minX;
    p.y += MARGIN;
  }
  const width = Math.max(...placed.map((p) => p.x + p.w + (p.side === "right" && p.item.children.length ? GRIP_WIDTH : 0))) + MARGIN;
  return { placed, width, height: height + MARGIN * 2 };
};

/* ---------- 描画 ---------- */

/** 全体の図の根からの 1 レイヤー目の枝の色（中へ入っても変えない。根の色は文字の色） */
const branchColorOf = (item, top) => {
  if (item === top) return undefined;
  let branch = item;
  while (branch.parent && branch.parent !== top) branch = branch.parent;
  const index = top.children.indexOf(branch);
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
};

/** 根から item までの項目（両端を含む） */
const pathTo = (item) => {
  const path = [];
  for (let node = item; node; node = node.parent) path.unshift(node);
  return path;
};
const descendantsOf = (item) => item.children.flatMap((kid) => [kid, ...descendantsOf(kid)]);

/**
 * map のマインドマップを 1 つ作る。host の中に描き、操作のたびに描き直す。
 * spec: { id, title, source, data: { notes, layout, walkthroughs } }
 * initial: { enter, collapsed, selected, step }
 */
export const createMindmap = (host, spec, initial = {}) => {
  const chart = parseMindmap(spec.source);
  const notes = spec.data?.notes ?? {};
  const layoutData = spec.data?.layout ?? {};
  const steps = spec.data?.walkthroughs ?? [];
  const byKey = new Map(chart.items.map((item) => [item.key, item]));
  for (const item of chart.items) item.hasNote = Boolean(notes[item.key]);
  const byStateKey = new Map(chart.items.map((item) => [item.stateKey, item]));
  // 補足の layout のうち、閉じた状態だけを最初の状態にする（色は描くときに当てる）
  const collapsedFromLayout = Object.entries(layoutData)
    .filter(([, value]) => value.collapsed)
    .map(([key]) => byKey.get(key)?.stateKey)
    .filter(Boolean);
  const state = {
    enter: initial.enter ? byKey.get(initial.enter) : undefined,
    collapsed: new Set([...collapsedFromLayout, ...(initial.collapsed ?? []).map((key) => byKey.get(key)?.stateKey)]),
    selected: initial.selected ? byKey.get(initial.selected) : undefined,
    step: initial.step,
    measured: new Map(),
  };
  // 書き方の警告: 読めない行と、マインドマップに適用しない layout の指定
  const warnings = [
    ...chart.problems.map((p) => `${p.line} 行目「${p.text}」: ${p.reason}`),
    ...Object.entries(layoutData).flatMap(([key, value]) =>
      [
        value.pos ? `layout の ${key} の pos: マインドマップでは座標を適用しません` : undefined,
        value.order !== undefined ? `layout の ${key} の order: マインドマップでは並び順を適用しません。並び順は Mermaid の行の順で変えてください` : undefined,
      ].filter(Boolean),
    ),
  ];

  const current = () => {
    if (state.step !== undefined) {
      const step = steps[state.step];
      return { top: step.enter ? byKey.get(step.enter) : chart.root, highlight: (step.highlight ?? []).map((key) => byKey.get(key)) };
    }
    return { top: state.enter ?? chart.root, highlight: undefined };
  };

  /** 強調: 選んだ項目の根からの道筋と子孫、または案内の手順の項目。ほかは薄くする */
  const keepSet = (highlight) => {
    if (highlight) return new Set(highlight.flatMap((item) => pathTo(item)));
    if (!state.selected) return undefined;
    return new Set([...pathTo(state.selected), ...descendantsOf(state.selected)]);
  };

  /** 描き直す前にフォーカスしていた要素の目印（項目の番号かボタンの名前）。描き直した後に同じ要素へ戻す */
  const focusMark = () => {
    const active = document.activeElement;
    if (!active || !host.contains(active)) return undefined;
    return active.dataset.mmHit ? `[data-mm-hit="${active.dataset.mmHit}"]` : active.dataset.node ? `[data-node="${active.dataset.node}"]` : active.getAttribute("aria-label") ? `[aria-label="${CSS.escape(active.getAttribute("aria-label"))}"]` : ".mdmark-diagram-viewport";
  };

  const render = () => {
    const mark = focusMark();
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const { top, highlight } = current();
    const tree = layoutTree(top, { collapsed: state.collapsed, measured: state.measured });
    // 中へ入ったときは、根からその枝までの道筋を、入った枝の上に薄く並べる
    const trail = top === chart.root ? [] : pathTo(top).slice(0, -1);
    const trailHeight = trail.length ? 40 : 0;
    for (const p of tree.placed) p.y += trailHeight;
    const definition = {
      title: spec.title ?? "マインドマップ",
      scope: top === chart.root ? "全体" : `${top.label}の中`,
      updated: "2026-11-17",
      width: tree.width,
      height: tree.height + trailHeight,
      nodes: tree.placed.map((p) => ({
        id: `mm-${p.item.order}`,
        kind: "script",
        x: Math.round(p.x),
        y: Math.round(p.y),
        w: Math.round(p.w),
        h: Math.round(p.h),
        name: p.item.label,
        ...(notes[p.item.key] ? { hint: notes[p.item.key].text } : {}),
      })),
      wires: [],
    };
    host.replaceChildren();
    if (warnings.length) {
      const box = document.createElement("div");
      box.className = "map-warning";
      box.setAttribute("role", "note");
      box.innerHTML = `<p>書き方の警告</p><ul>${warnings.map((text) => `<li>${text}</li>`).join("")}</ul>`;
      host.append(box);
    }
    const holder = document.createElement("div");
    host.append(holder);
    mount(holder, { markdown: `<!-- flow -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /flow -->\n` });
    const figure = holder.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure", "mm-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const svg = figure.querySelector(".mdmark-diagram-wires");
    const keep = keepSet(highlight);
    const placedOf = new Map(tree.placed.map((p) => [p.item, p]));

    // 枝の線: 親の外側の辺（持ち手の先）から子の内側の辺へ曲線で引く。形状の指定の無い子は下線の高さへつなぐ
    for (const p of tree.placed) {
      const parent = p.item.parent && placedOf.get(p.item.parent);
      if (!parent) continue;
      const toRight = p.side === "right";
      const grip = parent.side === "root" ? 0 : GRIP_WIDTH;
      const x1 = toRight ? parent.x + parent.w + grip : parent.x - grip;
      const y1 = parent.y + parent.h / 2;
      const x2 = toRight ? p.x : p.x + p.w;
      const y2 = p.item.shape === "plain" ? p.y + p.h - 1 : p.y + p.h / 2;
      const mid = (x1 + x2) / 2;
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`);
      path.setAttribute("class", "mm-branch");
      path.style.setProperty("--mm-color", `var(--mdmark-color-accent-${branchColorOf(p.item, chart.root) ?? "gray"}-text)`);
      if (keep && !(keep.has(p.item) && keep.has(p.item.parent))) path.classList.add("mm-dim");
      svg.append(path);
    }

    // 項目: 形状・枝の色・開閉と中へ入るボタン・選択
    for (const p of tree.placed) {
      const element = stage.querySelector(`[data-node="mm-${p.item.order}"]`);
      if (!element) continue;
      const item = p.item;
      element.dataset.mmShape = item.shape;
      element.classList.add("mm-item");
      if (item === top) element.classList.add("mm-root");
      const color = layoutData[item.key]?.color ?? branchColorOf(item, chart.root);
      if (color) {
        element.style.setProperty("--mm-color", `var(--mdmark-color-accent-${color}-text)`);
        element.style.setProperty("--mm-fill", `var(--mdmark-color-accent-${color}-bg)`);
      }
      if (layoutData[item.key]?.color) element.classList.add("mm-colored");
      if (keep && !keep.has(item)) element.classList.add("mm-dim");
      const selected = state.selected === item;
      // 構成図のノードと同じく、項目の全体を覆う押せる要素がフォーカスを受ける（項目の中にフォーカスできる要素を入れ子にしない）
      const hit = document.createElement("span");
      hit.className = "mm-hit";
      hit.dataset.mmHit = String(item.order);
      hit.tabIndex = 0;
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-roledescription", "項目");
      hit.setAttribute("aria-label", selected ? `${item.label}（選択中）` : item.label);
      element.prepend(hit);
      element.dataset.selected = String(selected);
      if (selected) element.classList.add("mm-selected");
      const choose = () => {
        state.selected = state.selected === item ? undefined : item;
        render();
      };
      element.addEventListener("click", (event) => {
        // 名前の文字・説明のマーカー・ボタンの上では選択を変えない（文字を選んでコピーできる）
        if (event.target.closest("button, .mdmark-diagram-node-name, .mdmark-diagram-info")) return;
        choose();
      });
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose();
        }
      });
      // 子を持つ項目（根を除く）: 外側の辺に開閉と中へ入るボタンの持ち手を付ける
      if (item !== top && item.children.length) {
        const closed = state.collapsed.has(item.stateKey);
        const grip = document.createElement("div");
        grip.className = `mm-grip mm-grip-${p.side}`;
        grip.style.left = `${p.side === "right" ? p.x + p.w : p.x - GRIP_WIDTH}px`;
        grip.style.top = `${p.y + p.h / 2 - 14}px`;
        if (keep && !keep.has(item)) grip.classList.add("mm-dim");
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "mm-toggle";
        toggle.setAttribute("aria-expanded", String(!closed));
        const count = descendantsOf(item).length;
        toggle.setAttribute("aria-label", closed ? `${item.label}の子孫 ${count} 件を開く` : `${item.label}の子孫を閉じる`);
        toggle.title = toggle.getAttribute("aria-label");
        toggle.innerHTML = closed ? `<span class="mm-count">${count}</span>` : icon(p.side === "right" ? "collapse" : "expand");
        toggle.addEventListener("click", () => {
          if (closed) state.collapsed.delete(item.stateKey);
          else state.collapsed.add(item.stateKey);
          render();
        });
        const enter = document.createElement("button");
        enter.type = "button";
        enter.className = "mm-enter";
        enter.setAttribute("aria-label", `${item.label}の中へ入る`);
        enter.title = enter.getAttribute("aria-label");
        enter.innerHTML = icon("enter");
        enter.addEventListener("click", () => {
          state.enter = item;
          state.collapsed.delete(item.stateKey);
          state.selected = undefined;
          render();
        });
        if (p.side === "right") grip.append(toggle, enter);
        else grip.append(enter, toggle);
        stage.append(grip);
      }
    }

    // 中へ入ったときの道筋: 根から入った枝の親までを、図の上端に薄く並べる
    if (trail.length) {
      const bar = document.createElement("div");
      bar.className = "mm-trail";
      bar.setAttribute("aria-label", "根からの道筋");
      bar.innerHTML = [...trail, top].map((item) => `<span>${item.label}</span>`).join('<span aria-hidden="true">›</span>');
      stage.append(bar);
    }

    decorateTools(figure);
    keepScale(figure, definition);
    if (steps.length) renderBand(figure);
    replaceResizeIcon(figure);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    if (oldViewport) {
      viewport.scrollLeft = scroll[0];
      viewport.scrollTop = scroll[1];
    } else {
      // 最初に描いたときは、根が表示する枠の中央に来るようにスクロールする
      const rootPlace = tree.placed.find((p) => p.item === top);
      viewport.scrollLeft = rootPlace.x + rootPlace.w / 2 - viewport.clientWidth / 2;
      viewport.scrollTop = rootPlace.y + rootPlace.h / 2 - viewport.clientHeight / 2;
    }
    // 押したボタンが描き直しで消えたときは、図の表示する枠へフォーカスを移す
    if (mark) (host.querySelector(mark) ?? viewport).focus({ preventScroll: true });
    window.scrollTo({ top: pageY });
    // 描いた名前が見積もりの大きさに収まらなければ、測った大きさで配置し直す
    let grown = false;
    for (const p of tree.placed) {
      const element = stage.querySelector(`[data-node="mm-${p.item.order}"]`);
      const name = element?.querySelector(".mdmark-diagram-node-name");
      if (!name) continue;
      const need = name.scrollHeight + ITEM_PAD_Y * 2 + SHAPE_PAD[p.item.shape];
      if (need > p.h + 1) {
        const side = p.item.shape === "circle" ? Math.max(p.w, need) : undefined;
        state.measured.set(p.item.stateKey, { w: side ?? p.w, h: side ?? need });
        grown = true;
      }
    }
    if (grown) render();
  };

  const leave = () => {
    if (!state.enter) return;
    state.enter = state.enter.parent && state.enter.parent !== chart.root ? state.enter.parent : undefined;
    render();
  };

  /** 図の右上のツールの先頭に、戻る・全て開く・全て閉じる・選択を元に戻すを並べる */
  const decorateTools = (figure) => {
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    group.append(
      toolButton("back", "枝の外へ戻る", leave, state.enter ? {} : { disabled: "" }),
      toolButton("expandAll", "全ての枝を開く", () => {
        state.collapsed.clear();
        render();
      }),
      toolButton("collapseAll", "全ての枝を閉じる", () => {
        const top = state.enter ?? chart.root;
        for (const kid of top.children) if (kid.children.length) state.collapsed.add(kid.stateKey);
        render();
      }),
      toolButton("reset", "選択を元に戻す", () => {
        state.selected = undefined;
        render();
      }, state.selected ? {} : { disabled: "" }),
    );
    figure.querySelector(".mdmark-diagram-tools").prepend(group);
  };

  // Esc: 選択を解き、選んでいなければ 1 つ外の枝へ戻る
  host.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.selected) {
      state.selected = undefined;
      render();
    } else if (state.step === undefined) leave();
  });

  /** 案内の帯: 番号・タイトル・説明の文と、前へ・停止・次へのボタン（構成図の案内の帯と同じ並び） */
  const renderBand = (figure) => {
    const band = document.createElement("div");
    band.className = "map-band";
    band.setAttribute("role", "region");
    band.setAttribute("aria-label", "案内");
    const index = state.step;
    const go = (next) => {
      state.step = next;
      state.selected = undefined;
      render();
    };
    const head = document.createElement("div");
    head.className = "map-band-head";
    const count = Object.assign(document.createElement("span"), { className: "map-band-count", textContent: `${index === undefined ? "–" : index + 1}/${steps.length}` });
    const title = Object.assign(document.createElement("strong"), { className: "map-band-title", textContent: index === undefined ? "" : steps[index].title });
    const actions = document.createElement("div");
    actions.className = "map-band-actions";
    actions.append(
      toolButton("prev", "前の手順", () => go(index === undefined || index === 0 ? steps.length - 1 : index - 1)),
      toolButton("stop", "案内を止める", () => go(undefined), index === undefined ? { disabled: "" } : {}),
      toolButton("play", "自動で進める", () => {}, { "aria-pressed": "false" }),
      toolButton("next", "次の手順", () => go(index === undefined ? 0 : (index + 1) % steps.length)),
    );
    head.append(count, title, actions);
    const body = Object.assign(document.createElement("p"), { className: "map-band-text", textContent: index === undefined ? "" : steps[index].text });
    body.hidden = index === undefined;
    body.setAttribute("aria-live", "polite");
    band.append(head, body);
    figure.querySelector(".mdmark-diagram-box").after(band);
  };

  /** map の図は等倍より縮めない: 今の部品が置き場所の幅に合わせて縮めたら等倍に戻し、表示する枠の中で横にスクロールさせる */
  const keepScale = (figure, definition) => {
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const sizer = figure.querySelector(".mdmark-diagram-sizer");
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    const height = `${Math.min(definition.height + 16, MAX_INITIAL_HEIGHT)}px`;
    const enforce = () => {
      // 今の部品は倍率に合わせて表示する枠の高さと上限を書き換えるため、両方を戻す
      if (viewport.style.height !== height || viewport.style.maxHeight !== height) {
        viewport.style.height = height;
        viewport.style.maxHeight = height;
      }
      const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
      if (scale >= 1) return;
      stage.style.transform = "scale(1)";
      sizer.style.width = `${definition.width}px`;
      sizer.style.height = `${definition.height}px`;
      const zoom = figure.querySelector(".mdmark-diagram-zoom-text, [data-zoom-text]");
      if (zoom) zoom.textContent = "100%";
    };
    const observer = new MutationObserver(enforce);
    observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
    observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
    enforce();
  };

  const replaceResizeIcon = (figure) => {
    const handle = figure.querySelector(".mdmark-diagram-resize");
    if (handle) handle.innerHTML = icon("resize");
  };

  render();
  return { byStateKey };
};
