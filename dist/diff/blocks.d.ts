import { type DiffEngine } from "./compute.ts";
import { type DiffSource } from "./source.ts";
/** ブロックの色分けのために取り出した結果。`pair` は 2 番目（前）と 1 番目（後）のリビジョンの Markdown、`single` はリビジョンが 1 つ以下、`failed` は一覧か本文を取り出せなかった */
export type DiffPair = {
    kind: "pair";
    before: string;
    after: string;
} | {
    kind: "single";
} | {
    kind: "failed";
};
/** 色を適用する単位。`block` は本文のブロック、`item` はリストの項目、`row` は表の行 */
type BlockUnit = "block" | "item" | "row";
/** 色分けの単位のブロック 1 つと、その元の行の範囲 */
export type BlockRange = {
    /** ブロックの要素（本文かセクションの中身の直下の要素、いちばん外の `li`、`tbody` の `tr`） */
    element: HTMLElement;
    /** 部品『差分のブロック』の `unit` に指定する値 */
    unit: BlockUnit;
    /** ブロックの `data-source-line`（0 始まり） */
    start: number;
    /** 次のブロックの `data-source-line` の 1 つ前。最後のブロックは文書の最後の行 */
    end: number;
};
/** 色分けの片側（前か後）の Markdown と、それを今の描き方で描いた中身 */
type Side = {
    /** 描いた中身（画面に配置する前の `template` の中身） */
    root: ParentNode;
    /** 描いた Markdown */
    markdown: string;
};
/** 取り出し元の一覧を 1 回、前と後の本文を 1 回ずつ呼び、ブロックの色分けに使用する 2 つの Markdown を返却する。取り出せないときは `console.error` に出し、`failed` を返却する */
export declare function loadDiffPair(options: {
    /** `mount` に指定された取り出し元 */
    source: DiffSource;
    /** 文書の `id` */
    docId: string;
}): Promise<DiffPair>;
/** 描いた文書の要素を色分けの単位のブロックに分け、元の行の範囲を付けて上から順に返却する */
export declare function collectBlockRanges(options: {
    /** 描いた文書の中身 */
    root: ParentNode;
    /** その Markdown の行の数 */
    lineCount: number;
}): BlockRange[];
/** 対の 2 つのブロックの文字を単語ごとに比べ、同じ文字の数が長い方の文字の数の半分以上なら true（書き換え）を返却する。どちらも空なら true */
export declare function isRewrite(options: {
    /** 削除の候補の文字 */
    before: string;
    /** 追加のブロックの文字 */
    after: string;
    /** 単語の区切り。持たないブラウザでは `undefined` */
    segmenter: Intl.Segmenter | undefined;
    /** 比較の計算 */
    engine: DiffEngine;
}): boolean;
/** 前と後の Markdown を行で比べ、後の文書を描いた中身に追加の色を当て、前の文書から削除したブロックを前の位置に差し込む。`after.root` を書き換え、`before.root` の要素を `after.root` へ複製する */
export declare function colorDiffBlocks(options: {
    before: Side;
    after: Side;
    /** 単語の区切り。持たないブラウザでは `undefined` */
    segmenter: Intl.Segmenter | undefined;
    /** 比較の計算。既定は `jsdiffEngine` */
    engine?: DiffEngine;
}): void;
export {};
