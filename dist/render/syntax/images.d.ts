import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
/** 画像の `src` の拡張子で見分けた種類 */
export type MediaKind = "image" | "gif" | "video" | "audio";
/** 動画と音声の拡張子（小文字） */
export declare const MEDIA_EXTENSIONS: Readonly<Record<"video" | "audio", readonly string[]>>;
/** `{…}` に記載できる属性の名前。後ろの 4 つは動画・音声だけ */
export declare const IMAGE_ATTRIBUTE_NAMES: readonly ["width", "align", "nolightbox", "autoplay", "muted", "loop", "poster"];
/** `align=` に記載できる配置 */
declare const ALIGNS: readonly ["left", "center", "right"];
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
export declare function mediaKindOf(src: string): MediaKind;
/** `{` と `}` の中の文字を空白で区切って画像の属性を読み込む。読み込めない属性は当てずに `items` に入れる */
export declare function readImageAttributes(text: string, kind: MediaKind, inline: boolean): ImageAttributes;
/** 画像のトークンの属性。`readImages` が `meta.mdmarkImage` に配置する */
export declare function imageAttributesOf(token: Token): ImageAttributes | undefined;
/** 段落の行内の子のうち、前後の空白の `text` を除いて画像 1 つだけなら、その画像を返却する */
export declare function soleImageOf(inline: Token | undefined): Token | undefined;
/** 画像ごとに種類と、`images` がオンなら直後の `{…}` の属性を読み込んで `meta.mdmarkImage` に配置し、`{…}` を削除する。読み込めない属性は段落の前に 1 つの警告を配置する */
export declare function readImages(state: StateCore): void;
/** `index` のトークンを含む、入れ子の深さ 0 のブロックの開きの位置を返却する */
export declare function blockStartOf(tokens: Token[], index: number): number;
/** 画像のトークンの代わりの文字 */
export declare function altOf(image: Token): string;
/** テーマごとの画像のフラグメントから出す配色を返却する */
export declare function onlyOf(src: string): "dark" | "light" | undefined;
/** 画像のトークンから部品『画像の図』の HTML を作る（`opener: false`） */
export declare function imageFigureHtml(image: Token, extra?: {
    id?: string;
    label?: string;
}): string;
/** `images` がオンなら画像 1 つだけの段落を画像の図にし、`media` がオンなら動画と音声を再生バー付きの図にする（文の中のものは段落の後ろに配置する） */
export declare function buildImageFigures(state: StateCore): void;
export {};
