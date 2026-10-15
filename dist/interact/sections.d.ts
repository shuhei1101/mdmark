/** `sections` がオンなら節の見出しを開閉のボタンにして閉じた節の中身を隠し、`row-details` がオンなら詳細を持つ行に開閉のボタンを置いて詳細の行を閉じる。URL の `#ID` が閉じた節の中を指すとき（付けたときと `hashchange`）にその節を開く */
export declare function attachSections(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 節の開閉の機能 */
    sections: boolean;
    /** 行の詳細の機能 */
    rowDetails: boolean;
}): () => void;
