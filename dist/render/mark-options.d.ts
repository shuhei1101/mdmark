/** マーカーの引数の JSON のオブジェクト */
export type MarkOptions = Record<string, unknown>;
/** 読んだマーカーの引数 */
export type MarkArgs = {
    kind: "none";
} | {
    kind: "json";
    options: MarkOptions;
} | {
    kind: "legacy";
    text: string;
} | {
    kind: "invalid";
    message: string;
};
/** 値がオブジェクト（配列を除く）か */
export declare const isMarkOptions: (value: unknown) => value is MarkOptions;
/** 閉じていない文字の値があるか（`"` の数が奇数） */
export declare const hasUnclosedString: (text: string) => boolean;
/** `JSON.parse` が投げたエラーの位置と引数の文字から、記載の警告の本文を作る */
export declare const jsonErrorMessage: (options: {
    text: string;
    error: unknown;
}) => string;
/** マーカーの `:` の後ろから `-->` の前までの文字を、引数の記載方法ごとに読む */
export declare const readMarkArgs: (text: string) => MarkArgs;
