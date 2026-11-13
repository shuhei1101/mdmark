/** タッチで表示する枠の余白をタップすると表示するノードに `data-touch-active` を付け、外のタッチの `pointerdown` で外す。付けた操作を削除する関数を返却する */
export declare function attachDiagramTouch(options: {
    box: HTMLElement;
    viewport: HTMLElement;
}): () => void;
