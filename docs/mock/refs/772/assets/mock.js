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

/** M と L だけの `d` を点の並びにする（弧を持つ線は扱わない） */
function pointsOf(d) {
  if (/[^MLml\d\s,.-]/.test(d)) return undefined;
  const numbers = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return points.length >= 2 ? points : undefined;
}

/** 線の端の情報。端の区間が横なら左右の辺（`side` は x）、縦なら上下の辺（`side` は y）から出る */
function endOf(points, which) {
  const [end, bend] = which === "head" ? [points[0], points[1]] : [points.at(-1), points.at(-2)];
  const vertical = end[0] === bend[0];
  const far = which === "head" ? points.at(-1) : points[0];
  return {
    which,
    vertical,
    side: vertical ? end[1] : end[0],
    along: vertical ? end[0] : end[1],
    order: vertical ? far[0] : far[1],
  };
}

/**
 * 同じノードの同じ辺に出入りする線の端を、辺の上で `gap` の間隔に並べる（案の再現）。
 * 同じ辺の線（`side` が同じで、辺に沿った位置が `gap` の 2 倍より近い端）を、相手の端の位置の順に、
 * 元の位置の平均を中心として並べ直す。端と最初の折れ目を一緒にずらし、線の見た目の path と押せる範囲の path を同じだけずらす
 */
export function spreadPorts(host, gap) {
  const wires = new Map();
  for (const path of host.querySelectorAll("path[data-wire]")) {
    if (path.dataset.mockOriginal === undefined) path.dataset.mockOriginal = path.getAttribute("d");
    const id = path.dataset.wire;
    if (!wires.has(id)) wires.set(id, { d: path.dataset.mockOriginal, paths: [] });
    wires.get(id).paths.push(path);
  }
  const ends = [];
  for (const wire of wires.values()) {
    wire.points = pointsOf(wire.d);
    if (!wire.points) continue;
    for (const which of ["head", "tail"]) ends.push({ wire, ...endOf(wire.points, which) });
  }
  const sides = new Map();
  for (const end of ends) {
    const key = `${end.vertical}:${end.side}`;
    if (!sides.has(key)) sides.set(key, []);
    sides.get(key).push(end);
  }
  for (const members of sides.values()) {
    members.sort((a, b) => a.along - b.along);
    const clusters = [];
    for (const end of members) {
      const last = clusters.at(-1);
      if (last && end.along - last.at(-1).along < gap * 2) last.push(end);
      else clusters.push([end]);
    }
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const center = cluster.reduce((sum, end) => sum + end.along, 0) / cluster.length;
      cluster.sort((a, b) => a.order - b.order);
      cluster.forEach((end, index) => {
        const target = center + (index - (cluster.length - 1) / 2) * gap;
        const axis = end.vertical ? 0 : 1;
        const points = end.wire.points;
        const [i, j] = end.which === "head" ? [0, 1] : [points.length - 1, points.length - 2];
        points[i][axis] = target;
        points[j][axis] = target;
      });
    }
  }
  for (const wire of wires.values()) {
    const next = wire.points
      ? wire.points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join("")
      : wire.d;
    for (const path of wire.paths) {
      if (path.getAttribute("d") !== next) path.setAttribute("d", next);
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
