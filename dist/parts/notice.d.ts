/** 外部ライブラリか拡張を読めない印の場所、または差分の取り出し元がリビジョンの一覧か本文を返せない場所に置く、知らせの枠の HTML を返す */
export declare function renderNotice(options: {
    /** 読めなかった印の名前。`diff-content` では取り出せなかったリビジョンの説明（複数なら `「…」と「…」` の中身）。`diff-blocks` では使わない */
    name: string;
    /** 図の印か（既定 `true`）。`diff-revisions`・`diff-content`・`diff-blocks` では使わない */
    figure?: boolean;
    /** 読めなかったもの（既定 `library`） */
    source?: "library" | "extension" | "part" | "diff-revisions" | "diff-content" | "diff-blocks";
}): string;
