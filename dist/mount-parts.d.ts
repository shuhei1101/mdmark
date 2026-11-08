import { type MdmarkCommentStore, type MdmarkCommentsHandle } from "./comments/spec.ts";
import { type MdmarkViewHandle, type MdmarkViewOptions } from "./views/spec.ts";
/** 要素の中にビューを描く。引数を同期で検め、ビューの部品のモジュールを読んで描く */
export declare function mountView(el: HTMLElement, opts: MdmarkViewOptions): Promise<MdmarkViewHandle>;
/** 要素の中の選んだ箇所にコメントを付けられるようにする。引数を同期で検め、コメントの部品のモジュールを読んで付ける */
export declare function mountComments(el: HTMLElement, opts: {
    store: MdmarkCommentStore;
    docId: string;
}): Promise<MdmarkCommentsHandle>;
/** `attachParts` に渡す、`mount` ごとに 1 つ作る控え */
export type PartsWarned = {
    /** コメントの機能に読み書きの関数が要ることを出したか */
    missingStore: boolean;
};
/** `attachParts` の戻り値 */
export type PartsHandle = {
    /** 付けた部品を外す。読み込みを待っている間に呼ぶと、読めた後に付けない */
    detach: () => void;
    /** 付けたコメントの `reload` を呼ぶ。コメントを付けていないときは解決した Promise を返す */
    reloadComments: () => Promise<void>;
    /** 付けたコメントの `focus` を呼ぶ。コメントを付けていないときは何もしない */
    focusComment: (id: string) => void;
};
/** `mount` が描くたびに呼ぶ。ビューの印とコメントの機能があるときだけ部品のモジュールを読んで付け、外す関数と付けたコメントの操作を返す */
export declare function attachParts(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** `mount` に渡されたコメントの読み書きの関数 */
    commentStore?: MdmarkCommentStore | undefined;
    /** `mount` に渡された文書の ID */
    docId?: string | undefined;
    /** 描いた文書がまだ今のものか */
    isCurrent: () => boolean;
    /** `mount` ごとに控える、読み書きの関数が無いことを出したか */
    warned: PartsWarned;
}): PartsHandle;
