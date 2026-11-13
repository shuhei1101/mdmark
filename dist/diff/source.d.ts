/** `mount` の `opts.diffMode` に指定できる差分の出し方。利用側が差分の出し方に対応するバージョンかを見分けるため、配布物が公開する */
export declare const diffModes: readonly ["button", "open", "blocks"];
/** `mount` の `opts.diffMode` の値 */
export type DiffMode = (typeof diffModes)[number];
/** 文書の変更の 1 回分 */
export type DiffRevision = {
    /** リビジョンの識別子。空でない文字列で、一覧の中で重ならない */
    id: string;
    /** ISO 8601 の日時 */
    at: string;
    /** 一言の説明 */
    label?: string | undefined;
    /** 記載した人 */
    author?: string | undefined;
};
/** `content` に指定する、文書とリビジョンの識別子 */
export type DiffContentTarget = {
    /** 文書の識別子 */
    docId: string;
    /** リビジョンの識別子 */
    revisionId: string;
};
/** 利用側が記載する、リビジョンの一覧と本文の取り出し元 */
export type DiffSource = {
    /** 文書のリビジョンを新しい順に返却する */
    revisions: (docId: string) => Promise<DiffRevision[]>;
    /** そのリビジョンの Markdown を返却する */
    content: (target: DiffContentTarget) => Promise<string>;
};
/** `revisions` が返却した値がリビジョンの配列の構造かを検め、構造が合うときだけその配列を返却する。構造が合わなければ位置を含む `TypeError` を投げる */
export declare function checkRevisions(value: unknown): DiffRevision[];
/** `opts.diffMode` の値が `diffModes` にあればそのまま、無いか知らない値なら `button` を返却する */
export declare function normalizeDiffMode(value: unknown): DiffMode;
