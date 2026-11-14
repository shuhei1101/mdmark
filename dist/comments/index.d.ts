import { type MdmarkCommentStore } from "./spec.ts";
/** `attachComments` の Promise の値 */
export type CommentsController = {
    /** マーカーを削除して文字を元に戻し、配置した要素と受け取りを解除する。2 回目以降は何もしない */
    detach: () => void;
    /** `load` をもう一度呼んでマーカーをもう一度付ける */
    reload: () => Promise<void>;
    /** その `id` のコメントのマーカーへ移って強調する */
    focus: (id: string) => void;
};
/** コメントの部品のモジュール（`dist/comments.js`）が export する関数 */
export type CommentsPartModule = {
    /** `mountComments` と `mount` が呼ぶ */
    attachComments: (options: {
        root: HTMLElement;
        store: MdmarkCommentStore;
        docId: string;
        reveal?: (element: HTMLElement) => void;
        margin?: boolean;
    }) => Promise<CommentsController>;
};
/** 枠を箇所の下に配置し、下に収まらなければ上に配置し、左右は画面の中に収める */
export declare function placePopover(options: {
    /** 配置する枠 */
    element: HTMLElement;
    /** 箇所の矩形 */
    rect: DOMRect;
}): void;
/** 読み込んだコメントにマーカーを付け、文字の選び・ボタン・入力欄・吹き出しの操作を付け、削除する関数を返却する */
export declare function attachComments(options: {
    /** 範囲の要素 */
    root: HTMLElement;
    /** 読み込みと保存の関数 */
    store: MdmarkCommentStore;
    /** 対象の ID */
    docId: string;
    /** マーカーを囲む閉じたセクションと行の詳細を開く */
    reveal?: (element: HTMLElement) => void;
    /** 余白のマーカーを配置するか（既定 `false`） */
    margin?: boolean;
}): Promise<CommentsController>;
