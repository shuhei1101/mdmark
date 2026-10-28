/** `buildAliases` が受け付ける `alias_type` の値。`env` を含む */
export const ALIAS_TYPES = [
  "term",
  "doc",
  "command",
  "url",
  "skill",
  "tool",
  "path",
  "env",
  "avoid",
] as const;

/** `MdmarkAlias` の `alias_type` の値。`env` は `buildAliases` が作らないため含めない */
export type MdmarkAliasType = Exclude<(typeof ALIAS_TYPES)[number], "env">;

/** `readAliasRecord` がレコードから取るキー。`port` は `env` の必須の確かめにだけ使う */
export const ALIAS_KEYS = [
  "alias_type",
  "id",
  "name",
  "aliases",
  "description",
  "related",
  "command",
  "cwd",
  "url",
  "avoid",
  "skill",
  "tool",
  "path",
  "port",
  "replacement",
] as const;

/** `id`・`name` のほかに、種類ごとに空にできないキー。`env` は `url` と `port` の 1 つ以上で、`checkAliasFields` が別に確かめる */
export const ALIAS_REQUIRED_KEYS: Record<
  (typeof ALIAS_TYPES)[number],
  readonly (typeof ALIAS_KEYS)[number][]
> = {
  term: ["description"],
  doc: ["description"],
  command: ["command"],
  url: ["url"],
  skill: ["skill"],
  tool: ["tool"],
  path: ["path"],
  avoid: ["replacement"],
  env: [],
};

/** `alias_required_empty` の `message` の直し方に出すキーの名前 */
export const ALIAS_KEY_LABELS: Record<string, string> = {
  id: "ID",
  name: "名前",
  description: "説明",
  command: "コマンド",
  url: "URL",
  skill: "スキル名",
  tool: "ツール名",
  path: "パス",
  replacement: "置き換え先",
};

/** 設定の行の `metadata` を当てて作ったエイリアス 1 件。値の無いキーは持たない（`aliases` だけは空の並びでも持つ） */
export type MdmarkAlias = {
  /** エイリアスの種類。ツールチップの区分と照合したときの扱いを決める */
  alias_type: MdmarkAliasType;
  /** エイリアスの ID。渡したエイリアスの中で一意 */
  id: string;
  /** 照合する語で、ツールチップに出す名前。`avoid` の種類ではやめた言い方 */
  name: string;
  /** 名前と同じく照合する語 */
  aliases: string[];
  /** ツールチップの説明 */
  description?: string;
  /** `term` の関連する語。受け取るだけで使わない */
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
  /** `avoid` の種類の置き換え先の語 */
  replacement?: string;
};

/** 行の `paths` に当たったファイルを YAML として読んだ中身 1 つ */
export type MdmarkAliasSource = {
  /** そのファイルを指した行の `id` */
  rowId: string;
  /** ファイルのパス（設定ファイルのフォルダからの相対パス。区切りは `/`） */
  path: string;
  /** ファイルを YAML として読んだ値 */
  data: unknown;
};

/** `buildAliases` が返す、使えなかった行・レコードのずれ 1 件 */
export type MdmarkAliasProblem = {
  /** ずれのあるファイル。行のずれは `configFile`、レコードのずれはそのレコードのファイルの `path` */
  file: string;
  /** 行のずれは設定のキーのパス（`aliases[1].id`）、レコードのずれはファイルの中のパス。ファイル全体のずれは空文字 */
  where: string;
  /** ずれの種類 */
  kind:
    | "duplicate_alias_row_id"
    | "alias_records_missing"
    | "alias_field_missing"
    | "alias_unknown_type"
    | "alias_required_empty"
    | "duplicate_alias_id";
  /** ずれの内容と直し方の日本語の 1 文 */
  message: string;
};

/** `readAliasRecord` が返す、キーごとの値 */
type AliasValues = Partial<
  Record<(typeof ALIAS_KEYS)[number], string | string[]>
>;

/** 並びで持つキー */
const LIST_KEYS = new Set<string>(["aliases", "avoid", "related"]);

/** 設定ファイルの既定の名前 */
const DEFAULT_CONFIG_FILE = "mdmark.config.yaml";

/** 値がオブジェクト（配列を除く）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値が空でない文字列か */
function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** 文字列・数・真偽値を、前後の空白を除いた文字列にする。それ以外の値と空文字は `undefined` */
function toText(value: unknown): string | undefined {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return undefined;
  }
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

/** 文字列なら 1 件の並びに、並びなら文字列の要素だけを残す。それ以外の値と空の並びは `undefined` */
function toList(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    const text = value.trim();
    return text === "" ? undefined : [text];
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  }
  return undefined;
}

/** 1 つのレコードに行の `metadata` を当てて、エイリアスのキーごとの値と、`ref` の列が無いキーを返す */
export function readAliasRecord(options: {
  /** レコード */
  record: Record<string, unknown>;
  /** 行の `metadata` */
  metadata: Record<string, unknown>;
  /** `name` が無いときの名前 */
  fallbackName: string;
}): {
  values: AliasValues;
  missing: Array<{ key: string; field: string }>;
} {
  const { record, metadata, fallbackName } = options;
  const values: AliasValues = {};
  const missing: Array<{ key: string; field: string }> = [];
  for (const key of ALIAS_KEYS) {
    const rule = metadata[key];
    let raw: unknown;
    let present = false;
    if (
      isRecord(rule) &&
      rule.type === "ref" &&
      typeof rule.field === "string"
    ) {
      if (Object.hasOwn(record, rule.field)) {
        raw = record[rule.field];
        present = true;
      } else {
        missing.push({ key, field: rule.field });
      }
    } else if (isRecord(rule) && rule.type === "custom") {
      raw = rule.value;
      present = true;
    } else if (Object.hasOwn(record, key)) {
      raw = record[key];
      present = true;
    }
    if (!present) {
      continue;
    }
    if (LIST_KEYS.has(key)) {
      const list = toList(raw);
      if (list !== undefined) {
        values[key] = list;
      }
    } else {
      const text = toText(raw);
      if (text !== undefined) {
        values[key] = text;
      }
    }
  }
  if (values.name === undefined && fallbackName !== "") {
    values.name = fallbackName;
  }
  return { values, missing };
}

/** レコードから取った値の種類と必須のキーを確かめ、ずれを返す。無ければ `undefined` */
export function checkAliasFields(
  values: AliasValues,
):
  | { kind: "alias_unknown_type"; value: string }
  | { kind: "alias_required_empty"; keys: string[] }
  | undefined {
  const type = values.alias_type;
  const known = ALIAS_TYPES.find((candidate) => candidate === type);
  if (known === undefined) {
    return {
      kind: "alias_unknown_type",
      value: typeof type === "string" ? type : "",
    };
  }
  const keys: string[] = ["id", "name", ...ALIAS_REQUIRED_KEYS[known]].filter(
    (key) => !isFilled(values[key as (typeof ALIAS_KEYS)[number]]),
  );
  if (known === "env" && !isFilled(values.url) && !isFilled(values.port)) {
    keys.push("url");
  }
  return keys.length === 0 ? undefined : { kind: "alias_required_empty", keys };
}

/** 照合に使えるエイリアスだけを並びの順に返す（`env`・知らない種類・必須のキーが空・前と同じ `id` を除く） */
export function usableAliases(aliases: readonly unknown[]): MdmarkAlias[] {
  const seen = new Set<string>();
  const usable: MdmarkAlias[] = [];
  for (const item of aliases) {
    if (!isRecord(item)) {
      continue;
    }
    const type = ALIAS_TYPES.find((candidate) => candidate === item.alias_type);
    if (type === undefined || type === "env") {
      continue;
    }
    if (!isFilled(item.id) || !isFilled(item.name) || seen.has(item.id)) {
      continue;
    }
    if (!ALIAS_REQUIRED_KEYS[type].every((key) => isFilled(item[key]))) {
      continue;
    }
    seen.add(item.id);
    const list = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter(isFilled) : [];
    const alias: MdmarkAlias = {
      alias_type: type,
      id: item.id,
      name: item.name,
      aliases: list(item.aliases),
      avoid: list(item.avoid),
    };
    for (const key of [
      "description",
      "command",
      "cwd",
      "url",
      "skill",
      "tool",
      "path",
      "replacement",
    ] as const) {
      if (typeof item[key] === "string") {
        alias[key] = item[key];
      }
    }
    if (Array.isArray(item.related)) {
      alias.related = list(item.related);
    }
    usable.push(alias);
  }
  return usable;
}

/** 検めて残した値から、エイリアス 1 件を作る */
function toAlias(values: AliasValues): MdmarkAlias {
  const text = (key: (typeof ALIAS_KEYS)[number]): string | undefined =>
    typeof values[key] === "string" ? (values[key] as string) : undefined;
  const list = (key: (typeof ALIAS_KEYS)[number]): string[] | undefined =>
    Array.isArray(values[key]) ? (values[key] as string[]) : undefined;
  const alias: MdmarkAlias = {
    alias_type: values.alias_type as MdmarkAliasType,
    id: values.id as string,
    name: values.name as string,
    aliases: list("aliases") ?? [],
  };
  for (const key of [
    "description",
    "command",
    "cwd",
    "url",
    "skill",
    "tool",
    "path",
    "replacement",
  ] as const) {
    const value = text(key);
    if (value !== undefined) {
      alias[key] = value;
    }
  }
  const related = list("related");
  if (related !== undefined) {
    alias.related = related;
  }
  const avoid = list("avoid");
  if (avoid !== undefined) {
    alias.avoid = avoid;
  }
  return alias;
}

/** パスの最後の名前から拡張子を除いたもの */
function baseName(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** レコードのパスにキーを `.` で続ける。レコードのパスが空ならキーだけ */
function joinWhere(recordPath: string, key: string): string {
  return recordPath === "" ? key : `${recordPath}.${key}`;
}

/** 設定の `aliases` の行と、行の `paths` に当たった YAML を読んだ中身から、`metadata` を当てたエイリアスの並びと、使えない行・レコードのずれの一覧を返す */
export function buildAliases(input: {
  /** 設定の `aliases` の行 */
  rows: unknown[];
  /** 行の `paths` に当たったファイルの中身 */
  sources: MdmarkAliasSource[];
  /** 行のずれの `file` に出す設定ファイルの名前 */
  configFile?: string;
}): { aliases: MdmarkAlias[]; problems: MdmarkAliasProblem[] } {
  const { rows, sources, configFile = DEFAULT_CONFIG_FILE } = input;
  const aliases: MdmarkAlias[] = [];
  const problems: MdmarkAliasProblem[] = [];
  const rowIds = new Set<string>();
  const aliasIds = new Set<string>();
  rows.forEach((row, rowPosition) => {
    if (
      !isRecord(row) ||
      !isFilled(row.id) ||
      !Array.isArray(row.paths) ||
      !isRecord(row.metadata) ||
      !Object.hasOwn(row.metadata, "alias_type")
    ) {
      return;
    }
    if (row.enabled === false) {
      return;
    }
    if (rowIds.has(row.id)) {
      problems.push({
        file: configFile,
        where: `aliases[${rowPosition}].id`,
        kind: "duplicate_alias_row_id",
        message: `行の \`id\` \`${row.id}\` が前の行と同じです。\`id\` を変えてください。`,
      });
      return;
    }
    rowIds.add(row.id);
    const metadata = row.metadata;
    const recordsKey = isFilled(row.records) ? row.records : undefined;
    /** `metadata` で `ref` の列を取るキーは列の名前、それ以外はエイリアスのキー */
    const columnOf = (key: string): string => {
      const rule = metadata[key];
      return isRecord(rule) &&
        rule.type === "ref" &&
        typeof rule.field === "string"
        ? rule.field
        : key;
    };
    for (const source of sources.filter((item) => item.rowId === row.id)) {
      let records: Array<{ record: unknown; path: string }>;
      if (recordsKey === undefined) {
        records = [{ record: source.data, path: "" }];
      } else {
        const list = isRecord(source.data)
          ? source.data[recordsKey]
          : undefined;
        if (!Array.isArray(list)) {
          problems.push({
            file: source.path,
            where: "",
            kind: "alias_records_missing",
            message: `\`${recordsKey}\` の配列がありません。ファイルに \`${recordsKey}\` の配列を記載するか、\`records\` を直してください。`,
          });
          continue;
        }
        records = list.map((record, position) => ({
          record,
          path: `${recordsKey}[${position}]`,
        }));
      }
      for (const { record, path } of records) {
        if (!isRecord(record)) {
          continue;
        }
        const fallbackName =
          recordsKey === undefined
            ? baseName(source.path)
            : (toText(record.id) ?? "");
        const { values, missing } = readAliasRecord({
          record,
          metadata,
          fallbackName,
        });
        for (const { key, field } of missing) {
          problems.push({
            file: source.path,
            where: joinWhere(path, field),
            kind: "alias_field_missing",
            message: `\`metadata.${key}\` が指す列 \`${field}\` がレコードにありません。列を記載するか、\`metadata.${key}\` を直してください。`,
          });
        }
        if (missing.length > 0) {
          continue;
        }
        const checked = checkAliasFields(values);
        if (checked?.kind === "alias_unknown_type") {
          problems.push({
            file: source.path,
            where: joinWhere(path, columnOf("alias_type")),
            kind: "alias_unknown_type",
            message: `\`alias_type\` の \`${checked.value}\` は種類にありません。\`term\`・\`doc\`・\`command\`・\`url\`・\`skill\`・\`tool\`・\`path\`・\`env\`・\`avoid\` のどれかにしてください。`,
          });
          continue;
        }
        if (checked?.kind === "alias_required_empty") {
          const head =
            path === ""
              ? `\`${source.path}\``
              : `\`${source.path}\` の \`${path}\``;
          for (const key of checked.keys) {
            const column = columnOf(key);
            const sentence =
              key === "url" && values.alias_type === "env"
                ? `${head} の \`url\` と \`port\` が両方空です。URL かポートを記載してください。`
                : `${head} の \`${column}\` が空です。${ALIAS_KEY_LABELS[key] ?? key}を記載してください。`;
            problems.push({
              file: source.path,
              where: joinWhere(path, column),
              kind: "alias_required_empty",
              message: sentence,
            });
          }
          continue;
        }
        const id = values.id as string;
        if (aliasIds.has(id)) {
          problems.push({
            file: source.path,
            where: joinWhere(path, columnOf("id")),
            kind: "duplicate_alias_id",
            message: `エイリアスの \`id\` \`${id}\` が前のエイリアスと同じです。\`id\` を変えてください。`,
          });
          continue;
        }
        aliasIds.add(id);
        if (values.alias_type !== "env") {
          aliases.push(toAlias(values));
        }
      }
    }
  });
  return { aliases, problems };
}
