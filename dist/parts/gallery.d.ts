/** ギャラリーの HTML を返す */
export declare function renderGallery(options: {
    /** 列の数（既定 2） */
    cols?: number;
    /** 画像の図の並びの HTML（`SLOT_MARKER` を渡せる） */
    body: string;
}): string;
