/** 差分のミニマップか余白の列と横の範囲が重なるとき、その部品の左端からボタンの右端までに空ける幅（px） */
export declare const BACK_TO_TOP_AVOID_GAP_PX = 8;
/** 描く先の要素の子の末尾に先頭へ戻るボタンを置き、スクロールの量で出し分け、スクロールする場所の右下でミニマップと余白の列を避けて置き、押すと先頭へ戻す。返す関数でボタンと受け取りを外す */
export declare function attachBackToTop(options: {
    /** 描く先の要素 */
    el: HTMLElement;
    /** 押した後にフォーカスを移す本文の列 */
    content: HTMLElement;
}): () => void;
