import { type MdmarkCommentStore } from "./comments/spec.ts";
import { type MdmarkConfig } from "./config.ts";
import { type DiffMode, type DiffSource } from "./diff/source.ts";
import type { MdmarkAlias } from "./knowledge/aliases.ts";
import type { MdmarkIndex } from "./knowledge/index-shape.ts";
import type { MdmarkReferences } from "./knowledge/references.ts";
import type { MdmarkIconNode } from "./parts/inline-icon.ts";
/** `mount` の第 2 引数 */
export type MountOptions = {
    /** 描く Markdown */
    markdown: string;
    /** 利用側の設定。省いたキーには既定を適用する */
    config?: MdmarkConfig;
    /** 索引。省くと索引の用語と関連文書を出さない */
    index?: MdmarkIndex;
    /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
    docId?: string;
    /** `collectReferences` の戻り値。省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
    references?: MdmarkReferences;
    /** `buildAliases` が作ったエイリアス。`glossary` がオンのとき、名前と別名に下線と種類ごとのツールチップを付ける。使用できないエイリアス（`env` を含む）は照合せず、通知ブロックも出さない */
    aliases?: MdmarkAlias[];
    /** 差分の取り出し元。指定すると描いた文書に差分を開く UI を付ける。指定するときは `docId` も要る */
    diffSource?: DiffSource;
    /** 差分の出し方。`button`（既定）は「変更表示」を押してから差分の行を出し、`open` は描いた時点で押した状態にし、`blocks` は描いた文書のブロックを追加と削除の色で塗り分ける。`diffSource` を指定しないときは使用しない。知らない値は `button` にする */
    diffMode?: DiffMode;
    /** コメントの読み込みと保存の関数。`comments` の機能がオンのときだけ使用する。指定するときは `docId` も要る */
    commentStore?: MdmarkCommentStore;
    /** 比較元の Markdown。指定すると、本文の中で比較元から変えたブロックを `blocks` と同じ色で塗り分ける。`null` と省いたときは色分けしない */
    baseMarkdown?: string | null;
    /** `+columns` の表で列の表示を切り替えるたびに呼ぶ */
    onColumnsChange?: (event: MdmarkColumnsChange) => void;
    /** 取り込む文書の表。キーは描く文書のフォルダからのパス。省くと include のマーカーを取り込み先が無い警告にする */
    includes?: Record<string, string>;
    /** まとめていない名前のアイコンの形状の表。表に無い名前は jsDelivr から読み込む */
    icons?: Record<string, MdmarkIconNode>;
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
    /** 本文だけを再描画する。設定は `mount` に指定したものを使用する。`options.baseMarkdown` を指定すると比較元を差し替え、`null` で削除する。`options.includes` を指定すると取り込む文書の表を差し替える。`destroy` の後は何もしない */
    update: (markdown: string, options?: {
        baseMarkdown?: string | null;
        includes?: Record<string, string>;
    }) => void;
    /** 要素の中を空にして class `mdmark` とテーマの属性を削除し、印刷の受け取りを解除する。2 回目以降は何もしない */
    destroy: () => void;
    /** 本文を再描画せずにコメントを再読み込みし、マーカーをもう一度付けてから解決する。コメントを付けていないときと `destroy` の後は解決する */
    reloadComments: () => Promise<void>;
    /** その `id` のコメントのマーカーへ移って強調する。マーカーが無い `id` と `destroy` の後は何もしない */
    focusComment: (id: string) => void;
};
/** 比較元が文字列か `null` か `undefined` かを確認し、違えば `baseMarkdown` を含む `TypeError` を投げる */
export declare function checkBaseMarkdown(value: unknown): asserts value is string | null | undefined;
/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張のマーカーを描かせ、ビューとコメントの部品を付け、印刷の受け取りを付けて、再描画と片付けの関数を返却する。`diffSource` か `commentStore` を指定して `docId` が無いとき、`commentStore`・`baseMarkdown`・`onColumnsChange` が合わないときは、何も描かずに `TypeError` を投げる */
export declare function mount(el: HTMLElement, opts: MountOptions): MountHandle;
