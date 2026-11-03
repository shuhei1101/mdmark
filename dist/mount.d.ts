import { type MdmarkCommentStore } from "./comments/spec.ts";
import { type MdmarkConfig } from "./config.ts";
import { type DiffMode, type DiffSource } from "./diff/source.ts";
import type { MdmarkAlias } from "./knowledge/aliases.ts";
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
    /** `buildAliases` が作ったエイリアス。`glossary` がオンのとき、名前と別名に下線と種類ごとのツールチップを付ける。使えないエイリアス（`env` を含む）は照合せず、知らせの枠も出さない */
    aliases?: MdmarkAlias[];
    /** 差分の取り出し元。渡すと描いた文書に差分を開く UI を付ける。渡すときは `docId` も要る */
    diffSource?: DiffSource;
    /** 差分の出し方。`button`（既定）は「変更を見る」を押してから差分の行を出し、`open` は描いた時点で押した状態にし、`blocks` は描いた文書のブロックを追加と削除の色で塗り分ける。`diffSource` を渡さないときは使わない。知らない値は `button` にする */
    diffMode?: DiffMode;
    /** コメントの読み書きの関数。`comments` の機能がオンのときだけ使う。渡すときは `docId` も要る */
    commentStore?: MdmarkCommentStore;
    /** 比較元の Markdown。渡すと、本文の中で比較元から変えたブロックを `blocks` と同じ色で塗り分ける。`null` と省いたときは色分けしない */
    baseMarkdown?: string | null;
    /** `+columns` の表で列の表示を切り替えるたびに呼ぶ */
    onColumnsChange?: (event: MdmarkColumnsChange) => void;
};
/** `onColumnsChange` が受け取る列の表示 */
export type MdmarkColumnsChange = {
    /** 本文の中の `+columns` の表の出現順（0 から。削除したブロックの中の表は数えない） */
    tableIndex: number;
    /** 隠している列の見出しの文字（列の順） */
    hidden: string[];
};
/** `mount` の戻り値 */
export type MountHandle = {
    /** 本文だけを描き直す。設定は `mount` に渡したものを使う。`options.baseMarkdown` を渡すと比較元を差し替え、`null` で外す。`destroy` の後は何もしない */
    update: (markdown: string, options?: {
        baseMarkdown?: string | null;
    }) => void;
    /** 要素の中を空にして class `mdmark` とテーマの属性を外し、印刷の受け取りを外す。2 回目以降は何もしない */
    destroy: () => void;
    /** 本文を描き直さずにコメントを読み直し、印を付け直してから解決する。コメントを付けていないときと `destroy` の後は解決する */
    reloadComments: () => Promise<void>;
    /** その `id` のコメントの印へ移って強調する。印が無い `id` と `destroy` の後は何もしない */
    focusComment: (id: string) => void;
};
/** 比較元が文字列か `null` か `undefined` かを確かめ、違えば `baseMarkdown` を含む `TypeError` を投げる */
export declare function checkBaseMarkdown(value: unknown): asserts value is string | null | undefined;
/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張の印を描かせ、ビューとコメントの部品を付け、印刷の受け取りを付けて、描き直しと片付けの関数を返す。`diffSource` か `commentStore` を渡して `docId` が無いとき、`commentStore`・`baseMarkdown`・`onColumnsChange` が合わないときは、何も描かずに `TypeError` を投げる */
export declare function mount(el: HTMLElement, opts: MountOptions): MountHandle;
