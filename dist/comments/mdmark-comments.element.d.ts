import { type MdmarkComment } from "./spec.ts";
/** コメントの編集のイベントの値 */
export type MdmarkCommentEditDetail = {
    /** 編集したコメントの `id` */
    id: string;
    /** 確定した本文 */
    body: string;
};
/** コメントの削除のイベントの値 */
export type MdmarkCommentRemoveDetail = {
    /** 削除するコメントの `id` */
    id: string;
};
/** カスタム要素の名前 */
export declare const COMMENTS_ELEMENT_NAME = "mdmark-comments";
/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
declare const BaseElement: typeof HTMLElement;
/** 付いたコメントを代入すると、子の本文にコメントの操作を付け直し、保存・編集・削除をイベントで送信するカスタム要素 */
export declare class MdmarkCommentsElement extends BaseElement {
    #private;
    /** 付いたコメント */
    get comments(): MdmarkComment[] | undefined;
    set comments(value: MdmarkComment[] | undefined);
    /** 吹き出しに「編集」を出すか */
    get editable(): boolean;
    set editable(value: boolean);
    /** 吹き出しに「削除」を出すか */
    get removable(): boolean;
    set removable(value: boolean);
    /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、付け直しを予約する */
    connectedCallback(): void;
    /** マーカーを削除して文字を元に戻し、`document` の受け取りを解除する */
    disconnectedCallback(): void;
    /** 付け直しを次のマイクロタスクに 1 回だけ予約する */
    scheduleAttach(): void;
    /** 指定を確認し、誤りがあれば先頭に通知ブロックを配置し、無ければイベントを送信する読み込みと保存の関数で `attachComments` を呼ぶ */
    attachNow(): Promise<void>;
}
/** 登録先に `mdmark-comments` が登録されていなければ `MdmarkCommentsElement` を登録する */
export declare const defineCommentsElement: (registry: CustomElementRegistry) => void;
export {};
