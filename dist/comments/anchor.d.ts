import type { MdmarkComment, MdmarkCommentDraft } from "./spec.ts";
/** 下書きの `prefix`・`suffix` に取る文字の上限 */
export declare const CONTEXT_CHARS = 32;
/** コメントを付けない場所: この中の選びにはボタンを出さない */
export declare const COMMENT_EXCLUDED = "input, textarea, pre, code, .mdmark-view-switch, .mdmark-view-board, .mdmark-filter-drawer, .mdmark-comment-mark, .mdmark-comment-popover, .mdmark-comment-add, .mdmark-comment-orphans";
/** 本文の文字と、文字の節ごとの始まりの位置 */
export type CommentText = {
    /** 文字の節をつないだ本文の文字 */
    text: string;
    /** 文字の節と、`text` の中の始まりの位置 */
    nodes: Array<{
        node: Text;
        start: number;
    }>;
};
/** `root` の中の、`TEXT_EXCLUDED` に入らない文字の節を順に集め、つないだ文字と節ごとの始まりの位置を返す */
export declare function commentText(root: HTMLElement): CommentText;
/** 範囲の文字と、範囲の前後の本文の文字から、コメントの下書きを作る */
export declare function draftFromRange(options: {
    /** 範囲の要素 */
    root: HTMLElement;
    /** 選んだ範囲 */
    range: Range;
    /** コメントの本文 */
    body: string;
}): MdmarkCommentDraft;
/** 本文の文字に付ける箇所と、そこに付くコメント */
export type CommentAnchor = {
    /** `text` の中の始まりの位置 */
    start: number;
    /** `text` の中の終わりの位置 */
    end: number;
    /** この箇所に付くコメント（保存の順） */
    comments: MdmarkComment[];
};
/** 本文の文字の中で、コメントごとに箇所を探し、同じ箇所のコメントをまとめ、見つからないものを分ける */
export declare function locateComments(options: {
    /** 本文の文字 */
    text: string;
    /** 読んだコメント */
    comments: MdmarkComment[];
}): {
    anchors: CommentAnchor[];
    orphans: MdmarkComment[];
};
