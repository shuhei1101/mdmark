import type { MdmarkCommentStore } from "./spec.ts";
/** 開いた吹き出しのコメントごとの「編集」「削除」に、入力欄・削除の確認と `store.update`・`store.remove` の呼び出しを付け、開いている入力欄か削除の確認を閉じる関数を返却する */
export declare function attachCommentActions(options: {
    /** `renderCommentBubble` で開いた吹き出し */
    bubble: HTMLElement;
    /** 読み込みと保存の関数 */
    store: MdmarkCommentStore;
    /** 対象の ID */
    docId: string;
    /** 付けたコメントがまだ削除されていないか */
    isActive: () => boolean;
    /** 修正できたときに通知する */
    onUpdated: (id: string, body: string) => void;
    /** 削除できたときに通知し、同じマーカーにコメントが残るかを受け取る */
    onRemoved: (id: string) => boolean;
}): {
    cancel: () => boolean;
};
