import { type MdmarkIconNode } from "./parts/inline-icon.ts";
/** 束ねた lucide のバージョン（ビルドと単体テストの `define` で埋める） */
export declare const LUCIDE_VERSION: string;
/** URL のアイコンのモジュールを読む関数 */
export type ImportIconModule = (url: string) => Promise<unknown>;
/** URL へ `HEAD` を送る関数 */
export type FetchHead = (url: string) => Promise<Response>;
/** 束ねていない名前のアイコンを読む jsDelivr の URL を返す */
export declare const lucideIconUrl: (name: string) => string;
/** 中が空の行内のアイコンの名前ごとに、`icons` に無ければ jsDelivr のモジュールを 1 回だけ読み、svg を同じ名前の全ての場所に入れる。読めない名前は行内のコードに戻し、404 は書き方の警告、それ以外は文書の先頭に知らせの枠を 1 つだけ置く */
export declare const loadInlineIcons: (options: {
    /** 描く先の要素 */
    root: HTMLElement;
    /** `opts.icons` */
    icons: Record<string, MdmarkIconNode>;
    /** 描いた文書がまだ今のものか。`import()`・`HEAD` の後に偽なら DOM に触れずに戻る */
    isCurrent: () => boolean;
    /** モジュールを読む関数（既定 `(url) => import(url)`） */
    importModule?: ImportIconModule;
    /** `HEAD` を送る関数（既定 `(url) => fetch(url, { method: "HEAD" })`） */
    fetchHead?: FetchHead;
}) => Promise<void>;
