/** リサイズハンドルで変えた幅を sessionStorage に記載するキーの頭 */
export declare const MEDIA_WIDTH_KEY_PREFIX = "mdmark-media-width:";
/** 1 回の `↑`・`↓` とメニューのボタンで変える高さ・幅の下限・ドラッグにする動きの下限（px） */
export declare const MEDIA_RESIZE: {
    step: number;
    minWidth: number;
    dragThreshold: number;
};
/** 幅を下限以上、本文の幅以下の整数にする（本文の幅が下限より狭いときは本文の幅） */
export declare const clampMediaWidth: (options: {
    width: number;
    maxWidth: number;
}) => number;
/** 同じページの同じ順の同じ動画だけが同じ幅を読み込む、sessionStorage のキー */
export declare const mediaWidthKey: (options: {
    pathname: string;
    index: number;
    src: string;
}) => string;
/** リサイズハンドルと大きさのメニューで、縦横の比を保って動画の幅を変える操作を付ける。付けたときに保った幅を当て、その幅と操作を削除する関数を返却する */
export declare const attachMediaResize: (options: {
    /** 動画の図 */
    figure: HTMLElement;
    /** 動画 */
    video: HTMLVideoElement;
    /** リサイズハンドル */
    handle: HTMLButtonElement;
    /** 大きさのメニュー */
    menu: HTMLElement;
    /** 幅を保つキー（`mediaWidthKey`） */
    key: string;
    /** 幅を保つ先（sessionStorage。使用できないときは `null`） */
    storage: Storage | null;
    /** 本文の幅を返却する */
    maxWidth: () => number;
}) => {
    restored: number | null;
    detach: () => void;
};
/** `root` の中の再生バーを持つ動画ごとに、入れ物・リサイズハンドル・大きさのメニューを配置して操作を付け、配置した要素と操作を削除する関数を返却する */
export declare const attachMediaResizes: (options: {
    /** 描いた文書の根 */
    root: HTMLElement;
    /** 幅を保つ先（sessionStorage。使用できないときは `null`） */
    storage: Storage | null;
}) => (() => void);
