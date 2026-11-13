/** 要素をスクロールする場所 */
export type ScrollContainer = {
    /** スクロールする要素 */
    target: HTMLElement;
    /** スクロールする要素が画面全体か */
    page: boolean;
};
/** 要素の祖先をたどり、縦にスクロールして中身がはみ出す一番近い要素を返却する。無ければ画面をスクロールする要素 */
export declare function findScrollContainer(from: HTMLElement): ScrollContainer;
