/** v0.9.0 までの索引の YAML から語彙を削除した YAML を返却する。変えるものが無ければ `undefined` */
export declare const dropTagVocabulary: (source: string) => string | undefined;

/** `--config` の設定ファイルの `index` が指す索引から語彙を削除して書き込んで戻す */
export declare const runDropTagVocabulary: (argv: string[]) => Promise<void>;
