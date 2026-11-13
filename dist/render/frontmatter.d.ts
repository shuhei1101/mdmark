/** 文書の先頭のフロントマターを空白にした本文と、フロントマターの中身・閉じる行 */
export type SplitFrontmatter = {
    /** フロントマターの範囲の改行以外の文字を空白にした Markdown（フロントマターが無ければ元のまま） */
    body: string;
    /** フロントマターの中身（開く行と閉じる行を除いた行。行の間は `\n`）。無ければ `undefined` */
    content: string | undefined;
    /** 閉じる行の 0 始まりの行番号。無ければ `undefined` */
    endLine: number | undefined;
};
/** Markdown の先頭のフロントマターを判定し、その範囲を空白にした本文と、中身・閉じる行を返却する */
export declare const splitFrontmatter: (markdown: string) => SplitFrontmatter;
