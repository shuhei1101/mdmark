import type { IconNode } from "lucide";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpToLine,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  CircleQuestionMark,
  CodeXml,
  Columns3,
  Copy,
  CornerUpLeft,
  Database,
  Ellipsis,
  Expand,
  File,
  FileDiff,
  Flag,
  Folder,
  Funnel,
  Globe,
  Info,
  Lightbulb,
  Link,
  Maximize2,
  Menu,
  MessageSquareWarning,
  Minus,
  OctagonAlert,
  PanelRight,
  PanelRightDashed,
  Pause,
  Pencil,
  Pin,
  Play,
  Plug,
  Plus,
  RotateCcw,
  Server,
  Sigma,
  Split,
  Table,
  TriangleAlert,
  Wrench,
  X,
} from "lucide";

/** wide の範囲を広げるアイコン（`|←→|`）。Lucide に無い形を Lucide と同じ IconNode の形で持つ */
export const WideExpand: IconNode = [
  ["path", { d: "M3 5v14" }],
  ["path", { d: "M21 5v14" }],
  ["path", { d: "M7 12h10" }],
  ["path", { d: "m10 9-3 3 3 3" }],
  ["path", { d: "m14 9 3 3-3 3" }],
];

/** wide の範囲を縮めるアイコン（`→|←`）。Lucide に無い形を Lucide と同じ IconNode の形で持つ */
export const WideShrink: IconNode = [
  ["path", { d: "M12 5v14" }],
  ["path", { d: "M2 12h7" }],
  ["path", { d: "m6 9 3 3-3 3" }],
  ["path", { d: "M22 12h-7" }],
  ["path", { d: "m18 9-3 3 3 3" }],
];

/** 図と記法で使う lucide のアイコン */
const ICONS = {
  plus: Plus,
  minus: Minus,
  "rotate-ccw": RotateCcw,
  expand: Expand,
  x: X,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  bot: Bot,
  split: Split,
  "code-xml": CodeXml,
  plug: Plug,
  database: Database,
  globe: Globe,
  "circle-question-mark": CircleQuestionMark,
  wrench: Wrench,
  flag: Flag,
  server: Server,
  sigma: Sigma,
  info: Info,
  copy: Copy,
  "corner-up-left": CornerUpLeft,
  "columns-3": Columns3,
  check: Check,
  "circle-alert": CircleAlert,
  lightbulb: Lightbulb,
  "message-square-warning": MessageSquareWarning,
  "triangle-alert": TriangleAlert,
  "octagon-alert": OctagonAlert,
  pencil: Pencil,
  pin: Pin,
  "panel-right": PanelRight,
  "panel-right-dashed": PanelRightDashed,
  "chevrons-up-down": ChevronsUpDown,
  "chevrons-down-up": ChevronsDownUp,
  ellipsis: Ellipsis,
  "arrow-up": ArrowUp,
  "arrow-up-to-line": ArrowUpToLine,
  "arrow-down": ArrowDown,
  "arrow-right": ArrowRight,
  funnel: Funnel,
  link: Link,
  file: File,
  "file-diff": FileDiff,
  folder: Folder,
  menu: Menu,
  "maximize-2": Maximize2,
  pause: Pause,
  play: Play,
  table: Table,
  "wide-expand": WideExpand,
  "wide-shrink": WideShrink,
} satisfies Record<string, IconNode>;

/** 図と記法で使う lucide のアイコンの名前 */
export type IconName = keyof typeof ICONS;

/** Lucide に無い形のアイコンの名前（行内のアイコンの束ねた名前に含めない） */
const OWN_ICON_NAMES = new Set(["wide-expand", "wide-shrink"]);

/** 配布物に束ねた Lucide のアイコンの形を名前で引く。束ねていない名前は `undefined` */
export const bundledIconNode = (name: string): IconNode | undefined =>
  Object.hasOwn(ICONS, name) && !OWN_ICON_NAMES.has(name)
    ? ICONS[name as IconName]
    : undefined;

/** 要素 1 つを属性つきの開始タグと閉じタグの文字にする */
function renderNode([tag, attributes]: IconNode[number]): string {
  const attrs = Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${value}"`)
    .join("");
  return `<${tag}${attrs}></${tag}>`;
}

/** lucide のアイコンの形を、24 の格子・`stroke="currentColor"`・`aria-hidden="true"` の svg の文字にする */
export function iconSvg(name: IconName): string {
  const body = ICONS[name].map(renderNode).join("");
  return `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
