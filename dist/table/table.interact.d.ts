import type { TablePinMode } from "../config.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import type { PartStates } from "../shared/part-states.interact.ts";
import { compareCells, type FilterValue, matchesFilter } from "./table.logic.ts";
export { compareCells, type FilterValue, matchesFilter };
/** 各 `mdmark-table` の `data-features`・`data-filter`・`data-pin` を読み込み、見出しにボタンとドロワーを配置して、並べ替え・ピン止め・絞り込みを付ける。`onColumnsChange` を指定したときは列の表示を切り替えるたびに通知する。ボタン・ドロワー・受け取り・`ResizeObserver` を削除する関数を返却する */
export declare function attachTables(root: HTMLElement, options?: {
    /** 列の表示を切り替えたときに通知する */
    onColumnsChange?: ((event: MdmarkColumnsChange) => void) | undefined;
    /** ピン止めの動き（既定 `each`） */
    pinMode?: TablePinMode | undefined;
    /** `data-pin` が無いときに描いた直後に既定の列を留めるか（既定 `false`） */
    pinDefault?: boolean | undefined;
    /** 長文の列の最小の幅（em。既定 `DEFAULT_LONG_COLUMN_MIN_EM`） */
    longColumnMin?: number | undefined;
    /** 階層の表に指定する部品の開閉の記録（省くと記録しない） */
    partStates?: PartStates | undefined;
    /** URL の `#ID` を追うか。`false` なら `#ID` の指す行へ移らない（既定 `true`） */
    followHash?: boolean | undefined;
}): () => void;
