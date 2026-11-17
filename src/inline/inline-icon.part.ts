import { escapeHtml } from "../shared/escape.logic.ts";
import { iconNodeSvg, type MdmarkIconNode } from "../shared/icon-node.logic.ts";

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
