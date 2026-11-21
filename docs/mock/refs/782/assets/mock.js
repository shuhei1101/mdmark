// #782 のモック: 配布物の mount で実物の map の図を描き、案の見た目だけを重ねる
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

/** map の範囲の Markdown */
export const fence = (title, source) => `<!-- map: {"title": "${title}"} -->

\`\`\`mermaid
${source}
\`\`\`

<!-- /map -->
`;

/** M と L の `d` を点の並びにする */
function pointsOf(d) {
  const numbers = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  const points = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return points;
}

/** 折れ線の最も長い区間（配布物のラベルの置き場所と同じ選び方） */
function longestSegment(points) {
  let best;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const length = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    if (!best || length > best.length) best = { a, b, length, vertical: a[0] === b[0] };
  }
  return best;
}

/**
 * 線のラベルの案を当てる。
 * - `beside`（案 A）: ラベルを線から離し、横の区間なら上、縦の区間なら右に置く
 * - `wrap`（案 B）: ラベルを最も長い区間の長さで折り返す
 */
export function placeLabels(host, mode) {
  for (const label of host.querySelectorAll(".mdmark-diagram-label[data-wire]")) {
    const path = host.querySelector(`path.mdmark-diagram-wire[data-wire="${CSS.escape(label.dataset.wire)}"]`);
    const segment = path && longestSegment(pointsOf(path.getAttribute("d") ?? ""));
    if (!segment) continue;
    label.style.left = `${(segment.a[0] + segment.b[0]) / 2}px`;
    label.style.top = `${(segment.a[1] + segment.b[1]) / 2}px`;
    if (mode === "beside") {
      label.style.transform = segment.vertical ? "translate(8px, -50%)" : "translate(-50%, calc(-100% - 6px))";
    } else if (mode === "wrap") {
      label.style.whiteSpace = "normal";
      label.style.width = "max-content";
      label.style.maxWidth = `${Math.max(48, segment.length - 16)}px`;
      label.style.textAlign = "center";
    }
  }
  // 軸と格子の配置の図の線の文字（線の中ほどから左へ 28px・上へ 20px に、幅 56px で置かれている）
  if (mode !== "beside") return;
  for (const label of host.querySelectorAll(".map-axis-wire-label")) {
    if (label.dataset.mockPlaced) continue;
    label.dataset.mockPlaced = "beside";
    const x = Number.parseFloat(label.style.left) + 28;
    const y = Number.parseFloat(label.style.top) + 20;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.width = "max-content";
    label.style.padding = "0 6px";
    label.style.transform = "translate(-50%, calc(-100% - 6px))";
  }
}
