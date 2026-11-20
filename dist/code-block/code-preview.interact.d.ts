/** 描いた結果の中の `id` と、それを指す属性の値の頭に付ける文字。後ろに通し番号と `-` を続ける */
export declare const PREVIEW_ID_PREFIX = "mdmark-preview-";
/** 描いた結果を描くときに、外の文書でオンでも `false` にする機能 */
export declare const PREVIEW_CUT_FEATURES: readonly ["side-toc", "back-to-top", "markdown-buttons", "backlinks", "comments", "print"];
/** 描いた結果の要素に Markdown を描き、片付ける関数を返却する関数 */
export type RenderPreview = (el: HTMLElement, markdown: string) => () => void;
/** 描いた結果の中の `id` と、それを指す `href="#…"`・ID を指す属性の値に、`PREVIEW_ID_PREFIX` と通し番号の頭を付ける。描いた結果の外を指す値は書き換えない */
export declare function prefixPreviewIds(el: HTMLElement, n: number): void;
/** `data-mdmark-markdown` を持つコードブロックに描いた結果と Raw のボタンを付け、押すたびに描いた結果と元の Markdown を切り替える。描いた結果とボタンを取り除く関数を返却する */
export declare function attachCodePreviews(root: HTMLElement, renderPreview: RenderPreview): () => void;
