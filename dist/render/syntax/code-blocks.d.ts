import type { StateCore } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type CodeLine } from "../../parts/code-block.ts";
import { type SkippedArg } from "./warnings.ts";
/** 印だけの行コメントの頭。長いものから照らす */
export declare const LINE_COMMENT_HEADS: readonly string[];
/** 値を持つ `wrap=` の警告の項目の本文 */
export declare const WRAP_VALUE_MESSAGE = "wrap \u306F\u5024\u3092\u6301\u3061\u307E\u305B\u3093\u3002wrap=\u2026 \u3067\u306F\u306A\u304F wrap \u3068\u66F8\u3044\u3066\u304F\u3060\u3055\u3044\u3002\u6298\u308A\u8FD4\u3055\u305A\u306B\u63CF\u3044\u3066\u3044\u307E\u3059";
/** `code` の印の引数を、題・行番号の有無・強調する行・最初から畳む行に読む。`title=` の値の空白の後ろの単語、読めない `highlight=`・`fold=` の番号、コードブロックの行の数を超える行の番号は、当てずに警告にする。それ以外の知らないキー・指定は読み飛ばした引数にする。`text` は印の引数の文字 */
export declare function readCodeSpec(options: {
    args: MdmarkMarkArgs;
    text: string;
    lineCount: number;
}): {
    title: string;
    lineNumbers: boolean;
    wrap: boolean;
    highlights: Set<number>;
    folds: Set<number>;
    warnings: WarningItem[];
    skipped: SkippedArg[];
};
/** 行の文字から `measureIndents` でインデントのレベルを、`foldLinesOf` で畳む行の数を決めて行に付け、`folds` の行のうち畳める行に `folded` を付ける。畳めない行は当てずに警告にする */
export declare function readFolds(options: {
    lines: CodeLine[];
    folds: Set<number>;
}): {
    lines: CodeLine[];
    warnings: WarningItem[];
};
/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]`・`[!code focus]`・`[!code error]`・`[!code warning]` を行の種類にして印を外す。行コメントが印だけなら印の直前の行コメントの頭も外し、外した後の行末の空白も外す。`[\!code …]` は `\` を外した文字にする。知らない印（`[!code blink]` など）はその行に当てず書いた文字のままにし、警告にする */
export declare function readLineMarks(source: string): {
    lines: CodeLine[];
    warnings: WarningItem[];
};
/** 情報文字列の最初の語を最初の `:` で分け、前を言語、後ろをファイル名にする。`:` が無ければ語の全てが言語でファイル名は空。`:` の前が空なら言語もファイル名も空にする */
export declare function splitInfoString(info: string): {
    language: string;
    fileName: string;
};
/** 色分けの言語の対応表: 情報文字列の最初の語（小文字）から、highlight.js の言語のモジュール名を引く。モジュール名は `{url}languages/{モジュール名}.min.js` と npm の `highlight.js/lib/languages/{モジュール名}` の名前に当たる */
export declare const SYNTAX_LANGUAGES: Readonly<Record<string, string>>;
/** 情報文字列の言語の語を小文字にして `SYNTAX_LANGUAGES` を引き、色分けの言語のモジュール名を返す。表に無ければ `undefined` */
export declare function syntaxLanguageOf(language: string): string | undefined;
/** 残っている `fence` のトークンごとに、情報文字列を `splitInfoString` で言語とファイル名に分けてから次を行う。`code` がオンのときは `readLineMarks` で行を読み、直前のトークンが `code` の印なら `readCodeSpec` で指定を読み、全てのコードブロックを部品『コードブロック』（言語・ファイル名・題・行番号・行と、`syntax` がオンなら言語を `syntaxLanguageOf` で引いた色分けの言語）に置き換える。帯の右端のコピーのボタンは `mount` が付ける。`code` がオフのときは行の印を外さず中身の行をそのまま使い、`syntax` がオンで色分けの言語を持つコードブロックだけを帯を持たない部品に置き換え、それ以外は `fence` のまま情報文字列の最初の語を言語に書き換える。読めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` の印の場所にも警告を差し込む（`code` がオンのときだけ）。`mermaid` がオンで情報文字列の最初の語がちょうど `mermaid` のコードブロックは、`code` のオン・オフによらず mermaid の対象の部品に置き換え、色分けしない */
export declare function buildCodeBlocks(state: StateCore): void;
