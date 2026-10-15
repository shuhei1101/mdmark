/** 設定の `features` に、文書の印の引数（`+名前`・`-名前`）を書いた順に重ねて返す */
export declare function resolveFeatures(options: {
    /** 既定を当てた設定の `features` */
    defaults: Record<string, boolean>;
    /** 文書の `features` の印の引数を書いた順に並べたもの */
    args: string[];
}): Record<string, boolean>;
