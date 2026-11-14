/** 列の幅のつまみにフォーカスして ←・→ キーを 1 回押したときに変える幅（px） */
export declare const COLUMN_RESIZE_STEP_PX = 16;
/** タッチの 2 回のタップをダブルタップとみなす、前のタップを離してから次のタップを離すまでの上限（ms） */
export declare const DOUBLE_TAP_MS = 300;
/** タッチの `pointerdown` から `pointerup` までの移動がこの幅（px）以内なら、ドラッグでなくタップとして数える */
export declare const TAP_MOVE_TOLERANCE_PX = 8;
/** 列の幅のつまみに操作を付ける引数 */
export type ColumnResizeOptions = {
    /** 列ごとの最下段の見出しのセル */
    headCells: HTMLTableCellElement[];
    /** 列の幅の上限（px）を返却する */
    maxWidth: (column: number) => number;
    /** 幅を変えた後と戻した後に呼ぶ */
    onResize: (column: number) => void;
    /** 見出しのセルに幅を入れた後、外側の幅を測る前に呼ぶ（表の幅を列の幅の合計に合わせる） */
    onWidthWritten?: () => void;
};
/** 表の最下段の見出しのつまみに、ドラッグ・←→ キーで列の幅を変え、ダブルクリック・ダブルタップ・Enter で戻す操作を付ける。受け取りを削除し、幅の指定を全て戻す関数を返却する */
export declare const attachColumnResize: (table: HTMLTableElement, options: ColumnResizeOptions) => (() => void);
