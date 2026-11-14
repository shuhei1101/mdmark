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

/** `{…}` に記載できる属性の名前。後ろの 4 つは動画・音声だけ */
export const IMAGE_ATTRIBUTE_NAMES = [
  "width",
  "align",
  "nolightbox",
  "autoplay",
  "muted",
  "loop",
  "poster",
] as const;

/** 動画・音声だけに記載できる属性 */
const MEDIA_ONLY_ATTRIBUTES = ["autoplay", "muted", "loop", "poster"];

/** `align=` に記載できる配置 */
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
  /** `300px` か `40%` の構造の幅 */
  width?: string | undefined;
  /** 配置。文の中の画像には入れない */
  align?: (typeof ALIGNS)[number] | undefined;
  /** `nolightbox` を記載したら `false` */
  lightbox: boolean;
  /** 動画・音声だけ */
  autoplay: boolean;
  /** 動画・音声だけ。`autoplay` が `true` なら `true` */
  muted: boolean;
  /** 動画・音声だけ */
  loop: boolean;
  /** 動画だけ。記載したパス */
  poster?: string | undefined;
  /** 読み込めなかった属性 */
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

/** `width=` の値を `300px` か `40%` の構造にする。読み込めなければ `undefined` */
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

/** 属性 1 つ（記載した文字・名前・`=` の後ろの値と、画像の種類・文の中の画像か） */
type AttributePart = {
  part: string;
  name: string;
  value: string | undefined;
  kind: MediaKind;
  inline: boolean;
};

/** 読み込めない属性 */
type Unreadable = WarningItem;

/** 使用できない属性 */
const unusable = (attribute: AttributePart): Unreadable => ({
  label: attribute.part,
  message: "使用できない属性です。",
});

/** `width=` を幅にする */
const readWidthAttribute = (
  attributes: ImageAttributes,
  attribute: AttributePart,
): Unreadable | undefined => {
  if (attribute.value === undefined) {
    return unusable(attribute);
  }
  const width = readWidth(attribute.value);
  if (width === undefined) {
    return {
      label: attribute.part,
      message: `幅は \`300\`・\`300px\` の px か、\`1%\`〜\`${MAX_WIDTH_PERCENT}%\` で記載してください。`,
    };
  }
  attributes.width = width;
  return undefined;
};

/** `align=` を配置にする（文の中の画像には記載できない） */
const readAlignAttribute = (
  attributes: ImageAttributes,
  attribute: AttributePart,
): Unreadable | undefined => {
  const { name, value, inline, part } = attribute;
  if (inline) {
    return {
      label: name,
      message:
        "文の中の画像には記載できない属性です。画像だけの段落にしてください。",
    };
  }
  if (!ALIGNS.includes(value as (typeof ALIGNS)[number])) {
    return {
      label: part,
      message: `配置は ${codes(ALIGNS)} で記載してください。`,
    };
  }
  attributes.align = value as (typeof ALIGNS)[number];
  return undefined;
};

/** 値を持たない属性（`autoplay`・`muted`・`loop`）を当てる */
const readFlagAttribute = (
  attributes: ImageAttributes,
  attribute: AttributePart,
): Unreadable | undefined => {
  const { part } = attribute;
  if (part !== "autoplay" && part !== "muted" && part !== "loop") {
    return unusable(attribute);
  }
  attributes[part] = true;
  return undefined;
};

/** 属性の名前ごとの読み方。読み込めなければ読み込めない属性を返却する */
const ATTRIBUTE_READERS: Readonly<
  Record<
    string,
    (
      attributes: ImageAttributes,
      attribute: AttributePart,
    ) => Unreadable | undefined
  >
> = {
  width: readWidthAttribute,
  align: readAlignAttribute,
  nolightbox: (attributes, attribute) => {
    if (attribute.part !== "nolightbox") {
      return unusable(attribute);
    }
    attributes.lightbox = false;
    return undefined;
  },
  autoplay: readFlagAttribute,
  muted: readFlagAttribute,
  loop: readFlagAttribute,
  poster: (attributes, attribute) => {
    if (attribute.kind === "video" && attribute.value) {
      attributes.poster = attribute.value;
      return undefined;
    }
    return {
      label: attribute.part,
      message: "動画にだけ、`poster=パス` の構造で記載できる属性です。",
    };
  },
};

/** 属性 1 つを読み込む。読み込めなければ読み込めない属性を返却する */
const readAttribute = (
  attributes: ImageAttributes,
  attribute: AttributePart,
): Unreadable | undefined => {
  const { kind, name, part } = attribute;
  const media = kind === "video" || kind === "audio";
  if (MEDIA_ONLY_ATTRIBUTES.includes(name) && !media) {
    return { label: part, message: "動画と音声にだけ記載できる属性です。" };
  }
  const read = Object.hasOwn(ATTRIBUTE_READERS, name)
    ? ATTRIBUTE_READERS[name]
    : undefined;
  return read ? read(attributes, attribute) : unusable(attribute);
};

/** `{` と `}` の中の文字を空白で区切って画像の属性を読み込む。読み込めない属性は当てずに `items` に入れる */
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
  for (const part of text.split(/\s+/).filter((item) => item !== "")) {
    const equals = part.indexOf("=");
    const unreadable = readAttribute(attributes, {
      part,
      name: equals < 0 ? part : part.slice(0, equals),
      value: equals < 0 ? undefined : part.slice(equals + 1),
      kind,
      inline,
    });
    if (unreadable) {
      attributes.items.push(unreadable);
    }
  }
  // 音の出る自動再生はブラウザが止めるため、ミュートにして始める
  if (attributes.autoplay) {
    attributes.muted = true;
  }
  return attributes;
}

/** 画像のトークンの属性。`readImages` が `meta.mdmarkImage` に配置する */
export function imageAttributesOf(token: Token): ImageAttributes | undefined {
  return (token.meta as { mdmarkImage?: ImageAttributes } | null)?.mdmarkImage;
}

/** 段落の行内の子のうち、前後の空白の `text` を除いて画像 1 つだけなら、その画像を返却する */
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

/** 記載の警告の本文に並べる、記載できる属性の一覧 */
const ATTRIBUTE_LIST = codes(IMAGE_ATTRIBUTE_NAMES);

/** 画像の直後の文字の頭の `{…}` を削除し、`{` と `}` の中の文字を返却する（無ければ空） */
function takeAttributeText(next: Token | undefined): string {
  if (next?.type !== "text") {
    return "";
  }
  const found = ATTRIBUTE_PATTERN.exec(next.content);
  if (!found) {
    return "";
  }
  next.content = next.content.slice(found[0].length);
  return found[1] ?? "";
}

/** 段落の画像 1 つの種類と、`images` がオンなら直後の `{…}` の属性を読み込んで `meta.mdmarkImage` に配置し、`{…}` を削除する。読み込めない属性を返却する */
function readImage(
  state: StateCore,
  image: {
    children: Token[];
    position: number;
    sole: Token | undefined;
    images: boolean;
  },
): WarningItem[] {
  const { children, position, sole, images } = image;
  const child = children[position] as Token;
  const kind = kindOf(state, String(child.attrGet("src") ?? ""));
  const inline = child !== sole && !isSoleWithAttributes(children, position);
  const text = images ? takeAttributeText(children[position + 1]) : "";
  const attributes = readImageAttributes(text, kind, inline);
  child.meta = { ...(child.meta ?? {}), mdmarkImage: attributes };
  if (kind === "gif") {
    child.attrSet("data-gif", "");
  }
  if (inline && attributes.width !== undefined) {
    child.attrSet("style", `--mdmark-image-width: ${attributes.width}`);
    child.attrSet("data-mdmark-own", envOf(state).nonce);
  }
  return attributes.items;
}

/** 画像ごとに種類と、`images` がオンなら直後の `{…}` の属性を読み込んで `meta.mdmarkImage` に配置し、`{…}` を削除する。読み込めない属性は段落の前に 1 つの警告を配置する */
export function readImages(state: StateCore): void {
  const images = featureOn(state, "images");
  const warnings: Array<{ index: number; items: WarningItem[] }> = [];
  for (const [index, token] of state.tokens.entries()) {
    const children = token.children;
    if (token.type !== "inline" || !children) {
      continue;
    }
    const sole = soleImageOf(token);
    const items = children.flatMap((child, position) =>
      child.type === "image"
        ? readImage(state, { children, position, sole, images })
        : [],
    );
    // 属性を削除して空になった文字は、画像だけの段落を見分けられるよう取り除く
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
        message: `画像の読み込めない属性を当てずに描いています。記載できる属性は ${ATTRIBUTE_LIST} です。`,
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

/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返却する */
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

/** テーマごとの画像のフラグメントから出す配色を返却する */
export function onlyOf(src: string): "dark" | "light" | undefined {
  return ONLY_PATTERN.exec(src)?.[1] as "dark" | "light" | undefined;
}

/** 画像の title をキャプションにする（無ければ指定しない） */
const captionOf = (image: Token): { caption?: string } => {
  const title = String(image.attrGet("title") ?? "");
  return title ? { caption: title } : {};
};

/** 画像の図に渡す、属性の幅・配置・押すと拡大するか */
const figureAttributesOf = (
  attributes: ImageAttributes | undefined,
): {
  width?: string;
  align?: "left" | "center" | "right";
  lightbox: boolean;
} => ({
  ...(attributes?.width === undefined ? {} : { width: attributes.width }),
  ...(attributes?.align === undefined ? {} : { align: attributes.align }),
  lightbox: attributes?.lightbox ?? true,
});

/** 画像のトークンから部品『画像の図』の HTML を作る（`opener: false`） */
export function imageFigureHtml(
  image: Token,
  extra: { id?: string; label?: string } = {},
): string {
  const src = String(image.attrGet("src") ?? "");
  const attributes = imageAttributesOf(image);
  const only = onlyOf(src);
  return renderImageFigure({
    src,
    alt: altOf(image),
    ...captionOf(image),
    ...figureAttributesOf(attributes),
    ...(only === undefined ? {} : { only }),
    ...extra,
    opener: false,
    gif: attributes?.kind === "gif",
  });
}

/** 動画と音声に渡す、属性の幅・再生前の画像・再生のしかた */
const mediaAttributesOf = (
  attributes: ImageAttributes | undefined,
): {
  width?: string;
  poster?: string;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
} => ({
  ...(attributes?.width === undefined ? {} : { width: attributes.width }),
  ...(attributes?.poster === undefined ? {} : { poster: attributes.poster }),
  ...playbackOf(attributes),
});

/** 動画と音声の再生のしかた（属性が無ければどれも `false`） */
const playbackOf = (
  attributes: ImageAttributes | undefined,
): { autoplay: boolean; muted: boolean; loop: boolean } => ({
  autoplay: attributes?.autoplay ?? false,
  muted: attributes?.muted ?? false,
  loop: attributes?.loop ?? false,
});

/** 動画か音声の画像のトークンから部品『動画と音声』の HTML を作る */
function mediaHtml(image: Token, kind: "video" | "audio"): string {
  return renderMedia({
    kind,
    src: String(image.attrGet("src") ?? ""),
    alt: altOf(image),
    ...captionOf(image),
    ...mediaAttributesOf(imageAttributesOf(image)),
  });
}

/** 画像の種類が動画か音声なら、その種類を返却する */
function mediaKindOfToken(image: Token): "video" | "audio" | undefined {
  const kind = imageAttributesOf(image)?.kind;
  return kind === "video" || kind === "audio" ? kind : undefined;
}

/** 図にするかを決める機能のオン・オフ */
type FigureFeatures = { images: boolean; media: boolean };

/** 画像 1 つだけの段落を、動画・音声か画像の図にする（図にしなければ `undefined`） */
function soleFigure(
  state: StateCore,
  paragraph: { token: Token; inline: Token; features: FigureFeatures },
): Token | undefined {
  const { token, inline, features } = paragraph;
  const sole = soleImageOf(inline);
  if (!sole) {
    return undefined;
  }
  const soleMedia = mediaKindOfToken(sole);
  if (soleMedia) {
    return features.media
      ? ownBlock(state, mediaHtml(sole, soleMedia), token)
      : undefined;
  }
  return features.images
    ? ownBlock(state, imageFigureHtml(sole), token)
    : undefined;
}

/** 文の中の動画と音声は段落から除外し、段落の後ろに配置する図を返却する。テーマごとの画像には配色の class を付ける */
function splitInlineMedia(
  state: StateCore,
  paragraph: { token: Token; inline: Token; features: FigureFeatures },
): Token[] {
  const { token, inline, features } = paragraph;
  const after: Token[] = [];
  let linkDepth = 0;
  const children: Token[] = [];
  for (const child of inline.children ?? []) {
    linkDepth +=
      child.type === "link_open" ? 1 : child.type === "link_close" ? -1 : 0;
    const kind = child.type === "image" ? mediaKindOfToken(child) : undefined;
    if (kind && features.media && linkDepth === 0) {
      after.push(ownBlock(state, mediaHtml(child, kind), token));
      continue;
    }
    markOnlyImage(state, { child, images: features.images });
    children.push(child);
  }
  inline.children = children;
  return after;
}

/** テーマごとの画像に、出す配色の class を付ける */
function markOnlyImage(
  state: StateCore,
  image: { child: Token; images: boolean },
): void {
  const { child, images } = image;
  if (child.type !== "image" || !images) {
    return;
  }
  const only = onlyOf(String(child.attrGet("src") ?? ""));
  if (only) {
    child.attrJoin("class", `mdmark-only-${only}`);
    child.attrSet("data-mdmark-own", envOf(state).nonce);
  }
}

/** `images` がオンなら画像 1 つだけの段落を画像の図にし、`media` がオンなら動画と音声を再生バー付きの図にする（文の中のものは段落の後ろに配置する） */
export function buildImageFigures(state: StateCore): void {
  const features = {
    images: featureOn(state, "images"),
    media: featureOn(state, "media"),
  };
  if (!features.images && !features.media) {
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
    const paragraph = { token, inline, features };
    const figure = soleFigure(state, paragraph);
    if (figure) {
      out.push(figure);
    } else {
      const after = splitInlineMedia(state, paragraph);
      out.push(token, inline, ...(close ? [close] : []), ...after);
    }
    index += 2;
  }
  state.tokens = out;
}
