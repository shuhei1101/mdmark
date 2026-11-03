/** 入力欄に出す知らせ。`empty` は本文が空のまま保存したとき、`failed` は保存できなかったとき */
export declare const COMMENT_MESSAGES: {
    empty: string;
    failed: string;
};
/** コメントの印を指す読み上げの説明の `id` */
export declare const COMMENT_HINT_ID = "mdmark-comment-hint";
/** 入力欄の状態 */
export type CommentFormState = "idle" | "saving" | "empty" | "failed";
/** 「コメント」のボタンの HTML を返す */
export declare function renderCommentButton(): string;
/** コメントを書いて保存する入力欄の HTML を返す */
export declare function renderCommentForm(props: {
    /** 選んだ文字 */
    quote: string;
    /** 本文の欄に入っている文字 */
    body?: string;
    /** 入力欄の状態（既定 `idle`） */
    state?: CommentFormState;
    /** 入力欄の要素の `id` の頭 */
    id: string;
}): string;
/** コメントが付いた本文の文字を包む印の HTML を返す */
export declare function renderCommentMark(props: {
    /** 包む本文の文字 */
    text: string;
    /** 吹き出しを開いているか（既定 `false`） */
    expanded?: boolean;
}): string;
/** 印の下に開く、その箇所に付いたコメントの本文を並べた吹き出しの HTML を返す */
export declare function renderCommentBubble(props: {
    /** 印の文字 */
    quote: string;
    /** 付いたコメントの本文（保存した順） */
    bodies: string[];
}): string;
/** 箇所が見つからないコメントを、選んだ文字と本文の組で並べた一覧の HTML を返す。空なら空の文字 */
export declare function renderCommentOrphans(props: {
    /** 箇所が見つからないコメント */
    comments: Array<{
        quote: string;
        body: string;
    }>;
    /** 題の `id` */
    id: string;
}): string;
