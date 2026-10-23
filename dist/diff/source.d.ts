/** 文書の変更の 1 回分 */
export type DiffRevision = {
    /** リビジョンの識別子。空でない文字列で、一覧の中で重ならない */
    id: string;
    /** ISO 8601 の日時 */
    at: string;
    /** 一言の説明 */
    label?: string | undefined;
    /** 書いた人 */
    author?: string | undefined;
};
/** `content` に渡す、文書とリビジョンの識別子 */
export type DiffContentTarget = {
    /** 文書の識別子 */
    docId: string;
    /** リビジョンの識別子 */
    revisionId: string;
};
/** 使う側が書く、リビジョンの一覧と本文の取り出し元 */
export type DiffSource = {
    /** 文書のリビジョンを新しい順に返す */
    revisions: (docId: string) => Promise<DiffRevision[]>;
    /** そのリビジョンの Markdown を返す */
    content: (target: DiffContentTarget) => Promise<string>;
};
/** `revisions` が返した値がリビジョンの配列の形かを検め、形が合うときだけその配列を返す。形が合わなければ位置を含む `TypeError` を投げる */
export declare function checkRevisions(value: unknown): DiffRevision[];
