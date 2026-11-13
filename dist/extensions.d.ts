import type { StandardSchemaV1 } from "./standard-schema.ts";
/** マーカーの引数。拡張の `schema` と `draw` が受け取る */
export type MdmarkMarkArgs = {
    /** マーカーの名前の後ろの JSON のオブジェクト（引数の無いマーカーは `{}`） */
    options: Record<string, unknown>;
    /** マーカーを範囲で記載し、範囲に `json` のコードブロックを 1 つ配置したときの、その JSON を読み込んだ値。範囲が無いマーカーでは持たない */
    definition?: unknown;
};
/** `load` が返却するモジュールの構造 */
export type MdmarkExtensionModule = {
    /** マーカーの場所の要素に描く */
    draw: (slot: HTMLElement, value: MdmarkMarkArgs) => void | Promise<void>;
};
/** `registerExtension` に指定する拡張 */
export type MdmarkExtension = {
    /** 拡張の名前。通知ブロック・記載の警告・`console.error` に出す */
    name: string;
    /** マーカーの名前 */
    directive: string;
    /** モジュールを読み込む関数 */
    load: () => Promise<MdmarkExtensionModule>;
    /** 引数を検査する Standard Schema */
    schema?: StandardSchemaV1<MdmarkMarkArgs> | undefined;
};
/** 記載の警告に並べる 1 項目 */
export type WarningItem = {
    /** 項目の頭に `code` で出す文字。空なら出さない */
    label: string;
    /** 項目の本文 */
    message: string;
};
/** 拡張に使用できないマーカーの名前: `features` と記法のマーカー */
export declare const RESERVED_DIRECTIVES: ReadonlySet<string>;
/** 拡張の構造を確認して登録表に追加する。合わない項目があれば `TypeError`、名前が重なれば `Error` を投げて登録しない */
export declare function registerExtension(extension: MdmarkExtension): void;
/** `directive` の拡張を返却する。無ければ `undefined` */
export declare function extensionFor(directive: string): MdmarkExtension | undefined;
/** 単体テストの前に登録表を空にする。公開の入口からは export しない */
export declare function resetExtensions(): void;
/** issue の `path` が `options` の中のキーに届けば `options` の後ろのキーのパス、`definition` の中に届けば `definition.{パス}` をラベルにし、`message` を本文にする */
export declare function formatIssue(issue: StandardSchemaV1.Issue, _value: MdmarkMarkArgs): WarningItem;
/** `schema` で引数を検査し、合えば空、合わなければ issue ごとの項目を返却する。`validate` の例外・拒否はそのまま投げる */
export declare function validateMarkArgs(schema: StandardSchemaV1<MdmarkMarkArgs>, value: MdmarkMarkArgs): Promise<WarningItem[]>;
