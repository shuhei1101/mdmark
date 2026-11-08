import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { Mark } from "../marks.ts";
/** 集める警告の種類。`unknown_mark_arg` は画面に出さず、点検だけが返す */
export type WarningKind = "diagram_invalid" | "syntax_warning" | "unknown_mark_arg";
/** 記法の印の知らない種類・`+機能`・`-機能`・キー・指定の単語 1 つと、その印で使えるもの */
export type SkippedArg = {
    /** 書いた引数の文字。キーは `{キー}=` */
    arg: string;
    /** その印で使える種類・機能・キー・指定を行内のコードにして `・` でつないだ文字 */
    usable: string;
};
/** 書き方の警告に渡す値 */
export type SyntaxWarning = {
    /** 読めない指定を書いた印の文字 */
    mark?: string;
    /** 本文 */
    message: string;
    /** 項目 */
    items?: WarningItem[];
    /** 枠の `id` */
    id?: string;
    /** 警告の種類（省くと `syntax_warning`） */
    kind?: "diagram_invalid" | "syntax_warning";
    /** 警告の元のマーカーのトークンの `map[0]`（マーカーのトークンを持たない警告は省く） */
    line?: number;
    /** include のマーカーの取り込み先が無い警告か（`mdmark check --text`・`--file` が除く） */
    includeTarget?: boolean;
};
/** トークンの `meta.warning` に入れる、集める警告の種類・文・マーカーの行 */
export type WarningMeta = {
    kind: WarningKind;
    message: string;
    line?: number;
    includeTarget?: boolean;
};
/** 書き方の警告の HTML に印を掛けて `html_block` にし、`index` の位置に差し込む。`source` は警告の元になったマーカーのトークン（範囲なら開きのマーカー）で、その行を警告の場所にする */
export declare function pushWarning(state: StateCore, index: number, warning: SyntaxWarning, source?: Token): void;
/** 書き方の警告の `html_block` を作る（差し込む位置を呼ぶ側が決めるとき）。`source` は `pushWarning` と同じ */
export declare function warningBlock(state: StateCore, warning: SyntaxWarning, source?: Token): Token;
/** 集めた書き方の警告 1 つ（元の行番号は 1 から） */
export type CollectedWarning = {
    line: number;
    kind: WarningKind;
    message: string;
    /** include のマーカーの取り込み先が無い警告か */
    includeTarget?: boolean;
};
/** コアルール（最後に走る）: `meta.warning`（埋め込んだ HTML の範囲は `meta.warnings`）を持つトークンごとに、警告の元の行を 1 からの行番号にして `env.warnings` に集める */
export declare function collectWarningsRule(state: StateCore): void;
/** 読み飛ばした引数 1 つにつき、画面に何も出さない `html_block` を作り、`meta.warning` に `unknown_mark_arg` の文と印の行を入れて書いた順に返す（差し込む位置を呼ぶ側が決めるとき） */
export declare function skippedArgBlocks(state: StateCore, options: {
    mark: string;
    skipped: SkippedArg[];
}, source?: Token): Token[];
/** `skippedArgBlocks` のトークンを `index` の位置に差し込む */
export declare function pushSkippedArgs(state: StateCore, index: number, options: {
    mark: string;
    skipped: SkippedArg[];
}, source?: Token): void;
/** 範囲の印に閉じの印が無いときの警告 */
export declare function unclosedWarning(mark: Mark): SyntaxWarning;
