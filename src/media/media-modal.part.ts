import { escapeHtml } from "../shared/escape.logic.ts";
import { iconSvg } from "../shared/icons.part.ts";

/** 再生のダイアログの閉じるボタンの名前 */
const CLOSE_LABEL = "再生を閉じる";

/** 動画と音声の再生のダイアログの `dialog` の HTML を返却する */
export const renderMediaModal = (options: {
  /** タイトルの `id` の頭 */
  id: string;
  /** 動画か音声か */
  kind: "video" | "audio";
  /** ファイルの URL */
  src: string;
  /** タイトルとスクリーンリーダー向けの名前 */
  label: string;
  /** キャプション */
  caption?: string;
  /** 再生前に出す画像（動画だけ） */
  poster?: string;
  /** ミュートにして始める */
  muted?: boolean;
  /** 繰り返し再生する */
  loop?: boolean;
}): string => {
  const {
    id,
    kind,
    src,
    label,
    caption = "",
    poster,
    muted = false,
    loop = false,
  } = options;
  const video = kind === "video";
  const flags = [
    " controls",
    " autoplay",
    muted ? " muted" : "",
    loop ? " loop" : "",
    video ? " playsinline" : "",
    video && poster !== undefined ? ` poster="${escapeHtml(poster)}"` : "",
  ].join("");
  const titleId = `${id}-title`;
  const close = `<button class="mdmark-lightbox-tool" type="button" data-tool="close" aria-label="${CLOSE_LABEL}" title="${CLOSE_LABEL}">${iconSvg("x")}</button>`;
  const head = `<div class="mdmark-media-modal-head"><p class="mdmark-media-modal-title" id="${escapeHtml(titleId)}">${escapeHtml(label)}</p>${close}</div>`;
  const stage = `<div class="mdmark-media-modal-stage"><${kind} src="${escapeHtml(src)}"${flags} aria-label="${escapeHtml(label)}"></${kind}></div>`;
  const captionHtml =
    caption === ""
      ? ""
      : `<p class="mdmark-media-modal-caption">${escapeHtml(caption)}</p>`;
  return `<dialog class="mdmark-media-modal" closedby="any" aria-labelledby="${escapeHtml(titleId)}">${head}${stage}${captionHtml}</dialog>`;
};
