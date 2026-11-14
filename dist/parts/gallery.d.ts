/** ギャラリーの HTML を返却する */
export declare function renderGallery(options: {
    /** 列の数（既定 2） */
    cols?: number;
    /** 画像の図の並びの HTML（`SLOT_MARKER` を指定できる） */
    body: string;
}): string;
