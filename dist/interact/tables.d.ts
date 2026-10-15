import { compareCells, type FilterValue, matchesFilter } from "../table-logic.ts";
export { compareCells, type FilterValue, matchesFilter };
/** 各 `mdmark-table` の `data-features`・`data-filter` を読み、見出しにボタンとドロワーを置いて、並べ替え・ピン止め・絞り込みを付ける。ボタン・ドロワー・受け取り・`ResizeObserver` を外す関数を返す */
export declare function attachTables(root: HTMLElement): () => void;
