/** 箇所の行の上端の差がこの値以下なら、同じ行として 1 つのマーカーにまとめる（px） */
export declare const SAME_LINE_PX = 4;
/** 上下に並んだマーカーの間に空ける幅（px） */
export declare const MARKER_GAP_PX = 4;
/** 閉じた中の箇所へ移るとき、入れ子の閉じた要素を外側から開く処理を繰り返す上限 */
export declare const MAX_OPEN_DEPTH = 4;
/** 箇所の行の上端と高さ（px） */
type Line = {
    top: number;
    height: number;
};
/** 行の上端と高さの並びから、同じ行をまとめ、重ならないように下げたマーカーの縦の中ほどを返却する */
export declare function layoutMarkers(options: {
    /** 箇所ごとの行の上端と高さ（並びは問わない） */
    lines: Line[];
    /** マーカーの高さ（px） */
    markerSize: number;
}): Array<{
    center: number;
    indexes: number[];
}>;
/** 本文の列の右に余白の列を配置し、マーカーの行の縦の中ほどに余白のマーカーを配置して、押すとマーカーへ移る操作と再配置を付け、削除する関数を返却する */
export declare function attachMarginMarkers(options: {
    /** 本文の列（`div.mdmark-content`） */
    content: HTMLElement;
}): () => void;
export {};
