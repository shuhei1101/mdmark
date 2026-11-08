import { isAllowedUrl } from "../render/sanitize.ts";
import { escapeHtml } from "./escape.ts";
import { bundledIconNode } from "./icons.ts";
import { type MdmarkIconNode, renderInlineIcon } from "./inline-icon.ts";

/** カードの格子のカード 1 枚の中身 */
export type CardGridItem = {
  /** タイトルの HTML */
  title: string;
  /** リンク先。無いときはリンクではないカード */
  href?: string | undefined;
  /** Lucide のアイコンの名前 */
  icon?: string | undefined;
  /** 説明の HTML */
  description?: string | undefined;
};

/** 行内のアイコンの要素の class */
const INLINE_ICON_CLASS = 'class="mdmark-inline-icon"';

/** カードのアイコン: 行内のアイコンの要素に、カードのアイコンの class を追加する */
const renderIcon = (
  name: string,
  icons: Record<string, MdmarkIconNode> | undefined,
): string => {
  const node =
    (bundledIconNode(name) as MdmarkIconNode | undefined) ??
    (icons && Object.hasOwn(icons, name) ? icons[name] : undefined);
  return renderInlineIcon({ name, node }).replace(
    INLINE_ICON_CLASS,
    'class="mdmark-inline-icon mdmark-card-grid-icon"',
  );
};

/** カード 1 枚の HTML。許すリンク先を持つときだけリンクにする */
const renderItem = (
  item: CardGridItem,
  icons: Record<string, MdmarkIconNode> | undefined,
): string => {
  const icon = item.icon === undefined ? "" : renderIcon(item.icon, icons);
  const title = `<span class="mdmark-card-grid-title">${item.title}</span>`;
  const description =
    item.description === undefined || item.description === ""
      ? ""
      : `<p class="mdmark-card-grid-desc">${item.description}</p>`;
  const inner = `${icon}${title}${description}`;
  return item.href !== undefined && isAllowedUrl(item.href)
    ? `<a class="mdmark-card-grid-item" href="${escapeHtml(item.href)}">${inner}</a>`
    : `<div class="mdmark-card-grid-item">${inner}</div>`;
};

/** カードの格子の HTML を返却する */
export const renderCardGrid = (options: {
  /** 項目ごとのカードの中身 */
  items: CardGridItem[];
  /** まとめていない名前のアイコンの形状の表 */
  icons?: Record<string, MdmarkIconNode> | undefined;
}): string => {
  const items = options.items
    .map((item) => `<li>${renderItem(item, options.icons)}</li>`)
    .join("");
  return `<ul class="mdmark-card-grid">${items}</ul>`;
};
