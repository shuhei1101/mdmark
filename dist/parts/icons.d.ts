import type { IconNode } from "lucide";
/** 図と記法で使う lucide のアイコン */
declare const ICONS: {
    plus: IconNode;
    minus: IconNode;
    "rotate-ccw": IconNode;
    expand: IconNode;
    x: IconNode;
    "chevron-left": IconNode;
    "chevron-right": IconNode;
    "chevron-up": IconNode;
    "chevron-down": IconNode;
    bot: IconNode;
    split: IconNode;
    "code-xml": IconNode;
    plug: IconNode;
    database: IconNode;
    globe: IconNode;
    server: IconNode;
    info: IconNode;
    copy: IconNode;
    check: IconNode;
    "circle-alert": IconNode;
    lightbulb: IconNode;
    "message-square-warning": IconNode;
    "triangle-alert": IconNode;
    "octagon-alert": IconNode;
    pencil: IconNode;
    pin: IconNode;
    "chevrons-up-down": IconNode;
    "arrow-up": IconNode;
    "arrow-down": IconNode;
    funnel: IconNode;
    link: IconNode;
    file: IconNode;
    folder: IconNode;
    menu: IconNode;
};
/** 図と記法で使う lucide のアイコンの名前 */
export type IconName = keyof typeof ICONS;
/** lucide のアイコンの形を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export declare function iconSvg(name: IconName): string;
export {};
