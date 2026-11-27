import { ZOOM } from "../diagram/geometry.ts";
import { escapeHtml } from "../shared/escape.logic.ts";
import { type IconName, iconSvg } from "../shared/icons.part.ts";

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

/** ライトボックスのボタン 1 つの HTML */
function tool(options: {
  name: string;
  label: string;
  icon: IconName;
  disabled?: boolean;
}): string {
  const { name, label, icon, disabled = false } = options;
  return `<button class="mdmark-lightbox-tool" type="button" data-tool="${name}" aria-label="${label}" title="${label}"${disabled ? " disabled" : ""}>${iconSvg(icon)}</button>`;
}

/** ライトボックスの `dialog` の HTML を返却する */
export function renderLightbox(options: {
  /** 画像の URL */
  src: string;
  /** 画像の代わりの文字 */
  alt: string;
  /** キャプション */
  caption?: string;
  /** 何枚目か（1 から） */
  index: number;
  /** 切り替えの並びの枚数 */
  total: number;
  /** 今の倍率（既定は `fit`） */
  zoom?: number;
  /** 全体が収まる倍率（既定 1） */
  fit?: number;
}): string {
  const { src, alt, caption = "", index, total, fit = 1 } = options;
  const zoom = options.zoom ?? fit;
  const nav =
    total > 1
      ? `<span class="mdmark-lightbox-nav" role="group" aria-label="画像の切り替え">${tool({ name: "prev", label: "前の画像", icon: "chevron-left", disabled: index <= 1 })}<span class="mdmark-lightbox-count">${index} / ${total}</span>${tool({ name: "next", label: "次の画像", icon: "chevron-right", disabled: index >= total })}</span>`
      : "";
  const percent = `${Math.round(zoom * 100)}%`;
  const zoomGroup = `<span class="mdmark-lightbox-group" data-group="zoom">${tool({ name: "out", label: "縮小", icon: "minus", disabled: zoom <= fit * ZOOM.minRatio + ZOOM_EPSILON })}<button class="mdmark-lightbox-zoom" type="button" data-tool="fit" aria-label="倍率 ${percent}。全体が収まる倍率に戻す" title="全体が収まる倍率に戻す">${percent}</button>${tool({ name: "in", label: "拡大", icon: "plus", disabled: zoom >= fit * ZOOM.maxRatio - ZOOM_EPSILON })}</span>`;
  const screen = `<span class="mdmark-lightbox-group" data-group="screen">${tool({ name: "close", label: "拡大を閉じる", icon: "x" })}</span>`;
  const move = `<button class="mdmark-lightbox-tool mdmark-lightbox-move" type="button" aria-haspopup="true" aria-expanded="false" aria-label="拡大した画像を移動" title="移動" hidden>${iconSvg("move")}</button>`;
  const head = `<div class="mdmark-lightbox-head">${nav}<span class="mdmark-lightbox-tools" role="toolbar" aria-label="画像の拡大の操作">${move}${zoomGroup}${screen}</span></div>`;
  const stage = `<div class="mdmark-lightbox-stage" tabindex="0" aria-label="拡大した画像。ドラッグか矢印キーで動かす"><div class="mdmark-lightbox-sizer"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></div></div>`;
  const captionHtml = `<p class="mdmark-lightbox-caption"${caption === "" ? " hidden" : ""}>${escapeHtml(caption)}</p>`;
  return `<dialog class="mdmark-lightbox" aria-label="画像の拡大">${head}${stage}${captionHtml}</dialog>`;
}
