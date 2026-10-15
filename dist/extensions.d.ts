import type { StandardSchemaV1 } from "./standard-schema.ts";
/** 印の引数を読み分けた値。拡張の `schema` と `draw` が受け取る */
export type MdmarkMarkArgs = {
    /** `キー=値` でない引数を書いた順に */
    args: string[];
    /** `キー=値` の引数。同じキーは後に書いた値 */
    keys: Record<string, string>;
};
/** `load` が返すモジュールの形 */
export type MdmarkExtensionModule = {
    /** 印の場所の要素に描く */
    draw: (slot: HTMLElement, value: MdmarkMarkArgs) => void | Promise<void>;
};
/** `registerExtension` に渡す拡張 */
export type MdmarkExtension = {
    /** 拡張の名前。知らせの枠・書き方の警告・`console.error` に出す */
    name: string;
    /** 印の名前 */
    directive: string;
    /** モジュールを読む関数 */
    load: () => Promise<MdmarkExtensionModule>;
    /** 引数を検査する Standard Schema */
    schema?: StandardSchemaV1<MdmarkMarkArgs> | undefined;
};
/** 書き方の警告に並べる 1 項目 */
export type WarningItem = {
    /** 項目の頭に `code` で出す文字。空なら出さない */
    label: string;
    /** 項目の本文 */
    message: string;
};
/** 拡張に使えない印の名前: `features` と記法の印 */
export declare const RESERVED_DIRECTIVES: ReadonlySet<string>;
/** 拡張の形を確かめて登録表に足す。合わない項目があれば `TypeError`、名前が重なれば `Error` を投げて登録しない */
export declare function registerExtension(extension: MdmarkExtension): void;
/** `directive` の拡張を返す。無ければ `undefined` */
export declare function extensionFor(directive: string): MdmarkExtension | undefined;
/** 単体テストの前に登録表を空にする。公開の入口からは export しない */
export declare function resetExtensions(): void;
/** issue の `path` が `args` と位置、`keys` とキーに届けばそれを示すラベルにし、`message` を本文にする */
export declare function formatIssue(issue: StandardSchemaV1.Issue, value: MdmarkMarkArgs): WarningItem;
/** `schema` で引数を検査し、合えば空、合わなければ issue ごとの項目を返す。`validate` の例外・拒否はそのまま投げる */
export declare function validateMarkArgs(schema: StandardSchemaV1<MdmarkMarkArgs>, value: MdmarkMarkArgs): Promise<WarningItem[]>;
