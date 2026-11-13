/** 設定の `features` に、文書の `features` のマーカーの JSON のオブジェクトを記載した順に重ねて返却する */
export declare function resolveFeatures(options: {
    /** 既定を適用した設定の `features` */
    defaults: Record<string, boolean>;
    /** 文書の `features` のマーカーの JSON のオブジェクトを記載した順に並べたもの */
    marks: Array<Record<string, unknown>>;
}): Record<string, boolean>;
