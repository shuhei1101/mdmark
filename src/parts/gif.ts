import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";
import { renderImageOpener } from "./image.ts";

/** GIF の止める・再生するボタンの HTML を返す。アイコンは両方置き、出す側は CSS が `aria-pressed` で決める */
export function renderGifToggle(options: {
  /** 止めているか */
  paused: boolean;
}): string {
  const label = options.paused ? "GIF を再生" : "GIF を停止";
  return `<button class="mdmark-gif-toggle" type="button" aria-pressed="${options.paused}" aria-label="${label}" title="${label}"><span class="mdmark-gif-icon-pause">${iconSvg("pause")}</span><span class="mdmark-gif-icon-play">${iconSvg("play")}</span></button>`;
}

/** GIF の HTML を返す（Storybook の見た目。`mount` は描いた `img` を包んで同じ形にする） */
export function renderGif(options: {
  /** 画像の URL */
  src: string;
  /** 画像の代わりの文字 */
  alt: string;
  /** 止めているか（既定 `false`） */
  paused?: boolean;
  /** 押すと拡大するか（既定 `true`） */
  lightbox?: boolean;
}): string {
  const { src, alt, paused = false, lightbox = true } = options;
  const style = paused ? ' style="visibility: hidden"' : "";
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" data-gif${style}>`;
  const body = lightbox ? renderImageOpener({ alt, img, icon: false }) : img;
  const canvas = `<canvas aria-hidden="true"${paused ? "" : " hidden"}></canvas>`;
  return `<span class="mdmark-gif">${body}${canvas}${renderGifToggle({ paused })}</span>`;
}
