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

/** `readAliasRecord` がレコードから取るキー。`port` は `env` の必須の確認にだけ使用する */
export const ALIAS_KEYS = [
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

/** `id`・`name` のほかに、種類ごとに空にできないキー。`env` は `url` と `port` の 1 つ以上で、`checkAliasFields` が別に確認する */
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

/** `alias_required_empty` の `message` の修正方法に出すキーの名前 */
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
  kind:
    | "duplicate_alias_row_id"
    | "alias_records_missing"
    | "alias_field_missing"
    | "alias_unknown_type"
    | "alias_required_empty"
    | "duplicate_alias_id";
  /** ずれの内容と修正方法の日本語の 1 文 */
  message: string;
};

/** `readAliasRecord` が返却する、キーごとの値 */
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

/** 列名を `.` で分けてレコードの入れ子の列をたどる。たどれなければ `found` が `false` */
function readColumn(
  record: Record<string, unknown>,
  column: string,
): { found: boolean; value: unknown } {
  let current: unknown = record;
  for (const part of column.split(".")) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

/** レコードからキー 1 つの値を取る。`metadata` に列名を記載したキーはその列、それ以外はキーの名前の列。列を記載したのに無ければ `missing` に列名 */
function readAliasKey(options: {
  record: Record<string, unknown>;
  column: unknown;
  key: string;
}): { present: boolean; raw?: unknown; missing?: string } {
  const { record, column, key } = options;
  if (isFilled(column)) {
    const read = readColumn(record, column);
    return read.found
      ? { present: true, raw: read.value }
      : { present: false, missing: column };
  }
  return Object.hasOwn(record, key)
    ? { present: true, raw: record[key] }
    : { present: false };
}

/** 並びで持つキーは並びに、それ以外は文字列にする（合わない値は `undefined`） */
function toAliasValue(
  key: string,
  raw: unknown,
): string | string[] | undefined {
  return LIST_KEYS.has(key) ? toList(raw) : toText(raw);
}

/** `name` が無いときの名前: `body_file` の列のパスの最後の名前、無ければ `fallbackName` */
function nameOf(options: {
  record: Record<string, unknown>;
  bodyFile: string | undefined;
  fallbackName: string;
}): string {
  const { record, bodyFile, fallbackName } = options;
  const bodyPath =
    bodyFile === undefined
      ? undefined
      : toText(readColumn(record, bodyFile).value);
  return bodyPath === undefined ? fallbackName : baseName(bodyPath);
}

/** 1 つのレコードに行の `metadata` を適用して、エイリアスのキーごとの値と、`metadata` に記載した列が無いキーを返却する */
export function readAliasRecord(options: {
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
  missing: Array<{ key: string; field: string }>;
} {
  const { record, metadata, bodyFile, fallbackName } = options;
  const values: AliasValues = {};
  const missing: Array<{ key: string; field: string }> = [];
  for (const key of ALIAS_KEYS) {
    const read = readAliasKey({ record, column: metadata[key], key });
    if (read.missing !== undefined) {
      missing.push({ key, field: read.missing });
    }
    const value = read.present ? toAliasValue(key, read.raw) : undefined;
    if (value !== undefined) {
      values[key] = value;
    }
  }
  if (values.name === undefined) {
    const name = nameOf({ record, bodyFile, fallbackName });
    if (name !== "") {
      values.name = name;
    }
  }
  return { values, missing };
}

/** 行の種類の必須のキーが空でないかを確認し、ずれを返却する。無ければ `undefined` */
export function checkAliasFields(options: {
  /** 行の `alias_type` */
  aliasType: (typeof ALIAS_TYPES)[number];
  /** `readAliasRecord` の `values` */
  values: AliasValues;
}): { kind: "alias_required_empty"; keys: string[] } | undefined {
  const { aliasType, values } = options;
  const keys: string[] = [
    "id",
    "name",
    ...ALIAS_REQUIRED_KEYS[aliasType],
  ].filter((key) => !isFilled(values[key as (typeof ALIAS_KEYS)[number]]));
  if (aliasType === "env" && !isFilled(values.url) && !isFilled(values.port)) {
    keys.push("url");
  }
  return keys.length === 0 ? undefined : { kind: "alias_required_empty", keys };
}

/** 照合に使用できるエイリアスの行なら、その種類（`env`・知らない種類・必須のキーが空・前と同じ `id` は `undefined`） */
function usableType(
  item: Record<string, unknown>,
  seen: Set<string>,
): MdmarkAliasType | undefined {
  const type = ALIAS_TYPES.find((candidate) => candidate === item.alias_type);
  if (type === undefined || type === "env") {
    return undefined;
  }
  if (!isFilled(item.id) || !isFilled(item.name) || seen.has(item.id)) {
    return undefined;
  }
  return ALIAS_REQUIRED_KEYS[type].every((key) => isFilled(item[key]))
    ? type
    : undefined;
}

/** 照合に使用できる行から、エイリアス 1 件を作る */
function toUsableAlias(
  item: Record<string, unknown> & { id: string; name: string },
  type: MdmarkAliasType,
): MdmarkAlias {
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
    const value = item[key];
    if (typeof value === "string") {
      alias[key] = value;
    }
  }
  if (Array.isArray(item.related)) {
    alias.related = list(item.related);
  }
  return alias;
}

/** 照合に使用できるエイリアスだけを並びの順に返却する（`env`・知らない種類・必須のキーが空・前と同じ `id` を除く） */
export function usableAliases(aliases: readonly unknown[]): MdmarkAlias[] {
  const seen = new Set<string>();
  const usable: MdmarkAlias[] = [];
  for (const item of aliases) {
    const type = isRecord(item) ? usableType(item, seen) : undefined;
    if (!isRecord(item) || type === undefined) {
      continue;
    }
    const row = item as Record<string, unknown> & { id: string; name: string };
    seen.add(row.id);
    usable.push(toUsableAlias(row, type));
  }
  return usable;
}

/** 検めて残した値と行の種類から、エイリアス 1 件を作る */
function toAlias(values: AliasValues, aliasType: MdmarkAliasType): MdmarkAlias {
  const text = (key: (typeof ALIAS_KEYS)[number]): string | undefined =>
    typeof values[key] === "string" ? (values[key] as string) : undefined;
  const list = (key: (typeof ALIAS_KEYS)[number]): string[] | undefined =>
    Array.isArray(values[key]) ? (values[key] as string[]) : undefined;
  const alias: MdmarkAlias = {
    alias_type: aliasType,
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

/** `buildAliases` が積み上げるエイリアス・ずれと、見た行とエイリアスの `id` */
type AliasBuild = {
  aliases: MdmarkAlias[];
  problems: MdmarkAliasProblem[];
  rowIds: Set<string>;
  aliasIds: Set<string>;
  configFile: string;
};

/** 使用できる `aliases` の行の、レコードを読み込むための値 */
type AliasRow = {
  id: string;
  aliasType: (typeof ALIAS_TYPES)[number];
  metadata: Record<string, unknown>;
  recordsKey: string | undefined;
  bodyFile: string | undefined;
};

/** `metadata` に列名を記載したキーは列名、それ以外はエイリアスのキー */
function columnOf(row: AliasRow, key: string): string {
  const column = row.metadata[key];
  return isFilled(column) ? column : key;
}

/** `id`・`paths`・`alias_type` を持ち、`enabled: false` でない行か */
function isEnabledRow(row: unknown): row is Record<string, unknown> & {
  id: string;
  alias_type: string;
} {
  return (
    isRecord(row) &&
    isFilled(row.id) &&
    Array.isArray(row.paths) &&
    typeof row.alias_type === "string" &&
    row.enabled !== false
  );
}

/** 設定の `aliases` の行を読み込む。形の合わない行・`enabled: false` の行は `undefined`、前と同じ `id`・知らない種類の行はずれを加えて `undefined` */
function acceptRow(
  build: AliasBuild,
  row: unknown,
  rowPosition: number,
): AliasRow | undefined {
  if (!isEnabledRow(row)) {
    return undefined;
  }
  if (build.rowIds.has(row.id)) {
    build.problems.push({
      file: build.configFile,
      where: `aliases[${rowPosition}].id`,
      kind: "duplicate_alias_row_id",
      message: `行の \`id\` \`${row.id}\` が前の行と同じです。\`id\` を変えてください。`,
    });
    return undefined;
  }
  build.rowIds.add(row.id);
  const aliasType = ALIAS_TYPES.find(
    (candidate) => candidate === row.alias_type,
  );
  if (aliasType === undefined) {
    build.problems.push({
      file: build.configFile,
      where: `aliases[${rowPosition}].alias_type`,
      kind: "alias_unknown_type",
      message: `\`alias_type\` の \`${row.alias_type}\` は種類にありません。\`term\`・\`doc\`・\`command\`・\`url\`・\`skill\`・\`tool\`・\`path\`・\`env\`・\`avoid\` のどれかにしてください。`,
    });
    return undefined;
  }
  return {
    id: row.id,
    aliasType,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    recordsKey: isFilled(row.records) ? row.records : undefined,
    bodyFile: isFilled(row.body_file) ? row.body_file : undefined,
  };
}

/** ファイルの中身のレコードと、レコードのパス。`records` の配列が無ければずれを加えて `undefined` */
function recordsOf(
  build: AliasBuild,
  row: AliasRow,
  source: MdmarkAliasSource,
): Array<{ record: unknown; path: string }> | undefined {
  const { recordsKey } = row;
  if (recordsKey === undefined) {
    return [{ record: source.data, path: "" }];
  }
  const list = isRecord(source.data) ? source.data[recordsKey] : undefined;
  if (!Array.isArray(list)) {
    build.problems.push({
      file: source.path,
      where: "",
      kind: "alias_records_missing",
      message: `\`${recordsKey}\` の配列がありません。ファイルに \`${recordsKey}\` の配列を記載するか、\`records\` を修正してください。`,
    });
    return undefined;
  }
  return list.map((record, position) => ({
    record,
    path: `${recordsKey}[${position}]`,
  }));
}

/** 必須のキーが空のずれを、空のキーごとに加える */
function pushRequiredProblems(
  build: AliasBuild,
  row: AliasRow,
  at: { source: MdmarkAliasSource; path: string; keys: string[] },
): void {
  const { source, path, keys } = at;
  const head =
    path === "" ? `\`${source.path}\`` : `\`${source.path}\` の \`${path}\``;
  for (const key of keys) {
    const column = columnOf(row, key);
    const sentence =
      key === "url" && row.aliasType === "env"
        ? `${head} の \`url\` と \`port\` が両方空です。URL かポートを記載してください。`
        : `${head} の \`${column}\` が空です。${ALIAS_KEY_LABELS[key] ?? key}を記載してください。`;
    build.problems.push({
      file: source.path,
      where: joinWhere(path, column),
      kind: "alias_required_empty",
      message: sentence,
    });
  }
}

/** レコード 1 つに行の `metadata` を適用して、エイリアスを加える。列が無い・必須のキーが空・前と同じ `id` のレコードは、ずれを加えて飛ばす */
function takeRecord(
  build: AliasBuild,
  row: AliasRow,
  at: {
    source: MdmarkAliasSource;
    record: Record<string, unknown>;
    path: string;
  },
): void {
  const { source, record, path } = at;
  const fallbackName =
    row.recordsKey === undefined
      ? baseName(source.path)
      : (toText(record.id) ?? "");
  const { values, missing } = readAliasRecord({
    record,
    metadata: row.metadata,
    bodyFile: row.bodyFile,
    fallbackName,
  });
  for (const { key, field } of missing) {
    build.problems.push({
      file: source.path,
      where: joinWhere(path, field),
      kind: "alias_field_missing",
      message: `\`metadata.${key}\` が指す列 \`${field}\` がレコードにありません。列を記載するか、\`metadata.${key}\` を修正してください。`,
    });
  }
  if (missing.length > 0) {
    return;
  }
  const checked = checkAliasFields({ aliasType: row.aliasType, values });
  if (checked !== undefined) {
    pushRequiredProblems(build, row, { source, path, keys: checked.keys });
    return;
  }
  const id = values.id as string;
  if (build.aliasIds.has(id)) {
    build.problems.push({
      file: source.path,
      where: joinWhere(path, columnOf(row, "id")),
      kind: "duplicate_alias_id",
      message: `エイリアスの \`id\` \`${id}\` が前のエイリアスと同じです。\`id\` を変えてください。`,
    });
    return;
  }
  build.aliasIds.add(id);
  if (row.aliasType !== "env") {
    build.aliases.push(toAlias(values, row.aliasType));
  }
}

/** 設定の `aliases` の行と、行の `paths` に該当した YAML を読み込んだ中身から、`metadata` を適用したエイリアスの並びと、使用できない行・レコードのずれの一覧を返却する */
export function buildAliases(input: {
  /** 設定の `aliases` の行 */
  rows: unknown[];
  /** 行の `paths` に該当したファイルの中身 */
  sources: MdmarkAliasSource[];
  /** 行のずれの `file` に出す設定ファイルの名前 */
  configFile?: string;
}): { aliases: MdmarkAlias[]; problems: MdmarkAliasProblem[] } {
  const { rows, sources, configFile = DEFAULT_CONFIG_FILE } = input;
  const build: AliasBuild = {
    aliases: [],
    problems: [],
    rowIds: new Set(),
    aliasIds: new Set(),
    configFile,
  };
  rows.forEach((item, rowPosition) => {
    const row = acceptRow(build, item, rowPosition);
    if (!row) {
      return;
    }
    for (const source of sources.filter((entry) => entry.rowId === row.id)) {
      for (const { record, path } of recordsOf(build, row, source) ?? []) {
        if (isRecord(record)) {
          takeRecord(build, row, { source, record, path });
        }
      }
    }
  });
  return { aliases: build.aliases, problems: build.problems };
}
