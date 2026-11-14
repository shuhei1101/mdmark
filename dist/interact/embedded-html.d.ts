/** `root` の中の埋め込んだ HTML（`div.mdmark-html`）ごとに幅を確認して、列より広い間だけ class `is-wide` と `tabindex="0"` を付け、その中で横にスクロールさせる。幅が変わるたびにもう一度判定する。返却する関数で監視を解除し、付けた class と `tabindex` を削除する */
export declare function attachEmbeddedHtml(root: HTMLElement): () => void;
