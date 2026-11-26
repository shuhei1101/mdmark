import type { TablePinMode } from "../config.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import type { PartStates } from "../shared/part-states.interact.ts";
import { compareCells, type FilterValue, matchesFilter } from "./table.logic.ts";
export { compareCells, type FilterValue, matchesFilter };
/** 囲む要素の中の `hidden` を持たない表のメニューとテーブル設定のパネルを、表のメニューのボタンの下に右端をそろえて配置する。ボタンが無ければ何もしない */
export declare function placeOpenTablePanels(wrapper: HTMLElement): void;
/** 表のメニューのボタンを持つ囲む要素に、ボタンを見出し行の縦の中央と表の見えている右端に合わせる位置を CSS 変数（`--mdmark-table-menu-top`・`--mdmark-table-menu-end`）で入れる。ボタンや表が無ければ何もしない */
export declare function placeTableMenuButton(wrapper: HTMLElement): void;
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
/** 表の操作の状態（列を列のキーで指す） */
export type TableState = {
    /** 並べ替えた列と向き */
    sort: {
        key: string;
        direction: "ascending" | "descending";
    } | undefined;
    /** 適用している絞り込み */
    filters: Array<{
        key: string;
        value: Omit<FilterValue, "column">;
    }>;
    /** 隠している列 */
    hidden: string[];
    /** 今の列の順 */
    order: string[];
    /** つまみで変えた列の幅（px） */
    widths: Array<{
        key: string;
        width: number;
    }>;
    /** ピン止めのボタンが押された列 */
    pinned: string[];
};
/** `attachTables` を付けた表から、並べ替え・絞り込み・列の表示と順・列の幅・ピン止めを記録する */
export declare function captureTableState(wrapper: HTMLElement): TableState;
/** `attachTables` を付けた直後の表に、記録した状態のうち今の表にある列の状態を、利用者の操作と同じ処理で適用する */
export declare function restoreTableState(wrapper: HTMLElement, state: TableState): void;
