/** 外部ライブラリか拡張を読み込めないマーカーの場所、差分の取り出し元がリビジョンの一覧か本文を返却できない場所、またはまとめていないアイコンを読み込めない文書の先頭に配置する、通知ブロックの HTML を返却する */
export declare function renderNotice(options: {
    /** 読み込めなかったマーカーの名前。`diff-content` では取り出せなかったリビジョンの説明（複数なら `「…」と「…」` の中身）。`diff-blocks`・`icons` では使用しない */
    name: string;
    /** 図のマーカーか（既定 `true`）。`diff-revisions`・`diff-content`・`diff-blocks` では使用しない */
    figure?: boolean;
    /** 読み込めなかったもの（既定 `library`） */
    source?: "library" | "extension" | "part" | "diff-revisions" | "diff-content" | "diff-blocks" | "icons";
}): string;
