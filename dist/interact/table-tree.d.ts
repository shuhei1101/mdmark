import type { TooltipPlacement } from "../config.ts";
/** 開閉で隠した行に付ける属性（印刷の前後で開閉を戻すのに使用する） */
export declare const TREE_FOLDED_ATTRIBUTE = "data-tree-folded";
/** 階層の表の操作の取っ手。`attachTable` が絞り込みのたびに `refresh` を呼ぶ */
export type TableTreeHandle = {
    /** キーの列の絞り込みの単語と、ほかの絞り込みに合う行かを受け、行の表示と該当した単語のマーカーをもう一度決める。表示した補った行でない行の数を返却する */
    refresh: (options: {
        word: string;
        matches: (row: HTMLTableRowElement) => boolean;
    }) => number;
    /** 受け取りとボタンを削除する */
    detach: () => void;
};
/** `data-tree` の表の子を持つ行に開閉のボタン、各行にパスのコピーのボタンと全体のパスのツールチップを配置し、開閉・行の選択・見本との連動と見本の表示の切り替えを付ける */
export declare function attachTableTree(options: {
    /** `div.mdmark-table[data-tree]` */
    wrapper: HTMLElement;
    /** ツールチップを出す場所 */
    placement: TooltipPlacement;
}): TableTreeHandle;
