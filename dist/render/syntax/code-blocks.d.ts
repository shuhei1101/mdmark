import type { StateCore } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { type CodeLine } from "../../parts/code-block.ts";
import type { MarkOptions } from "../mark-options.ts";
/** 罫線でフォルダ構成を記載した行。行頭の空白（`tree` コマンドが縦線の後ろに出す NBSP を含む）と縦線の後に、罫線の枝が続く */
export declare const TREE_LINE_PATTERN: RegExp;
/** この数以上の罫線の行を持つ言語が `tree` でないコードブロックに、罫線のフォルダ構成の記載の警告を出す */
export declare const TREE_WARNING_MIN_LINES = 2;
/** マーカーだけの行コメントの頭。長いものから照らす */
export declare const LINE_COMMENT_HEADS: readonly string[];
/** `code` のマーカーの設定を、タイトル・行番号の有無と最初の行の番号・強調する行・最初から畳む行・折り返すかに読み込む */
export declare function readCodeSpec(options: {
    options: MarkOptions;
    lineCount: number;
}): {
    title: string;
    lineNumbers: boolean;
    lineStart: number;
    wrap: boolean;
    treeWarning: boolean;
    highlights: Set<number>;
    folds: Set<number>;
    warnings: WarningItem[];
};
/** コードブロックの中身の、罫線でフォルダ構成を記載した行の数を返却する */
export declare function countTreeLines(source: string): number;
/** 行の文字から `measureIndents` でインデントのレベルを、`foldLinesOf` で畳む行の数を決めて行に付け、`folds` の行のうち畳める行に `folded` を付ける。畳めない行は当てずに警告にする */
export declare function readFolds(options: {
    lines: CodeLine[];
    folds: Set<number>;
}): {
    lines: CodeLine[];
    warnings: WarningItem[];
};
/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]` を行の種類にしてマーカーを削除する。行コメントがマーカーだけならマーカーの直前の行コメントの頭も削除し、削除した後の行末の空白も削除する。`[\!code …]` は `\` を削除した文字にする。知らないマーカー（`[!code blink]` など）はその行に当てず記載した文字のままにし、警告にする */
export declare function readLineMarks(source: string): {
    lines: CodeLine[];
    warnings: WarningItem[];
};
/** 情報文字列の最初の単語を最初の `:` で分け、前を言語、後ろをファイル名にする。`:` が無ければ単語の全てが言語でファイル名は空。`:` の前が空なら言語もファイル名も空にする */
export declare function splitInfoString(info: string): {
    language: string;
    fileName: string;
};
/** 色分けの言語の対応表: 情報文字列の最初の単語（小文字）から、highlight.js の言語のモジュール名を参照する。モジュール名は `{url}languages/{モジュール名}.min.js` と npm の `highlight.js/lib/languages/{モジュール名}` の名前に該当する */
export declare const SYNTAX_LANGUAGES: Readonly<Record<string, string>>;
/** 情報文字列の言語の単語を小文字にして `SYNTAX_LANGUAGES` を引き、色分けの言語のモジュール名を返却する。表に無ければ `undefined` */
export declare function syntaxLanguageOf(language: string): string | undefined;
/** 残っている `fence` のトークンごとに、情報文字列を `splitInfoString` で言語とファイル名に分けてから次の処理をする。`code` がオンのときは `readLineMarks` で行を読み込み、直前のトークンが `code` のマーカーなら `readCodeSpec` で指定を読み込み、全てのコードブロックを部品『コードブロック』（言語・ファイル名・タイトル・行番号・行と、`syntax` がオンなら言語を `syntaxLanguageOf` で参照した色分けの言語）に置き換える。帯の右端のコピーのボタンは `mount` が付ける。`code` がオフのときは行のマーカーを削除せず中身の行をそのまま使用し、`syntax` がオンで色分けの言語を持つコードブロックだけを帯を持たない部品に置き換え、それ以外は `fence` のまま情報文字列の最初の単語を言語に書き換える。読み込めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` のマーカーの場所にも警告を差し込む（`code` がオンのときだけ）。`mermaid` がオンで情報文字列の最初の単語がちょうど `mermaid` のコードブロックは、`code` のオン・オフによらず mermaid の対象の部品に置き換え、色分けしない */
export declare function buildCodeBlocks(state: StateCore): void;
