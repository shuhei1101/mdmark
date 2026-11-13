import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { MarkNote } from "../mark-schema.ts";
import type { Mark } from "../marks.ts";
import type { RenderEnv } from "../parser.ts";
/** 集める警告の種類。マーカーの注記（`MarkNote` の種類）は画面に出さず、点検だけが返却する */
export type WarningKind = "diagram_invalid" | "syntax_warning" | MarkNote["kind"] | "map";
/** 記載の警告に指定する値 */
export type SyntaxWarning = {
    /** 読み込めない指定を記載したマーカーの文字 */
    mark?: string;
    /** 本文 */
    message: string;
    /** 項目 */
    items?: WarningItem[];
    /** 枠の `id` */
    id?: string;
    /** 警告の種類（省くと `syntax_warning`） */
    kind?: "diagram_invalid" | "syntax_warning" | "map";
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
/** 記載の警告の HTML にマーカーを掛けて `html_block` にし、`index` の位置に差し込む。`source` は警告の元になったマーカーのトークン（範囲なら開きのマーカー）で、その行を警告の場所にする */
export declare function pushWarning(state: StateCore, index: number, warning: SyntaxWarning, source?: Token): void;
/** 記載の警告の `html_block` を作る（差し込む位置を呼ぶ側が決めるとき）。`source` は `pushWarning` と同じ */
export declare function warningBlock(state: StateCore, warning: SyntaxWarning, source?: Token): Token;
/** 集めた記載の警告 1 つ（元の行番号は 1 から） */
export type CollectedWarning = {
    line: number;
    kind: WarningKind;
    message: string;
    /** include のマーカーの取り込み先が無い警告か */
    includeTarget?: boolean;
};
/** コアルール（最後に走る）: `meta.warning`（埋め込んだ HTML の範囲は `meta.warnings`）を持つトークンごとに、警告の元の行を 1 からの行番号にして `env.warnings` に集める */
export declare function collectWarningsRule(state: StateCore): void;
/** マーカーの注記を、マーカーの行（1 から）と一緒に記載した順に記録する。トークンは差し込まない */
export declare function recordMarkNotes(env: RenderEnv, options: {
    notes: MarkNote[];
    line: number;
}): void;
/** 範囲のマーカーに閉じのマーカーが無いときの警告 */
export declare function unclosedWarning(mark: Mark): SyntaxWarning;
