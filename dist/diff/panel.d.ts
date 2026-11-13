import { type DiffSource } from "./source.ts";
/** 差分のプレビューの前と後の HTML を文書と同じ描き方で描き、配置した要素に文書と同じ操作を付ける関数を返却する関数 */
export type DiffHtmlRenderer = (html: string) => {
    /** 描いた範囲の中身 */
    html: string;
    /** 配置した要素に図の拡大・ツールチップ・操作できる部品などの操作を付け、削除する関数を返却する */
    attach: (root: HTMLElement) => () => void;
};
/** 差分を開いている間に隠す本文の要素と右側の目次に付ける属性。`index.css` が `display: none !important` で隠す */
export declare const DIFF_HIDDEN_ATTRIBUTE = "data-mdmark-diff-hidden";
/** 単語の区切り。`Intl.Segmenter` を持たないブラウザでは `undefined` */
export declare function createSegmenter(): Intl.Segmenter | undefined;
/** 要素の中の `id` に頭を付け、その `id` を指す属性も書き換えて、前と後のプレビューと本文の間で `id` を重ならせない。表に無い `id`（範囲の外を指すもの）は変えない */
export declare function scopeIds(options: {
    /** プレビューの側の中身 */
    root: HTMLElement;
    /** 付ける頭 */
    prefix: string;
}): void;
/** 描いた文書に「変更表示」と差分の場所を配置し、開く・もう一度選ぶ・閉じるを受け取って取り出し元を呼び、差分を描く。差分を閉じ、待ちと受け取りとミニマップを片付け、配置した要素を取り除く関数を返却する */
export declare function attachDiff(options: {
    /** 描いた本文（右側の目次を配置したときは本文の列） */
    root: HTMLElement;
    /** 利用側の取り出し元 */
    source: DiffSource;
    /** 取り出し元に指定する文書の `id` */
    docId: string;
    /** 埋め込んだ HTML を文書と同じ描き方で描き、操作を付ける関数を返却する関数 */
    renderHtml: DiffHtmlRenderer;
    /** 差分を開いている間、`root` の外で一緒に隠す要素（右側の目次） */
    hideWith?: HTMLElement[];
    /** 配置した時点で開くか（既定 `false`。`mount` の `diffMode` が `open` のとき `true`） */
    open?: boolean;
}): () => void;
