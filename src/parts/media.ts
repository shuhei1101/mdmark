import { escapeHtml } from "./escape.ts";

/** 動画と音声の HTML を返す */
export function renderMedia(options: {
  /** 動画か音声か */
  kind: "video" | "audio";
  /** ファイルの URL */
  src: string;
  /** 読み上げの名前 */
  alt: string;
  /** キャプション（title） */
  caption?: string;
  /** 幅（`300px` か `40%`） */
  width?: string;
  /** 再生前と印刷のときに出す画像（動画だけ） */
  poster?: string;
  /** 開いたときに再生する */
  autoplay?: boolean;
  /** 音を消して始める */
  muted?: boolean;
  /** 繰り返し再生する */
  loop?: boolean;
}): string {
  const {
    kind,
    src,
    alt,
    caption,
    width,
    poster,
    autoplay = false,
    muted = false,
    loop = false,
  } = options;
  const video = kind === "video";
  const flags = [
    "controls",
    autoplay ? "autoplay" : "",
    autoplay || muted ? "muted" : "",
    loop ? "loop" : "",
    video ? "playsinline" : "",
  ]
    .filter((flag) => flag !== "")
    .map((flag) => ` ${flag}`)
    .join("");
  const posterUrl = video && poster !== undefined ? escapeHtml(poster) : "";
  const posterAttribute = posterUrl === "" ? "" : ` poster="${posterUrl}"`;
  const player = `<${kind} src="${escapeHtml(src)}"${flags} preload="metadata" aria-label="${escapeHtml(alt)}"${posterAttribute}></${kind}>`;
  const print =
    posterUrl === ""
      ? ""
      : `<img class="mdmark-media-print" src="${posterUrl}" alt="">`;
  const figcaption =
    caption === undefined || caption === ""
      ? ""
      : `<figcaption class="mdmark-figure-caption">${escapeHtml(caption)}</figcaption>`;
  const style =
    width === undefined
      ? ""
      : ` style="--mdmark-image-width: ${escapeHtml(width)}"`;
  return `<figure class="mdmark-figure mdmark-media"${style}>${player}${print}${figcaption}</figure>`;
}
