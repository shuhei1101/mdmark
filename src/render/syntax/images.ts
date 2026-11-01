import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { renderImageFigure } from "../../parts/image.ts";
import { renderMedia } from "../../parts/media.ts";
import { codes } from "./tables.ts";
import { envOf, featureOn, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** 画像の `src` の拡張子で見分けた種類 */
export type MediaKind = "image" | "gif" | "video" | "audio";

/** 動画と音声の拡張子（小文字） */
export const MEDIA_EXTENSIONS: Readonly<
  Record<"video" | "audio", readonly string[]>
> = {
  video: ["mp4", "m4v", "webm", "mov", "ogv"],
  audio: ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac"],
};

/** `{…}` に書ける属性の名前。後ろの 4 つは動画・音声だけ */
export const IMAGE_ATTRIBUTE_NAMES = [
  "width",
  "align",
  "nolightbox",
  "autoplay",
  "muted",
  "loop",
  "poster",
] as const;

/** 動画・音声だけに書ける属性 */
const MEDIA_ONLY_ATTRIBUTES = ["autoplay", "muted", "loop", "poster"];

/** `align=` に書ける配置 */
const ALIGNS = ["left", "center", "right"] as const;

/** 幅の % の上限 */
const MAX_WIDTH_PERCENT = 100;

/** テーマごとの画像のフラグメント */
const ONLY_PATTERN = /#only-(dark|light)$/;

/** 画像の直後の `{…}` */
const ATTRIBUTE_PATTERN = /^\{([^{}]*)\}/;

/** 画像の属性 */
export type ImageAttributes = {
  /** `src` の拡張子で見分けた種類 */
  kind: MediaKind;
  /** `300px` か `40%` の形の幅 */
  width?: string | undefined;
  /** 配置。文の中の画像には入れない */
  align?: (typeof ALIGNS)[number] | undefined;
  /** `nolightbox` を書いたら `false` */
  lightbox: boolean;
  /** 動画・音声だけ */
  autoplay: boolean;
  /** 動画・音声だけ。`autoplay` が `true` なら `true` */
  muted: boolean;
  /** 動画・音声だけ */
  loop: boolean;
  /** 動画だけ。書いたパス */
  poster?: string | undefined;
  /** 読めなかった属性 */
  items: WarningItem[];
};

/** `src` からクエリとフラグメントを除いた拡張子で、画像の種類を見分ける */
export function mediaKindOf(src: string): MediaKind {
  const path = src.split(/[?#]/)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  if (MEDIA_EXTENSIONS.video.includes(extension)) {
    return "video";
  }
  if (MEDIA_EXTENSIONS.audio.includes(extension)) {
    return "audio";
  }
  return extension === "gif" ? "gif" : "image";
}

/** `width=` の値を `300px` か `40%` の形にする。読めなければ `undefined` */
function readWidth(value: string): string | undefined {
  const pixels = /^(\d+)(?:px)?$/.exec(value);
  if (pixels && Number(pixels[1]) >= 1) {
    return `${Number(pixels[1])}px`;
  }
  const percent = /^(\d+)%$/.exec(value);
  const amount = Number(percent?.[1]);
  if (percent && amount >= 1 && amount <= MAX_WIDTH_PERCENT) {
    return `${amount}%`;
  }
  return undefined;
}

/** `{` と `}` の中の文字を空白で区切って画像の属性を読む。読めない属性は当てずに `items` に入れる */
export function readImageAttributes(
  text: string,
  kind: MediaKind,
  inline: boolean,
): ImageAttributes {
  const attributes: ImageAttributes = {
    kind,
    lightbox: true,
    autoplay: false,
    muted: false,
    loop: false,
    items: [],
  };
  const media = kind === "video" || kind === "audio";
  const unreadable = (label: string, message: string) =>
    attributes.items.push({ label, message });
  for (const part of text.split(/\s+/).filter((item) => item !== "")) {
    const equals = part.indexOf("=");
    const name = equals < 0 ? part : part.slice(0, equals);
    const value = equals < 0 ? undefined : part.slice(equals + 1);
    if (MEDIA_ONLY_ATTRIBUTES.includes(name) && !media) {
      unreadable(part, "動画と音声にだけ書ける属性です。");
    } else if (name === "width" && value !== undefined) {
      const width = readWidth(value);
      if (width === undefined) {
        unreadable(
          part,
          `幅は \`300\`・\`300px\` の px か、\`1%\`〜\`${MAX_WIDTH_PERCENT}%\` で書いてください。`,
        );
      } else {
        attributes.width = width;
      }
    } else if (name === "align" && inline) {
      unreadable(
        name,
        "文の中の画像には書けない属性です。画像だけの段落にしてください。",
      );
    } else if (
      name === "align" &&
      ALIGNS.includes(value as (typeof ALIGNS)[number])
    ) {
      attributes.align = value as (typeof ALIGNS)[number];
    } else if (name === "align") {
      unreadable(part, `配置は ${codes(ALIGNS)} で書いてください。`);
    } else if (part === "nolightbox") {
      attributes.lightbox = false;
    } else if (part === "autoplay" || part === "muted" || part === "loop") {
      attributes[part] = true;
    } else if (name === "poster" && kind === "video" && value) {
      attributes.poster = value;
    } else if (name === "poster") {
      unreadable(part, "動画にだけ、`poster=パス` の形で書ける属性です。");
    } else {
      unreadable(part, "使えない属性です。");
    }
  }
  // 音の出る自動再生はブラウザが止めるため、音を消して始める
  if (attributes.autoplay) {
    attributes.muted = true;
  }
  return attributes;
}

/** 画像のトークンの属性。`readImages` が `meta.mdmarkImage` に置く */
export function imageAttributesOf(token: Token): ImageAttributes | undefined {
  return (token.meta as { mdmarkImage?: ImageAttributes } | null)?.mdmarkImage;
}

/** 段落の行内の子のうち、前後の空白の `text` を除いて画像 1 つだけなら、その画像を返す */
export function soleImageOf(inline: Token | undefined): Token | undefined {
  const rest = (inline?.children ?? []).filter(
    (child) => !(child.type === "text" && child.content.trim() === ""),
  );
  const [only] = rest;
  return rest.length === 1 && only?.type === "image" ? only : undefined;
}

/** 動画と音声を、`media` がオンのときだけ見分ける */
function kindOf(state: StateCore, src: string): MediaKind {
  const kind = mediaKindOf(src);
  const media = kind === "video" || kind === "audio";
  return media && !featureOn(state, "media") ? "image" : kind;
}

/** 書き方の警告の本文に並べる、書ける属性の一覧 */
const ATTRIBUTE_LIST = codes(IMAGE_ATTRIBUTE_NAMES);

/** 画像ごとに種類と、`images` がオンなら直後の `{…}` の属性を読んで `meta.mdmarkImage` に置き、`{…}` を外す。読めない属性は段落の前に 1 つの警告を置く */
export function readImages(state: StateCore): void {
  const images = featureOn(state, "images");
  const nonce = envOf(state).nonce;
  const warnings: Array<{ index: number; items: WarningItem[] }> = [];
  for (const [index, token] of state.tokens.entries()) {
    const children = token.children;
    if (token.type !== "inline" || !children) {
      continue;
    }
    const sole = soleImageOf(token);
    const items: WarningItem[] = [];
    for (const [position, child] of children.entries()) {
      if (child.type !== "image") {
        continue;
      }
      const src = String(child.attrGet("src") ?? "");
      const kind = kindOf(state, src);
      const next = children[position + 1];
      const found =
        images && next?.type === "text"
          ? ATTRIBUTE_PATTERN.exec(next.content)
          : null;
      const inline =
        child !== sole && !isSoleWithAttributes(children, position);
      const attributes = readImageAttributes(found?.[1] ?? "", kind, inline);
      if (found && next) {
        next.content = next.content.slice(found[0].length);
      }
      child.meta = { ...(child.meta ?? {}), mdmarkImage: attributes };
      if (kind === "gif") {
        child.attrSet("data-gif", "");
      }
      if (inline && attributes.width !== undefined) {
        child.attrSet("style", `--mdmark-image-width: ${attributes.width}`);
        child.attrSet("data-mdmark-own", nonce);
      }
      items.push(...attributes.items);
    }
    // 属性を外して空になった文字は、画像だけの段落を見分けられるよう取り除く
    token.children = children.filter(
      (child) => !(child.type === "text" && child.content === ""),
    );
    if (items.length) {
      warnings.push({ index, items });
    }
  }
  for (const { index, items } of warnings.reverse()) {
    state.tokens.splice(
      blockStartOf(state.tokens, index),
      0,
      warningBlock(state, {
        message: `画像の読めない属性を当てずに描いています。書ける属性は ${ATTRIBUTE_LIST} です。`,
        items,
      }),
    );
  }
}

/** `position` の画像が、直後の `{…}` を除けば段落の唯一の中身か */
function isSoleWithAttributes(children: Token[], position: number): boolean {
  return children.every((child, at) => {
    if (at === position) {
      return true;
    }
    if (child.type !== "text") {
      return false;
    }
    const content =
      at === position + 1
        ? child.content.replace(ATTRIBUTE_PATTERN, "")
        : child.content;
    return content.trim() === "";
  });
}

/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返す */
export function blockStartOf(tokens: Token[], index: number): number {
  let at = index;
  while (at > 0 && (tokens[at]?.level ?? 0) > 0) {
    at -= 1;
  }
  return at;
}

/** 画像のトークンの代わりの文字 */
export function altOf(image: Token): string {
  const children = image.children ?? [];
  return children.length
    ? children.map((child) => child.content).join("")
    : image.content;
}

/** テーマごとの画像のフラグメントから出す配色を返す */
export function onlyOf(src: string): "dark" | "light" | undefined {
  return ONLY_PATTERN.exec(src)?.[1] as "dark" | "light" | undefined;
}

/** 画像のトークンから部品『画像の図』の HTML を作る（`opener: false`） */
export function imageFigureHtml(
  image: Token,
  extra: { id?: string; label?: string } = {},
): string {
  const src = String(image.attrGet("src") ?? "");
  const attributes = imageAttributesOf(image);
  const title = String(image.attrGet("title") ?? "");
  return renderImageFigure({
    src,
    alt: altOf(image),
    ...(title ? { caption: title } : {}),
    ...(attributes?.width === undefined ? {} : { width: attributes.width }),
    ...(attributes?.align === undefined ? {} : { align: attributes.align }),
    lightbox: attributes?.lightbox ?? true,
    ...(onlyOf(src) === undefined ? {} : { only: onlyOf(src) }),
    ...extra,
    opener: false,
    gif: attributes?.kind === "gif",
  });
}

/** 動画か音声の画像のトークンから部品『動画と音声』の HTML を作る */
function mediaHtml(image: Token, kind: "video" | "audio"): string {
  const attributes = imageAttributesOf(image);
  const title = String(image.attrGet("title") ?? "");
  return renderMedia({
    kind,
    src: String(image.attrGet("src") ?? ""),
    alt: altOf(image),
    ...(title ? { caption: title } : {}),
    ...(attributes?.width === undefined ? {} : { width: attributes.width }),
    ...(attributes?.poster === undefined ? {} : { poster: attributes.poster }),
    autoplay: attributes?.autoplay ?? false,
    muted: attributes?.muted ?? false,
    loop: attributes?.loop ?? false,
  });
}

/** 画像の種類が動画か音声なら、その種類を返す */
function mediaKindOfToken(image: Token): "video" | "audio" | undefined {
  const kind = imageAttributesOf(image)?.kind;
  return kind === "video" || kind === "audio" ? kind : undefined;
}

/** `images` がオンなら画像 1 つだけの段落を画像の図にし、`media` がオンなら動画と音声を再生バー付きの図にする（文の中のものは段落の後ろに置く） */
export function buildImageFigures(state: StateCore): void {
  const images = featureOn(state, "images");
  const media = featureOn(state, "media");
  if (!images && !media) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    const inline = tokens[index + 1];
    const close = tokens[index + 2];
    if (token.type !== "paragraph_open" || inline?.type !== "inline") {
      out.push(token);
      continue;
    }
    const sole = soleImageOf(inline);
    const soleMedia = sole ? mediaKindOfToken(sole) : undefined;
    if (sole && soleMedia && media) {
      out.push(ownBlock(state, mediaHtml(sole, soleMedia), token));
      index += 2;
      continue;
    }
    if (sole && images && !soleMedia) {
      out.push(ownBlock(state, imageFigureHtml(sole), token));
      index += 2;
      continue;
    }
    // 文の中の動画と音声は段落から外し、段落の後ろに置く
    const after: Token[] = [];
    let linkDepth = 0;
    const children: Token[] = [];
    for (const child of inline.children ?? []) {
      linkDepth +=
        child.type === "link_open" ? 1 : child.type === "link_close" ? -1 : 0;
      const kind = child.type === "image" ? mediaKindOfToken(child) : undefined;
      if (kind && media && linkDepth === 0) {
        after.push(ownBlock(state, mediaHtml(child, kind), token));
        continue;
      }
      const only =
        child.type === "image"
          ? onlyOf(String(child.attrGet("src") ?? ""))
          : undefined;
      if (only && images) {
        child.attrJoin("class", `mdmark-only-${only}`);
        child.attrSet("data-mdmark-own", envOf(state).nonce);
      }
      children.push(child);
    }
    inline.children = children;
    out.push(token, inline);
    if (close) {
      out.push(close);
    }
    out.push(...after);
    index += 2;
  }
  state.tokens = out;
}
