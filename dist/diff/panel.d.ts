import { type DiffSource } from "./source.ts";
/** 差分のプレビューの前と後の HTML を文書と同じ描き方で描き、置いた要素に文書と同じ操作を付ける関数を返す関数 */
export type DiffHtmlRenderer = (html: string) => {
    /** 描いた範囲の中身 */
    html: string;
    /** 置いた要素に図の拡大・ツールチップ・操作できる部品などの操作を付け、外す関数を返す */
    attach: (root: HTMLElement) => () => void;
};
/** 要素の中の `id` に頭を付け、その `id` を指す属性も書き換えて、前と後のプレビューと本文の間で `id` を重ならせない。表に無い `id`（範囲の外を指すもの）は変えない */
export declare function scopeIds(options: {
    /** プレビューの側の中身 */
    root: HTMLElement;
    /** 付ける頭 */
    prefix: string;
}): void;
/** 描いた文書に「変更を見る」と差分の場所を置き、開く・選び直す・閉じるを受け取って取り出し元を呼び、差分を描く。差分を閉じ、待ちと受け取りとミニマップを片付け、置いた要素を取り除く関数を返す */
export declare function attachDiff(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 使う側の取り出し元 */
    source: DiffSource;
    /** 取り出し元に渡す文書の `id` */
    docId: string;
    /** 埋め込んだ HTML を文書と同じ描き方で描き、操作を付ける関数を返す関数 */
    renderHtml: DiffHtmlRenderer;
}): () => void;
