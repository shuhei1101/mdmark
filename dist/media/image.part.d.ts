/** `img` の HTML を、押すと拡大するボタンで包む。`icon` が `false` のとき（GIF）は右上のアイコンを配置しない */
export declare function renderImageOpener(options: {
    /** 画像の代わりの文字 */
    alt: string;
    /** 包む `img` の HTML */
    img: string;
    /** 右上に拡大のアイコンを配置するか（既定 `true`） */
    icon?: boolean;
}): string;
/** 画像の図の HTML を返却する */
export declare function renderImageFigure(options: {
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
}): string;
