import { LABEL_METRICS } from "../../src/diagram/check.ts";
import type { MapLayout } from "./layout.ts";

/** 描いた文書の本文と同じ文字の並び */
export const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif';

const escape = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 配置を SVG の文字列にする */
export const renderMapSvg = (layout: MapLayout): string => {
  const { nameSize, lineHeight } = LABEL_METRICS;
  const parts: string[] = [];
  for (const box of layout.boxes) {
    parts.push(
      `<g data-box="${escape(box.id)}" data-ancestors="${escape(box.ancestors.join(" "))}">` +
        `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8" fill="none" stroke="#8a94a6"/>` +
        `<text x="${box.x + 12}" y="${box.y + 20}" font-size="12">${escape(box.title)}</text></g>`,
    );
  }
  for (const edge of layout.edges) {
    const points = edge.points.map(([x, y]) => `${x},${y}`).join(" ");
    parts.push(
      `<polyline data-edge="${escape(edge.id)}" data-from="${escape(edge.from)}" data-to="${escape(edge.to)}" points="${points}" fill="none" stroke="#5b6475"/>`,
    );
  }
  for (const leaf of layout.leaves) {
    const step = nameSize * lineHeight;
    const top = leaf.y + leaf.h / 2 - (step * leaf.lines.length) / 2 + nameSize;
    const lines = leaf.lines
      .map((line, index) => `<text data-line="${index}" x="${leaf.x + leaf.w / 2}" y="${top + step * index}" text-anchor="middle" font-size="${nameSize}">${escape(line)}</text>`)
      .join("");
    parts.push(
      `<g data-leaf="${escape(leaf.id)}" data-ancestors="${escape(leaf.ancestors.join(" "))}" opacity="${leaf.faded ? 0.4 : 1}">` +
        `<rect x="${leaf.x}" y="${leaf.y}" width="${leaf.w}" height="${leaf.h}" rx="6" fill="#fff" stroke="#3a4252"/>${lines}</g>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family='${FONT_FAMILY}'>${parts.join("")}</svg>`;
};
