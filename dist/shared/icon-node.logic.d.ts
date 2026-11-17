import type { IconNode } from "lucide";
/** lucide のアイコンの形状（要素の並び）を、24 の格子の svg の中身の文字にする */
export declare function iconNodeBody(node: IconNode): string;
/** svg の中身を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export declare function iconSvgOf(body: string): string;
/** Lucide の IconNode（要素の名前と属性の並び） */
export type MdmarkIconNode = Array<[string, Record<string, string>]>;
/** IconNode を、許す要素と描画の属性だけを残した `svg.mdmark-icon` の文字にする */
export declare const iconNodeSvg: (node: MdmarkIconNode) => string;
