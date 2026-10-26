import type { TooltipPlacement } from "../config.ts";
/** mount が描いた用語の下線に、ツールチップを開閉する操作を付け、外す関数を返す */
export declare function attachTermTips(options: {
    /** 描いた文書の要素 */
    root: HTMLElement;
    /** ツールチップを先に出す側 */
    placement: TooltipPlacement;
}): () => void;
