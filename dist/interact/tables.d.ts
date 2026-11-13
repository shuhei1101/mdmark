import type { TablePinMode } from "../config.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import { compareCells, type FilterValue, matchesFilter } from "../table-logic.ts";
export { compareCells, type FilterValue, matchesFilter };
/** 各 `mdmark-table` の `data-features`・`data-filter`・`data-pin` を読み込み、見出しにボタンとドロワーを配置して、並べ替え・ピン止め・絞り込みを付ける。`onColumnsChange` を指定したときは列の表示を切り替えるたびに通知する。ボタン・ドロワー・受け取り・`ResizeObserver` を削除する関数を返却する */
export declare function attachTables(root: HTMLElement, options?: {
    /** 列の表示を切り替えたときに通知する */
    onColumnsChange?: ((event: MdmarkColumnsChange) => void) | undefined;
    /** ピン止めの動き（既定 `each`） */
    pinMode?: TablePinMode | undefined;
    /** 長文の列の最小の幅（em。既定 `DEFAULT_LONG_COLUMN_MIN_EM`） */
    longColumnMin?: number | undefined;
}): () => void;
