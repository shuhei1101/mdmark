import { type MdmarkTableCellEditDetail } from "./mdmark-table.interact.ts";
import { type MdmarkTableColumn, type MdmarkTableFeatures, type MdmarkTableRow } from "./mdmark-table.logic.ts";
export type { MdmarkTableCellEditDetail };
/** 行の押下のイベントの値 */
export type MdmarkTableRowClickDetail = {
    /** 押した行の行のキー */
    key: string;
};
/** カスタム要素の名前 */
export declare const TABLE_ELEMENT_NAME = "mdmark-table";
/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
declare const BaseElement: typeof HTMLElement;
/** 列の定義と行のデータを代入すると、次のマイクロタスクで表か通知ブロックを描くカスタム要素 */
export declare class MdmarkTableElement extends BaseElement {
    #private;
    /** 列の定義 */
    get columns(): MdmarkTableColumn[] | undefined;
    set columns(value: MdmarkTableColumn[] | undefined);
    /** 行のデータ */
    get rows(): MdmarkTableRow[] | undefined;
    set rows(value: MdmarkTableRow[] | undefined);
    /** 表の機能 */
    get features(): MdmarkTableFeatures | undefined;
    set features(value: MdmarkTableFeatures | undefined);
    /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、描画を予約する */
    connectedCallback(): void;
    /** 操作を解除する（要素の中身とプロパティは残す） */
    disconnectedCallback(): void;
    /** 描画を次のマイクロタスクに 1 回だけ予約する */
    scheduleRender(): void;
    /** 指定を確認して、表か通知ブロックを描く */
    renderNow(): void;
}
/** 登録先に `mdmark-table` が登録されていなければ `MdmarkTableElement` を登録する */
export declare const defineTableElement: (registry: CustomElementRegistry) => void;
