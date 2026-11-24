import { type MdmarkTableColumn, type MdmarkTableRow, type MdmarkTableValue } from "./mdmark-table.logic.ts";
/** セルの編集のイベントの値 */
export type MdmarkTableCellEditDetail = {
    /** 行のキー */
    key: string;
    /** 列のキー */
    column: string;
    /** 編集する前の値 */
    oldValue: MdmarkTableValue;
    /** 確定した入力欄の文字列 */
    value: string;
};
/** 行とセルの操作の通知先 */
export type TableRowHandlers = {
    /** 行の押下 */
    onRowClick: (key: string) => void;
    /** セルの編集の確定。`false` を返却するとセルを前の値に戻す */
    onCellEdit: (detail: MdmarkTableCellEditDetail) => boolean;
    /** 行の追加 */
    onRowAdd: () => void;
    /** 編集を確定したセルをもう一度描く */
    renderCell: (cell: HTMLTableCellElement, key: string, column: number) => void;
    /** 編集する前の値 */
    valueOf: (key: string, column: number) => MdmarkTableValue;
};
/** 行とセルの操作を付け、受け取りを解除して編集中のセルを取り消す関数を返却する */
export declare const attachTableRows: (wrapper: HTMLElement, handlers: TableRowHandlers) => (() => void);
/** セル 1 つの中身を `render(value, row)` の返却値に置き換える（例外のときは値を文字で出す） */
export declare const renderCellContent: (options: {
    cell: HTMLTableCellElement;
    column: MdmarkTableColumn;
    row: MdmarkTableRow;
    value: MdmarkTableValue;
}) => void;
/** `render` を持つ列のセルに `data-value` を付け、中身を `render(value, row)` の返却値に置き換える */
export declare const applyCellRenderers: (wrapper: HTMLElement, spec: {
    columns: MdmarkTableColumn[];
    rows: MdmarkTableRow[];
}) => void;
