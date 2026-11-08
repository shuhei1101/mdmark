import { iconNodeBody, iconSvgOf } from "./icon-node.ts";
import { WideExpand, WideShrink } from "./icons.ts";

/** wide の範囲の HTML を返却する。`toggle` のときは直前に帯と切り替えのボタンを配置する */
export const renderWide = (options: {
  /** 範囲の中身の HTML（`SLOT_MARKER` を指定できる） */
  body: string;
  /** 広げた幅か本文の幅か */
  state: "wide" | "narrow";
  /** 切り替えのボタンの帯を配置するか */
  toggle: boolean;
}): string => {
  const { body, state, toggle } = options;
  const bar = toggle ? renderWideBar(state === "wide") : "";
  return `${bar}<div class="mdmark-wide-range" data-state="${state}">${body}</div>`;
};

/** wide の範囲の上に配置する、切り替えのボタンの帯の HTML を返却する */
export const renderWideBar = (pressed: boolean): string => {
  const shrink = iconSvgOf(iconNodeBody(WideShrink));
  const expand = iconSvgOf(iconNodeBody(WideExpand));
  return `<div class="mdmark-wide-bar"><button class="mdmark-wide-toggle" type="button" aria-label="広げて表示" aria-pressed="${pressed}"><span class="mdmark-wide-icon-shrink">${shrink}</span><span class="mdmark-wide-icon-expand">${expand}</span></button></div>`;
};
