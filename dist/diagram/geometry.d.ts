import type { MdmarkDiagramWire } from "./definition.ts";
/** line jump の弧の半径（px） */
export declare const JUMP_RADIUS = 6;
/** 同じ向きで重なる線をずらす幅（px） */
export declare const OVERLAP_OFFSET = 4;
/** 拡大・縮小と移動の量: 1 回の倍率・上限・1 回の移動量（px） */
export declare const ZOOM: {
    step: number;
    max: number;
    pan: number;
};
/** リサイズハンドルの量: キー 1 回で変える高さと、表示する枠の高さの下限（px） */
export declare const RESIZE: {
    step: number;
    min: number;
};
/** 折れ線の点 */
type Point = [number, number];
/** 点をつないだ svg のパス（飛び越えもずらしもしない） */
export declare function polylinePath(points: Point[]): string;
/** 図の全体が表示する枠に収まる倍率。100% を超えない */
export declare function fitScale(content: {
    width: number;
    height: number;
}, box: {
    width: number;
    height: number;
}): number;
/** 全ての線の横の区間が、ほかの線の縦の区間と交わる点に半円の弧を入れた svg のパスを、線の `id` から参照できる構造で返却する。同じ向きで重なる区間はずらす */
export declare function jumpPaths(wires: MdmarkDiagramWire[]): Map<string, string>;
/** 縦の軸の刻みを切る: データの最小と最大を含む範囲を、1・2・5×10 のべき乗の刻みで切る。最小が 0 以上なら下端を 0 にする */
export declare function niceTicks(values: number[]): {
    min: number;
    max: number;
    step: number;
};
/** 目盛りごとに、0 以上の値は 0 から上へ、負の値は 0 から下へ、系列の順に積み上げた下端と上端を返却する */
export declare function stackSeries(series: number[][]): Array<Array<{
    from: number;
    to: number;
}>>;
/** 高さを `RESIZE.min` 以上に収め、整数に丸める（上限は持たない） */
export declare function clampDiagramHeight(height: number): number;
export {};
