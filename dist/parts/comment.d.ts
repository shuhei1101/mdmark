/** 入力欄に出す通知し。`empty` は本文が空のまま保存したとき、`failed` は保存できなかったとき。`updateFailed`・`removeFailed` は吹き出しで修正・削除できなかったとき、`removeConfirm` は削除の確認の文 */
export declare const COMMENT_MESSAGES: {
    empty: string;
    failed: string;
    updateFailed: string;
    removeFailed: string;
    removeConfirm: string;
};
/** コメントのマーカーを指すスクリーンリーダーの説明の `id` */
export declare const COMMENT_HINT_ID = "mdmark-comment-hint";
/** 余白のマーカーのスクリーンリーダー向けの名前に添える、閉じた中の種類ごとの文言 */
export declare const CLOSED_LABELS: {
    readonly section: "閉じたセクションの中";
    readonly tab: "選ばれていないタブの中";
    readonly row: "閉じた行の詳細の中";
};
/** 箇所を包む、いちばん外側の閉じた要素の種類 */
export type CommentClosedKind = keyof typeof CLOSED_LABELS;
/** 入力欄の状態 */
export type CommentFormState = "idle" | "saving" | "empty" | "failed";
/** 削除の確認の状態 */
export type CommentRemoveState = "idle" | "removing" | "failed";
/** 「コメント」のボタンの HTML を返却する */
export declare function renderCommentButton(): string;
/** コメントを記載して保存する入力欄の HTML を返却する */
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
/** コメントが付いた本文の文字を包むマーカーの HTML を返却する */
export declare function renderCommentMark(props: {
    /** 包む本文の文字 */
    text: string;
    /** 吹き出しを開いているか（既定 `false`） */
    expanded?: boolean;
    /** `focusComment` で移ったマーカーか（既定 `false`） */
    focused?: boolean;
}): string;
/** 吹き出しのコメント 1 件の `li` の HTML を、本文の表示・入力欄・削除の確認のどれかで返却する */
export declare function renderCommentItem(props: {
    /** コメントの本文 */
    body: string;
    /** コメントの `id` */
    id?: string;
    /** 「編集」を配置するか */
    canEdit?: boolean;
    /** 「削除」を配置するか */
    canRemove?: boolean;
    /** 入力欄にするときの本文の欄の文字・状態・通知を指す `id` */
    edit?: {
        draft: string;
        state: CommentFormState;
        fieldId: string;
    };
    /** 削除の確認を出すときの状態 */
    confirm?: {
        state: CommentRemoveState;
    };
}): string;
/** マーカーの下に開く、その箇所に付いたコメントの本文を並べた吹き出しの HTML を返却する */
export declare function renderCommentBubble(props: {
    /** マーカーの文字 */
    quote: string;
    /** 付いたコメントの本文（保存した順） */
    bodies: string[];
    /** コメントの `id`（`bodies` と同じ順） */
    ids?: string[];
    /** 「編集」を配置するか */
    canEdit?: boolean;
    /** 「削除」を配置するか */
    canRemove?: boolean;
    /** 入力欄にするコメントの位置 */
    editIndex?: number;
    /** 入力欄の本文の欄の文字（既定はそのコメントの本文） */
    draft?: string;
    /** 入力欄の状態（既定 `idle`） */
    editState?: CommentFormState;
    /** 削除の確認を出すコメントの位置 */
    confirmIndex?: number;
    /** 削除の確認の状態（既定 `idle`） */
    removeState?: CommentRemoveState;
    /** 本文の欄の通知を指す `id` の頭（既定 `mdmark-comment-edit`） */
    id?: string;
}): string;
/** 箇所が見つからないコメントを、選んだ文字と本文の組で並べた一覧の HTML を返却する。空なら空の文字 */
export declare function renderCommentOrphans(props: {
    /** 箇所が見つからないコメント */
    comments: Array<{
        quote: string;
        body: string;
    }>;
    /** タイトルの `id` */
    id: string;
}): string;
/** 本文の右の余白の列に、コメントの箇所の行の高さで配置するボタンの HTML を返却する */
export declare function renderCommentMarker(props: {
    /** 行の最初の箇所の選んだ文字 */
    quote: string;
    /** 同じ行の箇所の数（既定 1） */
    count?: number;
    /** 箇所のうち吹き出しを開いているものがあるか（既定 `false`） */
    current?: boolean;
    /** 箇所を包む、いちばん外側の閉じた要素の種類 */
    closed?: CommentClosedKind;
}): string;
