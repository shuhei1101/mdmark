import type { TooltipPlacement } from "../config.ts";
/** mount が描いた脚注の番号にツールチップを開閉する操作を、番号と末尾の一覧の項目に行き来する操作を付け、削除する関数を返却する */
export declare function attachFootnotes(options: {
    /** 描いた文書の要素 */
    root: HTMLElement;
    /** ツールチップを先に出す側 */
    placement: TooltipPlacement;
}): () => void;
