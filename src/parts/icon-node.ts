import type { IconNode } from "lucide";

/** lucide のアイコンの形（要素の並び）を、24 の格子の svg の中身の文字にする */
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
