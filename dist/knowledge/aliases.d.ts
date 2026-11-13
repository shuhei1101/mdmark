/** `buildAliases` が受け付ける `alias_type` の値。`env` を含む */
export declare const ALIAS_TYPES: readonly ["term", "doc", "command", "url", "skill", "tool", "path", "env", "avoid"];
/** `MdmarkAlias` の `alias_type` の値。`env` は `buildAliases` が作らないため含めない */
export type MdmarkAliasType = Exclude<(typeof ALIAS_TYPES)[number], "env">;
/** `readAliasRecord` がレコードから取るキー。`port` は `env` の必須の確認にだけ使用する */
export declare const ALIAS_KEYS: readonly ["id", "name", "aliases", "description", "related", "command", "cwd", "url", "avoid", "skill", "tool", "path", "port", "replacement"];
/** `id`・`name` のほかに、種類ごとに空にできないキー。`env` は `url` と `port` の 1 つ以上で、`checkAliasFields` が別に確認する */
export declare const ALIAS_REQUIRED_KEYS: Record<(typeof ALIAS_TYPES)[number], readonly (typeof ALIAS_KEYS)[number][]>;
/** `alias_required_empty` の `message` の修正方法に出すキーの名前 */
export declare const ALIAS_KEY_LABELS: Record<string, string>;
/** 設定の行の `metadata` を適用して作ったエイリアス 1 件。値の無いキーは持たない（`aliases` だけは空の並びでも持つ） */
export type MdmarkAlias = {
    /** エイリアスの種類。ツールチップの区分と照合したときの扱いを決める */
    alias_type: MdmarkAliasType;
    /** エイリアスの ID。指定したエイリアスの中で一意 */
    id: string;
    /** 照合する単語で、ツールチップに出す名前。`avoid` の種類ではやめた言い方 */
    name: string;
    /** 名前と同じく照合する単語 */
    aliases: string[];
    /** ツールチップの説明 */
    description?: string;
    /** `term` の関連する単語。受け取るだけで使用しない */
    related?: string[];
    /** `command` の種類のコマンド */
    command?: string;
    /** `command` の種類の実行場所 */
    cwd?: string;
    /** `url` の種類の URL */
    url?: string;
    /** `skill` の種類のスキル名 */
    skill?: string;
    /** `tool` の種類のツール名 */
    tool?: string;
    /** `path` の種類のパス */
    path?: string;
    /** `term` の種類のやめた言い方 */
    avoid?: string[];
    /** `avoid` の種類の置き換え先の単語 */
    replacement?: string;
};
/** 行の `paths` に該当したファイルを YAML として読み込んだ中身 1 つ */
export type MdmarkAliasSource = {
    /** そのファイルを指した行の `id` */
    rowId: string;
    /** ファイルのパス（設定ファイルのフォルダからの相対パス。区切りは `/`） */
    path: string;
    /** ファイルを YAML として読み込んだ値 */
    data: unknown;
};
/** `buildAliases` が返却する、使用できなかった行・レコードのずれ 1 件 */
export type MdmarkAliasProblem = {
    /** ずれのあるファイル。行のずれは `configFile`、レコードのずれはそのレコードのファイルの `path` */
    file: string;
    /** 行のずれは設定のキーのパス（`aliases[1].id`）、レコードのずれはファイルの中のパス。ファイル全体のずれは空文字 */
    where: string;
    /** ずれの種類 */
    kind: "duplicate_alias_row_id" | "alias_records_missing" | "alias_field_missing" | "alias_unknown_type" | "alias_required_empty" | "duplicate_alias_id";
    /** ずれの内容と修正方法の日本語の 1 文 */
    message: string;
};
/** `readAliasRecord` が返却する、キーごとの値 */
type AliasValues = Partial<Record<(typeof ALIAS_KEYS)[number], string | string[]>>;
/** 1 つのレコードに行の `metadata` を適用して、エイリアスのキーごとの値と、`metadata` に記載した列が無いキーを返却する */
export declare function readAliasRecord(options: {
    /** レコード */
    record: Record<string, unknown>;
    /** 行の `metadata`（無い行は空のオブジェクト） */
    metadata: Record<string, unknown>;
    /** 行の `body_file` */
    bodyFile?: string;
    /** `name` が無いときの名前 */
    fallbackName: string;
}): {
    values: AliasValues;
    missing: Array<{
        key: string;
        field: string;
    }>;
};
/** 行の種類の必須のキーが空でないかを確認し、ずれを返却する。無ければ `undefined` */
export declare function checkAliasFields(options: {
    /** 行の `alias_type` */
    aliasType: (typeof ALIAS_TYPES)[number];
    /** `readAliasRecord` の `values` */
    values: AliasValues;
}): {
    kind: "alias_required_empty";
    keys: string[];
} | undefined;
/** 照合に使用できるエイリアスだけを並びの順に返却する（`env`・知らない種類・必須のキーが空・前と同じ `id` を除く） */
export declare function usableAliases(aliases: readonly unknown[]): MdmarkAlias[];
/** 設定の `aliases` の行と、行の `paths` に該当した YAML を読み込んだ中身から、`metadata` を適用したエイリアスの並びと、使用できない行・レコードのずれの一覧を返却する */
export declare function buildAliases(input: {
    /** 設定の `aliases` の行 */
    rows: unknown[];
    /** 行の `paths` に該当したファイルの中身 */
    sources: MdmarkAliasSource[];
    /** 行のずれの `file` に出す設定ファイルの名前 */
    configFile?: string;
}): {
    aliases: MdmarkAlias[];
    problems: MdmarkAliasProblem[];
};
export {};
