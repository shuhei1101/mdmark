import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** `img` の HTML を、押すと拡大するボタンで包む。`icon` が `false` のとき（GIF）は右上のアイコンを置かない */
export function renderImageOpener(options: {
  /** 画像の代わりの文字 */
  alt: string;
  /** 包む `img` の HTML */
  img: string;
  /** 右上に拡大のアイコンを置くか（既定 `true`） */
  icon?: boolean;
}): string {
  const { alt, img, icon = true } = options;
  const iconHtml = icon
    ? `<span class="mdmark-image-open-icon" aria-hidden="true">${iconSvg("maximize-2")}</span>`
    : "";
  return `<button class="mdmark-image-open" type="button" aria-label="画像を拡大: ${escapeHtml(alt)}">${img}${iconHtml}</button>`;
}

/** 画像の図の HTML を返す */
export function renderImageFigure(options: {
  /** 画像の URL */
  src: string;
  /** 画像の代わりの文字 */
  alt: string;
  /** キャプション（画像の title） */
  caption?: string;
  /** 幅（`300px` か `40%`） */
  width?: string;
  /** 配置 */
  align?: "left" | "center" | "right";
  /** 押すと拡大するか（既定 `true`） */
  lightbox?: boolean;
  /** 出す配色 */
  only?: "light" | "dark";
  /** 図の `id`（`fig-` を含む） */
  id?: string;
  /** キャプションの頭の番号（`図 2b`） */
  label?: string;
  /** 拡大のボタンで包むか（既定 `true`。`render` は `false` にし、`mount` が包む） */
  opener?: boolean;
  /** GIF か（既定 `false`） */
  gif?: boolean;
}): string {
  const {
    src,
    alt,
    caption,
    width,
    align,
    lightbox = true,
    only,
    id,
    label,
    opener = true,
    gif = false,
  } = options;
  const className = `mdmark-figure mdmark-image${only ? ` mdmark-only-${only}` : ""}`;
  const idAttribute = id === undefined ? "" : ` id="${escapeHtml(id)}"`;
  const alignAttribute = align === undefined ? "" : ` data-align="${align}"`;
  const style =
    width === undefined
      ? ""
      : ` style="--mdmark-image-width: ${escapeHtml(width)}"`;
  const flags = `${lightbox ? "" : " data-nolightbox"}${gif ? " data-gif" : ""}`;
  const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${flags}>`;
  const body =
    opener && lightbox ? renderImageOpener({ alt, img, icon: !gif }) : img;
  const head = label === undefined ? "" : `<b>${escapeHtml(label)}</b>`;
  const text = caption === undefined ? "" : escapeHtml(caption);
  const figcaption =
    head === "" && text === ""
      ? ""
      : `<figcaption class="mdmark-figure-caption">${head}${text}</figcaption>`;
  return `<figure class="${className}"${idAttribute}${alignAttribute}${style}>${body}${figcaption}</figure>`;
}
