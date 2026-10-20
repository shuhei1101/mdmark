import type { StateCore } from "markdown-it";
import { type MdmarkMarkArgs } from "../extensions.ts";
/** 生の HTML の中の印（`<!-- 名前: 引数 -->`・`<!-- 名前 -->`・`<!-- /名前 -->`）を拾う正規表現 */
export declare const MARK_PATTERN: RegExp;
/** 機能のオン・オフを書く印の名前 */
export declare const FEATURES_MARK = "features";
/** 記法の印の名前から、その記法の機能の名前を引く */
export declare const SYNTAX_MARKS: Readonly<Record<string, string>>;
/** 印のトークンの type */
export declare const MARK_TOKEN = "mdmark_mark";
/** 文書から拾った印 1 つ */
export type Mark = {
    /** 印の名前 */
    name: string;
    /** 読み分けた引数 */
    args: MdmarkMarkArgs;
    /** 印の文字のまま（書き方の警告に出す） */
    raw: string;
    /** 閉じの印（`<!-- /名前 -->`）か */
    closing: boolean;
    /** 印の引数の文字（コロンの後ろ）。空白で区切る前のまま */
    rest?: string;
};
/** 印の引数の文字を空白で区切り、`キー=値` を `keys`、それ以外を書いた順に `args` に入れる */
export declare function parseMarkArgs(text: string): MdmarkMarkArgs;
/** 印を拾い、`features` は引数を環境へ足し、対応表と拡張の名前は印の場所の要素にし、記法の印は印のトークンにし、それ以外は取り除く */
export declare function takeMarks(state: StateCore): void;
/** `takeMarks` の後に、設定の `features` に文書の `features` の印を重ねて `env.features` に入れる */
export declare function resolveDocumentFeatures(state: StateCore): void;
/** 最後に、記法が使わなかった印のトークン（オフの記法の印を含む）を取り除く */
export declare function dropMarks(state: StateCore): void;
