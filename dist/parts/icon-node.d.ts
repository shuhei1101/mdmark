import type { IconNode } from "lucide";
/** lucide のアイコンの形（要素の並び）を、24 の格子の svg の中身の文字にする */
export declare function iconNodeBody(node: IconNode): string;
/** svg の中身を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export declare function iconSvgOf(body: string): string;
