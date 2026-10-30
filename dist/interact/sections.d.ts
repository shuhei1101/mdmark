/** 要素を囲む閉じた節を外側から開き、選ばれていないタブの中ならそのタブも選び、表の行（`tr`）でなければ `scrollIntoView` する。URL の `#ID` で移るときと右側の目次の項目で移るときに使う */
export declare function revealTarget(target: HTMLElement): void;
/** `root` の中の、操作を付けた全ての節を、`open` が `true` なら開く。`false` なら、見出しが h1 の節を開き、h2〜h4 の節を閉じる */
export declare function foldAllSections(options: {
    /** 描いた本文 */
    root: HTMLElement;
    /** 開くか */
    open: boolean;
}): void;
/** `sections` がオンなら節の見出しを開閉のボタンにして閉じた節の中身を隠し、`row-details` がオンなら詳細を持つ行に開閉のボタンを置いて詳細の行を閉じる。URL の `#ID` が閉じた節の中を指すとき（付けたときと `hashchange`）にその節を開く */
export declare function attachSections(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 節の開閉の機能 */
    sections: boolean;
    /** 行の詳細の機能 */
    rowDetails: boolean;
}): () => void;
