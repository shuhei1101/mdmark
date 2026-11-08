/** v0.9.0 までの索引の YAML から語彙を外した YAML を返す。変えるものが無ければ `undefined` */
export declare const dropTagVocabulary: (source: string) => string | undefined;

/** `--config` の設定ファイルの `index` が指す索引から語彙を外して書き戻す */
export declare const runDropTagVocabulary: (argv: string[]) => Promise<void>;
