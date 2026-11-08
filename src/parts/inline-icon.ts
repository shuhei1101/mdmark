import { escapeHtml } from "./escape.ts";

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

/** 行内のアイコンの HTML を返却する。構造があれば svg を中に入れ、無ければ中を空にする */
export const renderInlineIcon = (options: {
  /** アイコンの名前 */
  name: string;
  /** アイコンの形状 */
  node?: MdmarkIconNode | undefined;
}): string => {
  const svg = options.node === undefined ? "" : iconNodeSvg(options.node);
  return `<span class="mdmark-inline-icon" data-icon="${escapeHtml(options.name)}" aria-hidden="true">${svg}</span>`;
};
