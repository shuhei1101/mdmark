import type { IconNode } from "lucide";
/** wide の範囲を広げるアイコン（`|←→|`）。Lucide に無い形を Lucide と同じ IconNode の形で持つ */
export declare const WideExpand: IconNode;
/** wide の範囲を縮めるアイコン（`→|←`）。Lucide に無い形を Lucide と同じ IconNode の形で持つ */
export declare const WideShrink: IconNode;
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
    "circle-question-mark": IconNode;
    wrench: IconNode;
    flag: IconNode;
    server: IconNode;
    sigma: IconNode;
    info: IconNode;
    "grip-horizontal": IconNode;
    copy: IconNode;
    "corner-up-left": IconNode;
    "columns-3": IconNode;
    check: IconNode;
    "circle-alert": IconNode;
    lightbulb: IconNode;
    "message-square-warning": IconNode;
    "triangle-alert": IconNode;
    user: IconNode;
    "octagon-alert": IconNode;
    pencil: IconNode;
    pin: IconNode;
    "panel-right": IconNode;
    "panel-right-dashed": IconNode;
    "chevrons-up-down": IconNode;
    "chevrons-down-up": IconNode;
    ellipsis: IconNode;
    "arrow-up": IconNode;
    "arrow-up-to-line": IconNode;
    "arrow-down": IconNode;
    "arrow-right": IconNode;
    funnel: IconNode;
    link: IconNode;
    file: IconNode;
    "file-diff": IconNode;
    folder: IconNode;
    menu: IconNode;
    "maximize-2": IconNode;
    pause: IconNode;
    play: IconNode;
    table: IconNode;
    "settings-2": IconNode;
    "grip-vertical": IconNode;
    eye: IconNode;
    "eye-off": IconNode;
    "wide-expand": IconNode;
    "wide-shrink": IconNode;
};
/** 図と記法で使う lucide のアイコンの名前 */
export type IconName = keyof typeof ICONS;
/** 配布物に束ねた Lucide のアイコンの形を名前で引く。束ねていない名前は `undefined` */
export declare const bundledIconNode: (name: string) => IconNode | undefined;
/** lucide のアイコンの形を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export declare function iconSvg(name: IconName): string;
export {};
