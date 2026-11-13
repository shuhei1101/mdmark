import type { StateCore } from "markdown-it";
import { type MarkOptions } from "./mark-options.ts";
import { type MarkProblem } from "./mark-schema.ts";
/** 生の HTML の中のマーカー（`<!-- 名前: 引数 -->`・`<!-- 名前 -->`・`<!-- /名前 -->`）を取得する正規表現 */
export declare const MARK_PATTERN: RegExp;
/** 機能のオン・オフを記載するマーカーの名前 */
export declare const FEATURES_MARK = "features";
/** 明暗・テーマ・右側の目次の出し方を記載するマーカーの名前 */
export declare const PAGE_MARK = "page";
/** 記法のマーカーの名前から、その記法の機能の名前を参照する */
export declare const SYNTAX_MARKS: Readonly<Record<string, string>>;
/** マーカーのトークンの type */
export declare const MARK_TOKEN = "mdmark_mark";
/** 文書から取得したマーカー 1 つ */
export type Mark = {
    /** マーカーの名前 */
    name: string;
    /** 引数の JSON のオブジェクト。今の書き方の引数は同じオブジェクトにしたもの。引数が無い・読めないときは `{}` */
    options: MarkOptions;
    /** 引数の記載方法 */
    source: "none" | "json" | "legacy" | "invalid";
    /** 引数を読んで検証したときの、記載の警告にする誤り */
    problems: MarkProblem[];
    /** 無視した知らないキーのパス */
    unknownKeys: string[];
    /** マーカーの文字のまま（記載の警告に出す） */
    raw: string;
    /** 閉じのマーカー（`<!-- /名前 -->`）か */
    closing: boolean;
    /** マーカーの引数の文字（コロンの後ろ）。map の範囲が読む */
    rest?: string;
};
/** 今の書き方の引数を判別した値 */
export type LegacyMarkArgs = {
    /** `キー=値` でない引数を記載した順に */
    args: string[];
    /** `キー=値` の引数。同じキーは後に記載した値 */
    keys: Record<string, string>;
};
/** 今の書き方の引数の文字を空白で区切り、`キー=値` を `keys`、それ以外を記載した順に `args` に入れる */
export declare function parseMarkArgs(text: string): LegacyMarkArgs;
export declare function takeMarks(state: StateCore): void;
/** `takeMarks` の後に、設定の `features` に文書の `features` のマーカーを重ねて `env.features` に入れる */
export declare function resolveDocumentFeatures(state: StateCore): void;
/** `takeMarks` が取得した先頭の page のマーカーの設定を記載した順に重ねて `env.page` に入れる */
export declare function resolvePageSettings(state: StateCore): void;
/** 最後に、記法が使用しなかったマーカーのトークン（オフの記法のマーカーを含む）を取り除く */
export declare function dropMarks(state: StateCore): void;
