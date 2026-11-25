import { escapeHtml } from "../shared/escape.logic.ts";
import { iconSvg } from "../shared/icons.part.ts";

/** 再生の属性（`controls`・`autoplay` など）を、頭に空白を付けて返却する */
function mediaFlags(options: {
  video: boolean;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
}): string {
  const { video, autoplay, muted, loop } = options;
  return [
    "controls",
    autoplay ? "autoplay" : "",
    autoplay || muted ? "muted" : "",
    loop ? "loop" : "",
    video ? "playsinline" : "",
  ]
    .filter((flag) => flag !== "")
    .map((flag) => ` ${flag}`)
    .join("");
}

/** キャプションの HTML を返却する（無ければ空） */
function renderMediaCaption(caption: string | undefined): string {
  return caption === undefined || caption === ""
    ? ""
    : `<figcaption class="mdmark-figure-caption">${escapeHtml(caption)}</figcaption>`;
}

/** 動画と音声の HTML を返却する */
export function renderMedia(options: {
  /** 動画か音声か */
  kind: "video" | "audio";
  /** ファイルの URL */
  src: string;
  /** スクリーンリーダー向けの名前 */
  alt: string;
  /** キャプション（title） */
  caption?: string;
  /** 幅（`300px` か `40%`） */
  width?: string;
  /** 再生前と印刷のときに出す画像（動画だけ） */
  poster?: string;
  /** 開いたときに再生する */
  autoplay?: boolean;
  /** ミュートにして始める */
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
  const flags = mediaFlags({ video, autoplay, muted, loop });
  const posterUrl = video && poster !== undefined ? escapeHtml(poster) : "";
  const posterAttribute = posterUrl === "" ? "" : ` poster="${posterUrl}"`;
  const player = `<${kind} src="${escapeHtml(src)}"${flags} preload="metadata" aria-label="${escapeHtml(alt)}"${posterAttribute}></${kind}>`;
  const print =
    posterUrl === ""
      ? ""
      : `<img class="mdmark-media-print" src="${posterUrl}" alt="">`;
  const figcaption = renderMediaCaption(caption);
  const style =
    width === undefined
      ? ""
      : ` style="--mdmark-image-width: ${escapeHtml(width)}"`;
  return `<figure class="mdmark-figure mdmark-media"${style}>${player}${print}${figcaption}</figure>`;
}

/** `src` からクエリとフラグメントを除いたファイル名 */
export function fileNameOf(src: string): string {
  const path = src.split(/[?#]/)[0] ?? "";
  return path.slice(path.lastIndexOf("/") + 1);
}

/** 再生のボタンの `data-media-*` の属性を、頭に空白を付けて返却する */
function openerData(options: {
  kind: "video" | "audio";
  src: string;
  caption?: string | undefined;
  poster?: string | undefined;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
}): string {
  const { kind, src, caption, poster, autoplay, muted, loop } = options;
  return [
    ` data-media-kind="${kind}"`,
    ` data-media-src="${escapeHtml(src)}"`,
    caption ? ` data-media-caption="${escapeHtml(caption)}"` : "",
    poster === undefined ? "" : ` data-media-poster="${escapeHtml(poster)}"`,
    autoplay ? " data-media-autoplay" : "",
    autoplay || muted ? " data-media-muted" : "",
    loop ? " data-media-loop" : "",
  ].join("");
}

/** 再生のボタン（ラベルと再生のアイコン、`thumbnail` は `poster` のサムネイル）の HTML を返却する */
export function renderMediaOpener(options: {
  /** 動画か音声か */
  kind: "video" | "audio";
  /** ファイルの URL */
  src: string;
  /** ラベル（空ならファイル名） */
  alt: string;
  /** キャプション（title） */
  caption?: string;
  /** サムネイルにする画像（動画だけ） */
  poster?: string;
  /** 開いたときに再生する */
  autoplay?: boolean;
  /** ミュートにして始める */
  muted?: boolean;
  /** 繰り返し再生する */
  loop?: boolean;
  /** ラベルのボタンか、`poster` のサムネイルか */
  opener: "button" | "thumbnail";
  /** 表のセルの中・文の途中か（`false` は段落ごと包む） */
  inline: boolean;
}): string {
  const {
    kind,
    src,
    alt,
    caption,
    poster,
    autoplay = false,
    muted = false,
    loop = false,
    opener,
    inline,
  } = options;
  const label = alt === "" ? fileNameOf(src) : alt;
  const data = openerData({
    kind,
    src,
    caption,
    poster: kind === "video" ? poster : undefined,
    autoplay,
    muted,
    loop,
  });
  const thumbnail =
    opener === "thumbnail" && kind === "video" ? poster : undefined;
  const button = openerButton({ kind, label, data, thumbnail });
  return wrapOpener({ button, caption, inline });
}

/** 再生のボタンの `button` の HTML（`thumbnail` を渡すとサムネイル） */
function openerButton(options: {
  kind: "video" | "audio";
  label: string;
  data: string;
  thumbnail: string | undefined;
}): string {
  const { kind, label, data, thumbnail } = options;
  if (thumbnail !== undefined) {
    return `<button class="mdmark-media-open mdmark-media-thumb" type="button" aria-haspopup="dialog" aria-label="${escapeHtml(label)}"${data}><img src="${escapeHtml(thumbnail)}" alt=""><span class="mdmark-media-thumb-icon">${iconSvg("play")}</span></button>`;
  }
  const icon = iconSvg(kind === "video" ? "play" : "volume-2");
  return `<button class="mdmark-media-open" type="button" aria-haspopup="dialog"${data}>${icon}<span class="mdmark-media-open-label">${escapeHtml(label)}</span></button>`;
}

/** ボタンの後ろにキャプションを置き、段落なら `div.mdmark-media-inline-figure` で包む */
function wrapOpener(options: {
  button: string;
  caption: string | undefined;
  inline: boolean;
}): string {
  const { button, caption, inline } = options;
  const captionHtml = caption
    ? `<span class="mdmark-media-open-caption">${escapeHtml(caption)}</span>`
    : "";
  return inline
    ? `${button}${captionHtml}`
    : `<div class="mdmark-media-inline-figure">${button}${captionHtml}</div>`;
}
