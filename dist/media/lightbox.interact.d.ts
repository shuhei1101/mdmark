/** 拡大のボタンで包む画像 */
export declare const LIGHTBOX_IMAGE_SELECTOR = "figure.mdmark-image img:not([data-nolightbox])";
/** `root` の中の拡大のボタンを文書の順に並べ、今の配色で隠れている図の中のものを除いて返却する */
export declare function collectLightboxImages(root: HTMLElement): HTMLButtonElement[];
/** 画像を拡大のボタンで包み、押すとライトボックスで開いて切り替え・拡大・縮小・移動を付ける。削除する関数を返却する */
export declare function attachLightbox(root: HTMLElement): () => void;
