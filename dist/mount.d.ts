import type { MdmarkCommentStore } from "./comments/spec.ts";
import { type MdmarkConfig } from "./config.ts";
import type { DiffSource } from "./diff/source.ts";
import type { MdmarkIndex } from "./knowledge/index-shape.ts";
import type { MdmarkReferences } from "./knowledge/references.ts";
/** `mount` の第 2 引数 */
export type MountOptions = {
    /** 描く Markdown */
    markdown: string;
    /** 使う側の設定。省いたキーには既定を当てる */
    config?: MdmarkConfig;
    /** 索引。省くと索引の用語と関連文書を出さない */
    index?: MdmarkIndex;
    /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
    docId?: string;
    /** `collectReferences` の戻り値。省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
    references?: MdmarkReferences;
    /** 差分の取り出し元。渡すと描いた文書に差分を開く UI を付ける。渡すときは `docId` も要る */
    diffSource?: DiffSource;
    /** コメントの読み書きの関数。`comments` の機能がオンのときだけ使う。渡すときは `docId` も要る */
    commentStore?: MdmarkCommentStore;
};
/** `mount` の戻り値 */
export type MountHandle = {
    /** 本文だけを描き直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない */
    update: (markdown: string) => void;
    /** 要素の中を空にして class `mdmark` を外し、印刷の受け取りを外す。2 回目以降は何もしない */
    destroy: () => void;
};
/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張の印を描かせ、ビューとコメントの部品を付け、印刷の受け取りを付けて、描き直しと片付けの関数を返す。`diffSource` か `commentStore` を渡して `docId` が無いとき、`commentStore` が `load`・`save` の関数を持たないときは、何も描かずに `TypeError` を投げる */
export declare function mount(el: HTMLElement, opts: MountOptions): MountHandle;
