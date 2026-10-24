/** 帯に置く印: 種類と、送り先の全体に対する 0〜1 の割合の位置と長さ */
export type DiffMinimapMark = {
    kind: "del" | "add";
    top: number;
    height: number;
};
/** 部品設計『ミニマップ』: 削除した行と追加した行の位置の印と、今見えている範囲の枠を持つ縦の帯の HTML を返す */
export declare function renderDiffMinimap(options: {
    /** 印。続いた同じ種類の行は 1 つにまとめて渡す */
    marks: DiffMinimapMark[];
    /** 今見えている範囲 */
    view: {
        top: number;
        height: number;
    };
}): string;
