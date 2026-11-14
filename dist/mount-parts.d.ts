import { type MdmarkCommentStore, type MdmarkCommentsHandle } from "./comments/spec.ts";
import type { ResolvedConfig } from "./config.ts";
import { type MdmarkViewHandle, type MdmarkViewOptions } from "./views/spec.ts";
/** 要素の中にビューを描く。引数を同期で検め、ビューの部品のモジュールを読み込んで描く */
export declare function mountView(el: HTMLElement, opts: MdmarkViewOptions): Promise<MdmarkViewHandle>;
/** 要素の中の選んだ箇所にコメントを付けられるようにする。引数を同期で検め、コメントの部品のモジュールを読み込んで付ける */
export declare function mountComments(el: HTMLElement, opts: {
    store: MdmarkCommentStore;
    docId: string;
}): Promise<MdmarkCommentsHandle>;
/** `attachParts` に指定する、`mount` ごとに 1 つ作る記録 */
export type PartsWarned = {
    /** コメントの機能に読み込みと保存の関数が要ることを出したか */
    missingStore: boolean;
};
/** `attachParts` の戻り値 */
export type PartsHandle = {
    /** 付けた部品を削除する。読み込みを待っている間に呼ぶと、読み込めた後に付けない */
    detach: () => void;
    /** 付けたコメントの `reload` を呼ぶ。コメントを付けていないときは解決した Promise を返却する */
    reloadComments: () => Promise<void>;
    /** 付けたコメントの `focus` を呼ぶ。コメントを付けていないときは何もしない */
    focusComment: (id: string) => void;
};
/** `mount` が描くたびに呼ぶ。ビューのマーカーとコメントの機能があるときだけ部品のモジュールを読み込んで付け、削除する関数と付けたコメントの操作を返却する */
export declare function attachParts(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** `mount` に指定されたコメントの読み込みと保存の関数 */
    commentStore?: MdmarkCommentStore | undefined;
    /** `mount` に指定された文書の ID */
    docId?: string | undefined;
    /** 描いた文書がまだ今のものか */
    isCurrent: () => boolean;
    /** `mount` ごとに記録する、読み込みと保存の関数が無いことを出したか */
    warned: PartsWarned;
    /** 既定を当てた設定（map の図が使う） */
    config?: ResolvedConfig | undefined;
}): PartsHandle;
