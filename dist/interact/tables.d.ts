import type { MdmarkColumnsChange } from "../mount.ts";
import { compareCells, type FilterValue, matchesFilter } from "../table-logic.ts";
export { compareCells, type FilterValue, matchesFilter };
/** 各 `mdmark-table` の `data-features`・`data-filter`・`data-pin` を読み、見出しにボタンとドロワーを置いて、並べ替え・ピン止め・絞り込みを付ける。`onColumnsChange` を渡したときは列の表示を切り替えるたびに知らせる。ボタン・ドロワー・受け取り・`ResizeObserver` を外す関数を返す */
export declare function attachTables(root: HTMLElement, options?: {
    /** 列の表示を切り替えたときに知らせる */
    onColumnsChange?: ((event: MdmarkColumnsChange) => void) | undefined;
}): () => void;
