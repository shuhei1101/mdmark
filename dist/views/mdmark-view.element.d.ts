import type { FilterKind } from "../table/table.logic.ts";
import { type ViewIconName } from "./spec.ts";
/** ビューのカスタム要素の項目 */
export type MdmarkViewItem = {
    /** 項目のキー。`mdmark-item-click` の `key` にする */
    key: string;
    /** 列名をキーにした値の組 */
    values: Record<string, string>;
};
/** 項目の押下のイベントの値 */
export type MdmarkViewItemClickDetail = {
    /** 押した項目の `items[].key` */
    key: string;
};
/** カスタム要素の名前 */
export declare const VIEW_ELEMENT_NAME = "mdmark-view";
/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
declare const BaseElement: typeof HTMLElement;
/** 列名と項目を代入すると、次のマイクロタスクでビューか通知ブロックを描くカスタム要素 */
export declare class MdmarkViewElement extends BaseElement {
    #private;
    /** 列名 */
    get columns(): string[] | undefined;
    set columns(value: string[] | undefined);
    /** 項目 */
    get items(): MdmarkViewItem[] | undefined;
    set items(value: MdmarkViewItem[] | undefined);
    /** ボードで列に分ける列名 */
    get group(): string | undefined;
    set group(value: string | undefined);
    /** 描いた直後に出すビュー */
    get default(): "board" | "table" | undefined;
    set default(value: "board" | "table" | undefined);
    /** 絞り込みを付ける列と種類 */
    get filter(): Record<string, FilterKind> | undefined;
    set filter(value: Record<string, FilterKind> | undefined);
    /** ボードの列の見出しのアイコンの対応 */
    get icons(): Record<string, ViewIconName> | undefined;
    set icons(value: Record<string, ViewIconName> | undefined);
    /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、描画を予約する */
    connectedCallback(): void;
    /** `document` の受け取りを解除する（プロパティは残し、ページへ戻すと描き直す） */
    disconnectedCallback(): void;
    /** 描画を次のマイクロタスクに 1 回だけ予約する */
    scheduleRender(): void;
    /** 指定を確認し、誤りがあれば通知ブロックを、無ければビューの部品のモジュールの `drawView` で描く */
    renderNow(): Promise<void>;
}
/** 登録先に `mdmark-view` が登録されていなければ `MdmarkViewElement` を登録する */
export declare const defineViewElement: (registry: CustomElementRegistry) => void;
export {};
