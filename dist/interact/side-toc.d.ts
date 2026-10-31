import type { SideTocMode } from "../config.ts";
import { type SideTocHeading } from "../parts/side-toc.ts";
/** `mount` ごとに 1 つ作り、`update` で描き直しても保つ右側の目次の状態 */
export type SideTocState = {
    /** 目次を出すボタンで目次を出しているか */
    open: boolean;
    /** ピン止めしているか */
    pinned: boolean;
};
/** 本文の中の右側の目次に並べる見出しを文書の順に集める */
export declare function collectSideTocHeadings(content: HTMLElement): SideTocHeading[];
/** 画面に出ている見出しの位置から今いる節の見出しの ID を決める。上端が線以下の見出しのうち最後のものを返し、無ければ画面の中にある最初の見出しを返す */
export declare function pickCurrentHeading(options: {
    /** 閉じた節と選ばれていないタブの中に無い見出しの ID と、画面の上端からの位置（文書の順） */
    headings: {
        id: string;
        top: number;
    }[];
    /** 線の位置 */
    line: number;
    /** 画面の高さ */
    viewportHeight: number;
}): string | undefined;
/** 描く先の要素の子を本文の列に包み、その後ろに右側の目次を置いて操作を付ける。見出しが無ければ何も置かない。外す関数は包む前の子の並びへ戻す */
export declare function attachSideToc(options: {
    /** 描く先の要素 */
    el: HTMLElement;
    /** 出し方 */
    mode: SideTocMode;
    /** すべて展開とすべて折りたたむを出すか */
    sections: boolean;
    /** `mount` が保つ状態 */
    state: SideTocState;
}): {
    content: HTMLElement;
    aside?: HTMLElement;
    detach: () => void;
};
