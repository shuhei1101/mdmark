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
/** 色分けの言語の対応表: 情報文字列の最初の語（小文字）から、highlight.js の言語のモジュール名を引く。モジュール名は `{url}languages/{モジュール名}.min.js` と npm の `highlight.js/lib/languages/{モジュール名}` の名前に当たる */
export declare const SYNTAX_LANGUAGES: Readonly<Record<string, string>>;
/** 情報文字列の言語の語を小文字にして `SYNTAX_LANGUAGES` を引き、色分けの言語のモジュール名を返す。表に無ければ `undefined` */
export declare function syntaxLanguageOf(language: string): string | undefined;
/** `code` か `syntax` がオンなら、残っている `fence` のトークンごとに次を行う。`code` がオンのときは `readLineMarks` で行を読み、直前のトークンが `code` の印なら `readCodeSpec` で指定を読む（オフのときは行の印を外さず中身の行をそのまま使う）。`syntax` がオンのときは情報文字列の言語を `syntaxLanguageOf` で引く。題・行番号・行の種類・色分けの言語のどれかを持つコードブロックを部品『コードブロック』（色分けの言語を `syntax` に渡す）に置き換える。置き換えないコードブロックも、`code` がオンなら `fence` の `content` を行の文字でつなぎ直す（打ち消した印の `\` が外れる）。読めない指定は、コードブロックの前に警告を差し込む。後ろが `fence` でない `code` の印の場所にも警告を差し込む（`code` がオンのときだけ） */
export declare function buildCodeBlocks(state: StateCore): void;
