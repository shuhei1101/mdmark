/** 範囲のコードを CommonJS に変える変換のライブラリ */
export type Transpiler = {
    transform: (code: string, options: object) => {
        code: string;
    };
};
/** モジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<unknown>;
/** 範囲のスクリプトの言語 */
type ScriptLanguage = "ts" | "js";
/** `script` 要素が包んだ関数を指定する、`window` の鍵の名前。動かす間だけ配置し、終えたら削除する */
export declare const HTML_SCRIPTS_REGISTRY = "__mdmarkHtmlScript";
/** 言語ごとの `transform` の設定 */
export declare const TRANSPILE_OPTIONS: Readonly<Record<ScriptLanguage, object>>;
/** 書き出した HTML の起動の処理が入れる、範囲のコードの文字から既定のエクスポートを返却する関数を参照する表。既定は `undefined` */
export declare let embeddedHtmlScripts: Map<string, () => unknown> | undefined;
/** `embeddedHtmlScripts` を置き換える。`undefined` で変換のライブラリを読み込む構造に戻す */
export declare function setEmbeddedHtmlScripts(scripts: Map<string, () => unknown> | undefined): void;
/** `url` を `document.baseURI` を基準に解決して読み込み、`disableScriptTags` を呼んで、`transform` を持つ変換のライブラリを返却する。同じ `cache` では同じ URL を 1 回だけ読み込む */
export declare function loadTranspiler(options: {
    url: string;
    cache: Map<string, Promise<Transpiler>>;
    importModule: ImportModule;
}): Promise<Transpiler>;
/** CommonJS に変えたコードを `(module, exports, require)` を受け取る関数で包み、`window[HTML_SCRIPTS_REGISTRY](通し番号, 関数)` を呼ぶ `script` 要素の中身を返却する */
export declare function wrapRangeScript(options: {
    code: string;
    index: number;
}): string;
/** 描いた要素の中の `template.mdmark-html-script` を文書の順に変換して動かし、既定のエクスポートの関数を範囲の根の要素で呼ぶ。範囲が返却した `destroy` をまとめて呼ぶ関数を返却する */
export declare function runHtmlScripts(options: {
    root: HTMLElement;
    url: string;
    isCurrent: () => boolean;
    cache: Map<string, Promise<Transpiler>>;
    importModule?: ImportModule;
}): Promise<() => void>;
export {};
