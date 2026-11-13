/** 読み込んだモジュール。本体の `default` は `HLJSApi`、言語の `default` は `LanguageFn` */
type SyntaxModule = {
    default?: unknown;
};
/** URL の色分けのモジュールを読み込む関数。既定は動的 `import()` で、単体テストで差し替える */
export type SyntaxImport = (url: string) => Promise<SyntaxModule>;
/** 書き出した HTML の起動の処理が指定する、同じスクリプトにまとめた色分けのモジュール */
export type EmbeddedSyntax = {
    /** 本体（`core.min.js`）のモジュール。埋めなかったときは持たない */
    core?: SyntaxModule | undefined;
    /** 言語のモジュール名からモジュールを参照する表。埋めなかった言語は持たない */
    languages: Record<string, SyntaxModule>;
};
/** `setEmbeddedSyntax` が入れる、埋めたモジュール。無ければ `syntax.url` から読み込む。ページの中の全ての `mount` に有効になる */
export declare let embeddedSyntax: EmbeddedSyntax | undefined;
/** 埋めた色分けのモジュールを置き換える。`undefined` で `syntax.url` から読み込む構造に戻す */
export declare function setEmbeddedSyntax(modules: EmbeddedSyntax | undefined): void;
/** 要素の中の `code[data-mdmark-syntax]` が 1 つ以上あれば、色分けのライブラリの本体と使用する言語のモジュールを読み込み、読み込めた言語の `code` の中身を色分けした HTML に置き換える。読み込めないモジュールは `console.error` に出して色分けせずに残し、例外は投げない */
export declare function highlightCodeBlocks(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 既定を適用した設定の `syntax.url` */
    url: string;
    /** 描いた文書がまだ今のものか */
    isCurrent: () => boolean;
    /** `mount` ごとに 1 つの、読み込んだモジュールの記録（URL → 読み込みの Promise） */
    modules: Map<string, Promise<SyntaxModule>>;
    /** モジュールを読み込む関数 */
    importModule?: SyntaxImport;
}): Promise<void>;
export {};
