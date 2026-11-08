import { type MdmarkCommentStore } from "./spec.ts";
/** `attachComments` の Promise の値 */
export type CommentsController = {
    /** 印を外して文字を元に戻し、置いた要素と受け取りを外す。2 回目以降は何もしない */
    detach: () => void;
    /** `load` を呼び直して印を付け直す */
    reload: () => Promise<void>;
    /** その `id` のコメントの印へ移って強調する */
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
/** 枠を箇所の下に置き、下に収まらなければ上に置き、左右は画面の中に収める */
export declare function placePopover(options: {
    /** 置く枠 */
    element: HTMLElement;
    /** 箇所の矩形 */
    rect: DOMRect;
}): void;
/** 読んだコメントに印を付け、文字の選び・ボタン・入力欄・吹き出しの操作を付け、外す関数を返す */
export declare function attachComments(options: {
    /** 範囲の要素 */
    root: HTMLElement;
    /** 読み書きの関数 */
    store: MdmarkCommentStore;
    /** 対象の ID */
    docId: string;
    /** 印を囲む閉じた節と行の詳細を開く */
    reveal?: (element: HTMLElement) => void;
    /** 余白のマーカーを置くか（既定 `false`） */
    margin?: boolean;
}): Promise<CommentsController>;
