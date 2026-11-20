// #740 のモックの map の図に追加する表示を、配布物の mount で描いた本物の図の上に重ねる処理
// 確信度のバッジ・計画した変更の色とバッジ・線のツールチップ・記載の警告・書き出すメニュー・一覧の表示

import { mount } from "../../../../../dist/index.js";

/** 確信度の値と画面に出す名前 */
export const TRUST_LABELS = { confirmed: "確認済み", inferred: "推測", hypothesis: "仮説", unsourced: "出典なし" };
/** 計画した変更の値と画面に出す名前 */
export const CHANGE_LABELS = { added: "追加", changed: "変更", removed: "削除" };

/** 利用側の設定（種類のアイコンと形状） */
export const CONFIG = {
  map: {
    kinds: {
      step: { label: "処理", icon: "cog", shape: "rounded" },
      store: { label: "保存先", icon: "database", shape: "rect", color: "purple" },
      outside: { label: "外部", icon: "globe", shape: "pill", color: "green" },
    },
  },
};

/** 要素の中に Markdown を描き、全ての map の図を描き終えるのを待つ */
export async function renderDoc(el, markdown) {
  mount(el, { markdown, config: CONFIG });
  const count = (markdown.match(/<!-- map/g) ?? []).length - (markdown.match(/<!-- map-data/g) ?? []).length;
  for (let i = 0; i < 200; i += 1) {
    if (el.querySelectorAll(".mdmark-map .mdmark-diagram-stage").length >= count && el.querySelector(".mdmark-diagram-node")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await new Promise((resolve) => requestAnimationFrame(resolve));
  return [...el.querySelectorAll(".mdmark-map")];
}

function badge(text, attrs) {
  const span = document.createElement("span");
  span.className = "map740-badge";
  span.textContent = text;
  for (const [key, value] of Object.entries(attrs)) span.dataset[key] = value;
  return span;
}

function nodeOf(frame, id) {
  return frame.querySelector(`.mdmark-diagram-node[data-node="${CSS.escape(id)}"]`) ?? frame.querySelector(`[data-group="${CSS.escape(id)}"]`);
}

/** ノード・グループに確信度と変更のバッジを付け、変更の色の class を付ける */
function decorateNode(frame, id, { level, change }) {
  const node = nodeOf(frame, id);
  if (!node) return;
  const host = node;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  let box = host.querySelector(":scope > .map740-badges");
  if (!box) {
    box = document.createElement("span");
    box.className = "map740-badges";
    host.append(box);
  }
  if (change) {
    box.append(badge(CHANGE_LABELS[change], { change }));
    node.classList.add(`map740-${change}`);
  }
  if (level) box.append(badge(TRUST_LABELS[level], { level }));
  const names = [level && `確信度 ${TRUST_LABELS[level]}`, change && CHANGE_LABELS[change]].filter(Boolean).join("、");
  const hit = node.querySelector(".mdmark-diagram-node-hit");
  if (hit && names) hit.setAttribute("aria-label", `${hit.getAttribute("aria-label")}、${names}`);
}

/** 線の経路の中点（図の stage の座標） */
function wireMidpoint(frame, wire) {
  const path = frame.querySelector(`path.map-wire-hit[data-wire="${CSS.escape(wire)}"]`);
  if (!path) return null;
  const length = path.getTotalLength();
  return path.getPointAtLength(length / 2);
}

/** 線に確信度のバッジを付ける。ラベルがあればラベルの後ろ、無ければ経路の中点 */
function decorateWire(frame, wire, { level, change }) {
  if (change) {
    for (const path of frame.querySelectorAll(`.mdmark-diagram-wires path[data-wire="${CSS.escape(wire)}"]`)) path.classList.add(`map740-wire-${change}`);
  }
  if (!level) return;
  const label = frame.querySelector(`.mdmark-diagram-label[data-wire="${CSS.escape(wire)}"]`);
  if (label) {
    label.append(badge(TRUST_LABELS[level], { level }));
    return;
  }
  const point = wireMidpoint(frame, wire);
  if (!point) return;
  const holder = document.createElement("span");
  holder.className = "map740-wire-badge";
  holder.style.left = `${point.x}px`;
  holder.style.top = `${point.y}px`;
  holder.append(badge(TRUST_LABELS[level], { level }));
  frame.querySelector(".mdmark-diagram-stage").append(holder);
}

/** 補足の trust・changes に当たる表示を、ノードと線に付ける */
export function decorate(frame, { trust = {}, changes = {}, wires = [] }) {
  const ids = new Set([...Object.keys(trust), ...Object.keys(changes)]);
  for (const id of ids) {
    const value = { level: trust[id]?.level, change: changes[id]?.type };
    if (wires.includes(id)) decorateWire(frame, id, value);
    else decorateNode(frame, id, value);
  }
}

/** 線にポインターを重ねたときのツールチップを、線の中点に出したままにする（モックの場面用） */
export function showWireTip(frame, wire, lines, offset = { x: 12, y: 12 }) {
  const point = wireMidpoint(frame, wire);
  if (!point) return;
  const tip = document.createElement("span");
  tip.className = "map740-static-tip";
  tip.style.cssText = `position:absolute;left:${point.x + offset.x}px;top:${point.y + offset.y}px;max-width:240px;padding:6px 10px;border:1px solid var(--mdmark-color-border);border-radius:6px;background:var(--mdmark-color-surface);color:var(--mdmark-color-text);font-size:13px;line-height:1.5;box-shadow:0 2px 8px rgb(0 0 0 / 12%);z-index:5`;
  tip.innerHTML = lines.map((line, i) => `<span style="display:block;${i === 0 ? "font-weight:600" : ""}">${line}</span>`).join("");
  frame.querySelector(".mdmark-diagram-stage").append(tip);
}

/** 図の前に記載の警告を出す（本物の記載の警告と同じ HTML） */
export function addWarning(frame, items) {
  const div = document.createElement("div");
  div.className = "mdmark-syntax-warning";
  div.setAttribute("role", "note");
  div.innerHTML = `<p class="mdmark-syntax-warning-title">記載の警告</p><p>map の補足に読み取れない値があります。読み取れた部分の図を描いています。</p><ul>${items.map((item) => `<li><code>${item.kind}</code>: ${item.message}</li>`).join("")}</ul>`;
  frame.before(div);
}

function toolButton(label, iconPath) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mdmark-diagram-tool";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPath}</svg>`;
  return button;
}

/** パネルの全画面のグループに書き出すボタンとメニューを足す。メニューで選ぶと、PoC の方式で SVG・PNG を作ってダウンロードさせる */
export function addExport(frame, index) {
  const group = frame.querySelector('.mdmark-diagram-tools-group[data-group="screen"]');
  if (!group) return null;
  const button = toolButton("図を書き出す", '<path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>');
  const menuId = `map740-export-${index}`;
  button.setAttribute("popovertarget", menuId);
  button.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.id = menuId;
  menu.className = "map740-export-menu";
  menu.setAttribute("popover", "auto");
  menu.setAttribute("aria-label", "書き出す形式");
  for (const format of ["SVG", "PNG"]) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = format;
    item.addEventListener("click", () => {
      menu.hidePopover();
      download(frame, format.toLowerCase());
      button.focus();
    });
    menu.append(item);
  }
  menu.addEventListener("toggle", (event) => {
    button.setAttribute("aria-expanded", String(event.newState === "open"));
    if (event.newState === "open") {
      const r = button.getBoundingClientRect();
      menu.style.position = "absolute";
      menu.style.top = `${r.bottom + 4 + window.scrollY}px`;
      menu.style.left = `${Math.max(8, r.right - 130 + window.scrollX)}px`;
      menu.querySelector("button").focus();
    } else if (event.newState === "closed") {
      button.focus();
    }
  });
  group.append(button);
  frame.append(menu);
  return { button, menu };
}

/** PoC で成立した foreignObject の方式で、今の見せ方の図を SVG・PNG にしてダウンロードさせる */
async function download(frame, format) {
  const stage = frame.querySelector(".mdmark-diagram-stage");
  const width = Math.ceil(stage.offsetWidth);
  const height = Math.ceil(stage.offsetHeight);
  const clone = stage.cloneNode(true);
  const originals = [...stage.querySelectorAll("*")];
  const copies = [...clone.querySelectorAll("*")];
  const inline = (src, dst) => {
    const cs = getComputedStyle(src);
    let style = "";
    for (let i = 0; i < cs.length; i += 1) {
      const value = cs.getPropertyValue(cs[i]);
      if (!value.includes("url(")) style += `${cs[i]}:${value};`;
    }
    dst.setAttribute("style", style);
    dst.removeAttribute("class");
    [...src.children].forEach((child, i) => inline(child, dst.children[i]));
  };
  inline(stage, clone);
  originals.forEach((el, i) => {
    if (el.matches(".map-wire-hits, .map-packets, .map740-static-tip")) copies[i].remove();
  });
  for (const el of [clone, ...clone.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) if (attr.value.includes("var(")) el.removeAttribute(attr.name);
  }
  clone.style.transform = "none";
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const bg = getComputedStyle(document.body).backgroundColor;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${bg}"/><foreignObject width="${width}" height="${height}">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
  const title = frame.querySelector(".mdmark-diagram-title")?.textContent.trim() || `図 ${[...document.querySelectorAll(".mdmark-map")].indexOf(frame) + 1}`;
  let blob = new Blob([svg], { type: "image/svg+xml" });
  if (format === "png") {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, width, height);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** パネルの map のグループに一覧の表示のボタンを足し、押すと表示する枠の中を図と一覧で切り替える */
export function addListToggle(frame, buildItems) {
  const group = frame.querySelector('.mdmark-diagram-tools-group[data-group="map"]') ?? frame.querySelector('.mdmark-diagram-tools-group[data-group="zoom"]');
  if (!group) return null;
  const button = toolButton("一覧で表示", '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>');
  button.setAttribute("aria-pressed", "false");
  const viewport = frame.querySelector(".mdmark-diagram-viewport");
  let list = null;
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    if (on) {
      list = renderTree(buildItems());
      viewport.style.display = "none";
      viewport.after(list);
      list.querySelector('[role="treeitem"]')?.focus();
    } else {
      list?.remove();
      viewport.style.display = "";
      button.focus();
    }
  });
  group.prepend(button);
  return button;
}

/** 入れ子の項目からツリーの一覧を作る。↑↓ で項目を移り、→ で開き、← で閉じる */
function renderTree(items) {
  const root = document.createElement("ul");
  root.className = "map740-list";
  root.setAttribute("role", "tree");
  root.setAttribute("aria-label", "図の一覧");
  const build = (parent, list, level) => {
    for (const item of list) {
      const li = document.createElement("li");
      li.setAttribute("role", "treeitem");
      li.setAttribute("aria-level", String(level));
      li.tabIndex = -1;
      const row = document.createElement("span");
      row.className = "map740-row";
      const hasChildren = Boolean(item.children?.length);
      row.innerHTML = `<span class="map740-toggle" aria-hidden="true">${hasChildren ? "▾" : ""}</span><span class="map740-name">${item.name}</span>${item.kind ? `<span class="map740-kind">${item.kind}</span>` : ""}${item.note ? `<span class="map740-note">${item.note}</span>` : ""}${(item.out ?? []).map((o) => `<span class="map740-out">${o}</span>`).join("")}`;
      li.append(row);
      if (hasChildren) {
        li.setAttribute("aria-expanded", "true");
        const ul = document.createElement("ul");
        ul.setAttribute("role", "group");
        build(ul, item.children, level + 1);
        li.append(ul);
      }
      parent.append(li);
    }
  };
  build(root, items, 1);
  const first = root.querySelector('[role="treeitem"]');
  if (first) first.tabIndex = 0;
  root.addEventListener("keydown", (event) => {
    const visible = [...root.querySelectorAll('[role="treeitem"]')].filter((el) => el.offsetParent !== null);
    const current = document.activeElement.closest('[role="treeitem"]');
    const i = visible.indexOf(current);
    const move = (target) => {
      if (!target) return;
      current.tabIndex = -1;
      target.tabIndex = 0;
      target.focus();
    };
    if (event.key === "ArrowDown") move(visible[i + 1]);
    else if (event.key === "ArrowUp") move(visible[i - 1]);
    else if (event.key === "ArrowRight" && current.getAttribute("aria-expanded") === "false") current.setAttribute("aria-expanded", "true");
    else if (event.key === "ArrowLeft" && current.getAttribute("aria-expanded") === "true") current.setAttribute("aria-expanded", "false");
    else return;
    const toggle = current.querySelector(":scope > .map740-row > .map740-toggle");
    if (toggle && current.hasAttribute("aria-expanded")) toggle.textContent = current.getAttribute("aria-expanded") === "true" ? "▾" : "▸";
    event.preventDefault();
  });
  return root;
}
