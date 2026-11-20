// #772 のモック: 配布物の mount で実物の map の図を描き、変える見た目と振る舞いだけを重ねる
import { mount } from "../../../../../dist/index.js";

/** 図を 1 つ描く。描いた後の再描画のたびに `patch` を当て直す */
export function drawMap(host, markdown, patch) {
  mount(host, { markdown });
  let applying = false;
  const apply = () => {
    if (applying) return;
    applying = true;
    patch?.(host);
    queueMicrotask(() => {
      applying = false;
    });
  };
  new MutationObserver(apply).observe(host, { childList: true, subtree: true });
  apply();
}

const NUMBER = "(-?[\\d.]+)";
const HEAD = new RegExp(`^M\\s*${NUMBER}[ ,]${NUMBER}\\s*L\\s*${NUMBER}[ ,]${NUMBER}`);
const TAIL = new RegExp(`L\\s*${NUMBER}[ ,]${NUMBER}\\s*L\\s*${NUMBER}[ ,]${NUMBER}\\s*$`);

/** 線の端の 2 点（端と 1 つ目の折れ目）。端の区間が縦なら縦の辺（上下）から出る */
function endOf(d, which) {
  const m = which === "head" ? HEAD.exec(d) : TAIL.exec(d);
  if (!m) return undefined;
  const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
  const [ex, ey, bx, by] = which === "head" ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
  return { ex, ey, bx, by, vertical: ex === bx };
}

/** 端の 2 点を辺に沿って `shift` ずらした `d` を返す */
function shiftEnd(d, which, end, shift) {
  const dx = end.vertical ? shift : 0;
  const dy = end.vertical ? 0 : shift;
  const pair = (x, y) => `${x + dx} ${y + dy}`;
  if (which === "head") return d.replace(HEAD, `M${pair(end.ex, end.ey)}L${pair(end.bx, end.by)}`);
  return d.replace(TAIL, `L${pair(end.bx, end.by)}L${pair(end.ex, end.ey)}`);
}

/**
 * 同じノードの同じ辺に出入りする線の端を、辺の上で `gap` の間隔に並べる（案の再現）。
 * 同じ点に集まった端を、折れ目の先の座標の順に並べてずらす。線の見た目の path と押せる範囲の path を同じだけずらす
 */
export function spreadPorts(host, gap) {
  const wires = new Map();
  for (const path of host.querySelectorAll("path[data-wire]")) {
    if (path.dataset.mockOriginal === undefined) path.dataset.mockOriginal = path.getAttribute("d");
    const id = path.dataset.wire;
    if (!wires.has(id)) wires.set(id, { id, d: path.dataset.mockOriginal, paths: [] });
    wires.get(id).paths.push(path);
  }
  const groups = new Map();
  for (const wire of wires.values()) {
    wire.next = wire.d;
    for (const which of ["head", "tail"]) {
      const end = endOf(wire.d, which);
      if (!end) continue;
      const key = `${end.ex},${end.ey},${end.vertical}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ wire, which, end });
    }
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => (a.end.vertical ? a.end.bx - b.end.bx : a.end.by - b.end.by));
    members.forEach((member, index) => {
      const shift = (index - (members.length - 1) / 2) * gap;
      member.wire.next = shiftEnd(member.wire.next, member.which, member.end, shift);
    });
  }
  for (const wire of wires.values()) {
    for (const path of wire.paths) {
      if (path.getAttribute("d") !== wire.next) path.setAttribute("d", wire.next);
    }
  }
}

/** マインドマップの項目: 名前の文字の上を押しても選ぶ（文字をドラッグで選んだときは選ばない）（案 A の再現） */
export function selectOnName(host) {
  if (host.dataset.mockSelectOnName) return;
  host.dataset.mockSelectOnName = "true";
  host.addEventListener("click", (event) => {
    const name = event.target.closest?.(".map-mindmap-item .mdmark-diagram-node-name");
    if (!name) return;
    if (String(window.getSelection()) !== "") return;
    name.closest(".map-mindmap-item")?.querySelector(".mdmark-diagram-node-hit")?.click();
  });
}
