/** `save` に渡す、まだ `id` の無いコメント */
export type MdmarkCommentDraft = {
    /** 選んだ文字（前後の空白を落とす） */
    quote: string;
    /** 選んだ文字の直前の本文の文字 */
    prefix: string;
    /** 選んだ文字の直後の本文の文字 */
    suffix: string;
    /** コメントの本文（前後の空白を落とす） */
    body: string;
};
/** 保存したコメント。`MdmarkCommentDraft` に `id` を足したもの */
export type MdmarkComment = MdmarkCommentDraft & {
    /** 保存先が付けた ID */
    id: string;
};
/** 使う側が書く、コメントの読み込みと保存 */
export type MdmarkCommentStore = {
    /** 対象のコメントを返す */
    load: (target: {
        docId: string;
    }) => Promise<MdmarkComment[]>;
    /** 下書きを保存し、`id` を付けたコメントを返す */
    save: (target: {
        docId: string;
        comment: MdmarkCommentDraft;
    }) => Promise<MdmarkComment>;
};
/** `mountComments` の Promise の値 */
export type MdmarkCommentsHandle = {
    /** 印を外して文字を元の並びに戻し、ボタン・入力欄・吹き出し・一覧と `document` の受け取りを外す。2 回目以降は何もしない */
    destroy: () => void;
};
/** `load`・`save` が返した値が `MdmarkComment` の形かを返す */
export declare function isComment(value: unknown): value is MdmarkComment;
/** `mountComments`（と `mount` の `commentStore`）の引数を確かめ、合わなければ誤った引数の名前を含む `TypeError` を投げる */
export declare function checkCommentOptions(el: unknown, opts: unknown): asserts opts is {
    store: MdmarkCommentStore;
    docId: string;
};
