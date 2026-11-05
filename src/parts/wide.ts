import { iconNodeBody, iconSvgOf } from "./icon-node.ts";
import { WideExpand, WideShrink } from "./icons.ts";

/** wide の範囲の HTML を返す。`toggle` のときは直前に帯と切り替えのボタンを置く */
export const renderWide = (options: {
  /** 範囲の中身の HTML（`SLOT_MARKER` を渡せる） */
  body: string;
  /** 広げた幅か本文の幅か */
  state: "wide" | "narrow";
  /** 切り替えのボタンの帯を置くか */
  toggle: boolean;
}): string => {
  const { body, state, toggle } = options;
  const bar = toggle ? renderWideBar(state === "wide") : "";
  return `${bar}<div class="mdmark-wide-range" data-state="${state}">${body}</div>`;
};

/** wide の範囲の上に置く、切り替えのボタンの帯の HTML を返す */
export const renderWideBar = (pressed: boolean): string => {
  const shrink = iconSvgOf(iconNodeBody(WideShrink));
  const expand = iconSvgOf(iconNodeBody(WideExpand));
  return `<div class="mdmark-wide-bar"><button class="mdmark-wide-toggle" type="button" aria-label="広げて表示" aria-pressed="${pressed}"><span class="mdmark-wide-icon-shrink">${shrink}</span><span class="mdmark-wide-icon-expand">${expand}</span></button></div>`;
};
