import type { StateCore } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type CodeLine } from "../../parts/code-block.ts";
/** 印だけの行コメントの頭。長いものから照らす */
export declare const LINE_COMMENT_HEADS: readonly string[];
/** `code` の印の引数を、題・行番号の有無・強調する行に読む。知らないキー・指定、読めない `highlight=` の番号、コードブロックの行の数を超える行の番号は、当てずに警告にする */
export declare function readCodeSpec(options: {
    args: MdmarkMarkArgs;
    lineCount: number;
}): {
    title: string;
    lineNumbers: boolean;
    highlights: Set<number>;
    warnings: WarningItem[];
};
/** コードブロックの中身を行に分け、行末の `[!code ++]`・`[!code --]`・`[!code highlight]` を行の種類にして印を外す。行コメントが印だけなら印の直前の行コメントの頭も外し、外した後の行末の空白も外す。`[\!code …]` は `\` を外した文字にする。知らない印（`[!code focus]` など）はその行に当てず書いた文字のままにし、警告にする */
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
/** 残っている `fence` のトークンごとに、情報文字列を `splitInfoString` で言語とファイル名に分けてから次を行う。`code` がオンのときは `readLineMarks` で行を読み、直前のトークンが `code` の印なら `readCodeSpec` で指定を読み、全てのコードブロックを部品『コードブロック』（言語・ファイル名・題・行番号・行と、`syntax` がオンなら言語を `syntaxLanguageOf` で引いた色分けの言語）に置き換える。帯の右端のコピーのボタンは `mount` が付ける。`code` がオフのときは行の印を外さず中身の行をそのまま使い、`syntax` がオンで色分けの言語を持つコードブロックだけを帯を持たない部品に置き換え、それ以外は `fence` のまま情報文字列の最初の語を言語に書き換える。読めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` の印の場所にも警告を差し込む（`code` がオンのときだけ） */
export declare function buildCodeBlocks(state: StateCore): void;
