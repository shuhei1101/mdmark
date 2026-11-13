/** 帯に配置するマーカー: 種類と、スクロール先の全体に対する 0〜1 の割合の位置と長さ */
export type DiffMinimapMark = {
    kind: "del" | "add";
    top: number;
    height: number;
};
/** 部品設計『ミニマップ』: 削除した行と追加した行の位置のマーカーと、今見えている範囲の枠を持つ縦の帯の HTML を返却する */
export declare function renderDiffMinimap(options: {
    /** マーカー。続いた同じ種類の行は 1 つにまとめて指定する */
    marks: DiffMinimapMark[];
    /** 今見えている範囲 */
    view: {
        top: number;
        height: number;
    };
}): string;
