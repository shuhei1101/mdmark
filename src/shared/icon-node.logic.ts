import type { IconNode } from "lucide";
import { escapeHtml } from "./escape.logic.ts";

/** lucide のアイコンの形状（要素の並び）を、24 の格子の svg の中身の文字にする */
export function iconNodeBody(node: IconNode): string {
  return node
    .map(([tag, attributes]) => {
      const attrs = Object.entries(attributes)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join("");
      return `<${tag}${attrs}></${tag}>`;
    })
    .join("");
}

/** svg の中身を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export function iconSvgOf(body: string): string {
  return `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/** Lucide の IconNode（要素の名前と属性の並び） */
export type MdmarkIconNode = Array<[string, Record<string, string>]>;

/** svg に残す要素 */
const ALLOWED_ELEMENTS = new Set([
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
]);

/** svg に残す描画の属性 */
const ALLOWED_ATTRIBUTES = new Set([
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
]);

/** IconNode を、許す要素と描画の属性だけを残した `svg.mdmark-icon` の文字にする */
export const iconNodeSvg = (node: MdmarkIconNode): string => {
  const body = node
    .filter(([tag]) => ALLOWED_ELEMENTS.has(tag))
    .map(([tag, attributes]) => {
      const attrs = Object.entries(attributes)
        .filter(
          ([name, value]) =>
            ALLOWED_ATTRIBUTES.has(name) && typeof value === "string",
        )
        .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
        .join("");
      return `<${tag}${attrs}></${tag}>`;
    })
    .join("");
  return `<svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
};
