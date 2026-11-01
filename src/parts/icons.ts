import type { IconNode } from "lucide";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronUp,
  CircleAlert,
  CodeXml,
  Columns3,
  Copy,
  Database,
  Ellipsis,
  Expand,
  File,
  FileDiff,
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
  TriangleAlert,
  X,
} from "lucide";

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
  server: Server,
  sigma: Sigma,
  info: Info,
  copy: Copy,
  "columns-3": Columns3,
  check: Check,
  "circle-alert": CircleAlert,
  lightbulb: Lightbulb,
  "message-square-warning": MessageSquareWarning,
  "triangle-alert": TriangleAlert,
  "octagon-alert": OctagonAlert,
  pencil: Pencil,
  pin: Pin,
  "chevrons-up-down": ChevronsUpDown,
  "chevrons-down-up": ChevronsDownUp,
  ellipsis: Ellipsis,
  "arrow-up": ArrowUp,
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
} satisfies Record<string, IconNode>;

/** 図と記法で使う lucide のアイコンの名前 */
export type IconName = keyof typeof ICONS;

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
