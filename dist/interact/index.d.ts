/** 機能がオンの記法だけ操作を付け、まとめて外す関数を返す */
export declare function attachInteractions(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
}): () => void;
