import { type MdmarkConfig } from "./config.ts";
/** `mount` の第 2 引数 */
export type MountOptions = {
    /** 描く Markdown */
    markdown: string;
    /** 使う側の設定。省いたキーには既定を当てる */
    config?: MdmarkConfig;
};
/** `mount` の戻り値 */
export type MountHandle = {
    /** 本文だけを描き直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない */
    update: (markdown: string) => void;
    /** 要素の中を空にして class `mdmark` を外し、印刷の受け取りを外す。2 回目以降は何もしない */
    destroy: () => void;
};
/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張の印を描かせ、印刷の受け取りを付けて、描き直しと片付けの関数を返す */
export declare function mount(el: HTMLElement, opts: MountOptions): MountHandle;
