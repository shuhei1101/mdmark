/** 色分けの対象の `code` に付ける属性。値は色分けの言語のモジュール名。mdmark が出した要素だけが sanitize を通って持ち続けるため、文書に書いた生の HTML の `code` は色分けの対象にならない */
export declare const SYNTAX_ATTRIBUTE = "data-mdmark-syntax";
/** mermaid のコードブロックの一番外の要素に付ける属性。`mount` が図にする対象を見つけるのに使う */
export declare const MERMAID_ATTRIBUTE = "data-mdmark-mermaid";
/** コードの行 1 つ */
export type CodeLine = {
    /** コードの行の印を外した行の文字（エスケープ前） */
    text: string;
    /** 行の種類。無ければ飾らない行 */
    kind?: "add" | "del" | "highlight" | "focus" | "error" | "warning" | undefined;
    /** インデントのレベル。無ければインデントの無い行か空行 */
    indent?: number | undefined;
    /** 畳める行の後ろの畳む行の数。無ければ畳めない行 */
    foldLines?: number | undefined;
    /** 最初から畳んだ状態か */
    folded?: boolean | undefined;
};
/** 行の開閉のボタンの HTML を返す */
export declare function renderCodeFoldToggle(options: {
    /** 開いているか */
    expanded: boolean;
    /** 畳む範囲の最初の行番号（1 から） */
    from: number;
    /** 畳む範囲の最後の行番号（1 から） */
    to: number;
    /** 畳む行の `id` を空白で並べたもの */
    controls: string;
}): string;
/** 畳んだ行の末尾に置く `⋯` のボタンの HTML を返す */
export declare function renderCodeFoldMore(options: {
    /** 畳んだ範囲の最初の行番号（1 から） */
    from: number;
    /** 畳んだ範囲の最後の行番号（1 から） */
    to: number;
}): string;
/** 行の `id`（開閉のボタンの `aria-controls` が指す） */
export declare function codeLineId(base: string, index: number): string;
/** コピーのボタンの状態 */
export type CodeCopyState = "idle" | "copied" | "failed";
/** コードブロックの帯の右端に置く、コピーのボタンと読み上げの要素を返す。`copied`・`failed` のときは読み上げの要素に `コードを{文言}` を入れる */
export declare function renderCodeCopy(options: {
    state: CodeCopyState;
}): string;
/** コードブロックの HTML を返す。行番号か行の種類を持つときは行ごとの `mdmark-code-line` に分ける。`bar` が `true`（既定）のときは、言語のラベル・題・コピーのボタンを持つ帯を `pre` の前に置いて包み、`false` のときは `pre` だけを返す */
export declare function renderCodeBlock(options: {
    /** 情報文字列の言語（無ければ空） */
    language: string;
    /** 情報文字列のファイル名（無ければ省く） */
    fileName?: string | undefined;
    /** 題（無ければ空） */
    title: string;
    /** 行番号を出すか */
    lineNumbers: boolean;
    /** 長い行を折り返すか（既定 `false`。折り返すときは行に分ける） */
    wrap?: boolean | undefined;
    /** コードの行 */
    lines: CodeLine[];
    /** 色分けする言語のモジュール名。渡すと `code` に `SYNTAX_ATTRIBUTE` を付ける */
    syntax?: string | undefined;
    /** mermaid の対象か。`true` なら一番外の要素に `MERMAID_ATTRIBUTE` を付ける */
    mermaid?: boolean | undefined;
    /** 帯を付けるか（既定 `true`） */
    bar?: boolean | undefined;
    /** 渡すと帯の右端にコピーのボタンを置く */
    copyState?: CodeCopyState | undefined;
    /** 行の開閉のボタンを置くか（既定 `false`） */
    foldButtons?: boolean | undefined;
}): string;
