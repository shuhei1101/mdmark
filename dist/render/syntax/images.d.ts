import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
/** 画像の `src` の拡張子で見分けた種類 */
export type MediaKind = "image" | "gif" | "video" | "audio";
/** 動画と音声の拡張子（小文字） */
export declare const MEDIA_EXTENSIONS: Readonly<Record<"video" | "audio", readonly string[]>>;
/** `{…}` に書ける属性の名前。後ろの 4 つは動画・音声だけ */
export declare const IMAGE_ATTRIBUTE_NAMES: readonly ["width", "align", "nolightbox", "autoplay", "muted", "loop", "poster"];
/** `align=` に書ける配置 */
declare const ALIGNS: readonly ["left", "center", "right"];
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
export declare function mediaKindOf(src: string): MediaKind;
/** `{` と `}` の中の文字を空白で区切って画像の属性を読む。読めない属性は当てずに `items` に入れる */
export declare function readImageAttributes(text: string, kind: MediaKind, inline: boolean): ImageAttributes;
/** 画像のトークンの属性。`readImages` が `meta.mdmarkImage` に置く */
export declare function imageAttributesOf(token: Token): ImageAttributes | undefined;
/** 段落の行内の子のうち、前後の空白の `text` を除いて画像 1 つだけなら、その画像を返す */
export declare function soleImageOf(inline: Token | undefined): Token | undefined;
/** 画像ごとに種類と、`images` がオンなら直後の `{…}` の属性を読んで `meta.mdmarkImage` に置き、`{…}` を外す。読めない属性は段落の前に 1 つの警告を置く */
export declare function readImages(state: StateCore): void;
/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返す */
export declare function blockStartOf(tokens: Token[], index: number): number;
/** 画像のトークンの代わりの文字 */
export declare function altOf(image: Token): string;
/** テーマごとの画像のフラグメントから出す配色を返す */
export declare function onlyOf(src: string): "dark" | "light" | undefined;
/** 画像のトークンから部品『画像の図』の HTML を作る（`opener: false`） */
export declare function imageFigureHtml(image: Token, extra?: {
    id?: string;
    label?: string;
}): string;
/** `images` がオンなら画像 1 つだけの段落を画像の図にし、`media` がオンなら動画と音声を再生バー付きの図にする（文の中のものは段落の後ろに置く） */
export declare function buildImageFigures(state: StateCore): void;
export {};
