/** ライトボックスの `dialog` の HTML を返却する */
export declare function renderLightbox(options: {
    /** 画像の URL */
    src: string;
    /** 画像の代わりの文字 */
    alt: string;
    /** キャプション */
    caption?: string;
    /** 何枚目か（1 から） */
    index: number;
    /** 切り替えの並びの枚数 */
    total: number;
    /** 今の倍率（既定は `fit`） */
    zoom?: number;
    /** 全体が収まる倍率（既定 1） */
    fit?: number;
}): string;
