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
/** 全ての線の横の区間が、ほかの線の縦の区間と交わる点に半円の弧を入れた svg のパスを、線の `id` から引ける形で返す。同じ向きで重なる区間はずらす */
export declare function jumpPaths(wires: MdmarkDiagramWire[]): Map<string, string>;
export {};
