/** `root` の中の埋め込んだ HTML（`div.mdmark-html`）ごとに幅を見て、列より広い間だけ class `is-wide` と `tabindex="0"` を付け、その中で横にスクロールさせる。幅が変わるたびに判定し直す。返す関数で監視を外し、付けた class と `tabindex` を消す */
export declare function attachEmbeddedHtml(root: HTMLElement): () => void;
