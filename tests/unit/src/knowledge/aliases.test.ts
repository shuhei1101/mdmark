import { expect, test } from "vitest";

/** エイリアスを作る処理を読み込む（ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む。実装が無い間は各テストが個別に失敗する） */
const loadAliases = (): Promise<
  typeof import("../../../../src/knowledge/aliases.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/knowledge/aliases.ts",
      import.meta.url,
    ).href
  );

/** 用語のレコードを `terms` の配列から作る行 */
const TERMS_ROW = {
  id: "terms",
  paths: ["terms/*.yaml"],
  records: "terms",
  metadata: {
    alias_type: { type: "custom", value: "term" },
    name: { type: "ref", field: "term" },
    description: { type: "ref", field: "meaning" },
  },
};

/** `TERMS_ROW` が読むファイル（`aliases` は文字列で書く） */
const TERMS_SOURCE = {
  rowId: "terms",
  path: "terms/glossary.yaml",
  data: {
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        aliases: "WS",
        meaning: "話し合いの記録を置くフォルダ",
      },
    ],
  },
};

/** コマンドのファイル 1 つを 1 件にする行 */
const COMMANDS_ROW = {
  id: "commands",
  paths: ["commands/unit-test.yaml"],
  metadata: { alias_type: { type: "custom", value: "command" } },
};

/** `COMMANDS_ROW` が読むファイル（`name` を持たない） */
const COMMANDS_SOURCE = {
  rowId: "commands",
  path: "commands/unit-test.yaml",
  data: {
    id: "unit-test",
    description: "ライブラリ本体の単体テストを流す",
    command: "npm run test:unit",
  },
};

/** 行の `metadata` を `alias_type` だけ固定の値にした、ファイル 1 つを 1 件にする行 */
function customRow(
  id: string,
  aliasType: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    paths: [`${id}/*.yaml`],
    metadata: { alias_type: { type: "custom", value: aliasType } },
    ...extra,
  };
}

// records を持つ行と持たない行から、metadata を当てたエイリアスを並びの順に作り、env と読まない行を除く（正常系）
test("test_build_aliases", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [
    TERMS_ROW,
    COMMANDS_ROW,
    { ...customRow("off", "term"), enabled: false },
    customRow("servers", "env"),
  ];
  const sources = [
    TERMS_SOURCE,
    COMMANDS_SOURCE,
    {
      rowId: "servers",
      path: "servers/dev.yaml",
      data: { id: "dev-server", url: "http://127.0.0.1:8767/", port: 8767 },
    },
    {
      rowId: "off",
      path: "off/memo.yaml",
      data: { id: "memo", name: "メモ", description: "読まない" },
    },
  ];
  const before = structuredClone({ rows, sources });
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases).toHaveLength(2);
  expect(result.aliases[0]).toMatchObject({
    alias_type: "term",
    id: "ws",
    name: "ワークスペース",
    aliases: ["WS"],
    description: "話し合いの記録を置くフォルダ",
  });
  expect(result.aliases[1]).toMatchObject({
    alias_type: "command",
    id: "unit-test",
    name: "unit-test",
    description: "ライブラリ本体の単体テストを流す",
    command: "npm run test:unit",
  });
  const ids = result.aliases.map((alias) => alias.id);
  expect(ids).not.toContain("dev-server");
  expect(ids).not.toContain("memo");
  expect(result.problems).toEqual([]);
  expect({ rows, sources }).toEqual(before);
});

// 使えない行とレコードを除いてずれにし、残りからエイリアスを作る（正常系）
test("test_build_aliases_when_invalid_rows", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [
    TERMS_ROW,
    // 1: records のキーがファイルに無い
    customRow("no-records", "term", { records: "items" }),
    // 2: description を取る列 missing_col がレコードに無い
    {
      ...customRow("no-column", "term"),
      metadata: {
        alias_type: { type: "custom", value: "term" },
        description: { type: "ref", field: "missing_col" },
      },
    },
    // 3: alias_type を列から取り、値が種類に無い
    {
      ...customRow("unknown-type", "term"),
      metadata: { alias_type: { type: "ref", field: "alias_type" } },
    },
    // 4: command が空
    customRow("empty-command", "command"),
    // 5: 行の id が terms と同じ
    customRow("terms", "term"),
    // 6: エイリアスの id が terms のレコード ws と同じ
    customRow("dup-alias", "term"),
  ];
  const sources = [
    TERMS_SOURCE,
    { rowId: "no-records", path: "no-records/a.yaml", data: { other: [] } },
    {
      rowId: "no-column",
      path: "no-column/a.yaml",
      data: { id: "no-column", name: "列なし" },
    },
    {
      rowId: "unknown-type",
      path: "unknown-type/a.yaml",
      data: { id: "memo-1", name: "メモ", alias_type: "memo" },
    },
    {
      rowId: "empty-command",
      path: "empty-command/a.yaml",
      data: { id: "build", name: "ビルド", command: "" },
    },
    {
      rowId: "dup-alias",
      path: "dup-alias/a.yaml",
      data: { id: "ws", name: "別のワークスペース", description: "重なる" },
    },
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases.map((alias) => alias.id)).toEqual(["ws"]);
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "alias_records_missing",
    "alias_field_missing",
    "alias_unknown_type",
    "alias_required_empty",
    "duplicate_alias_row_id",
    "duplicate_alias_id",
  ]);
  const rowIdProblem = result.problems[4];
  expect(rowIdProblem?.file).toBe("mdmark.config.yaml");
  expect(rowIdProblem?.where).toBe("aliases[5].id");
  const emptyProblem = result.problems[3];
  expect(emptyProblem?.file).toBe("empty-command/a.yaml");
  expect(emptyProblem?.where).toBe("command");
  expect(emptyProblem?.message).toContain("command");
  expect(emptyProblem?.message).toContain("記載してください");
});

// id・paths・metadata.alias_type を持たない行と、オブジェクトでない行をずれにせずに飛ばす（正常系）
test("test_build_aliases_when_rows_not_usable", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [
    null,
    "terms",
    { id: "no-metadata", paths: ["a.yaml"] },
    { ...TERMS_ROW, id: "" },
    TERMS_ROW,
  ];
  const sources = [
    { rowId: "other", path: "other/a.yaml", data: { id: "x", name: "X" } },
    TERMS_SOURCE,
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases.map((alias) => alias.id)).toEqual(["ws"]);
  expect(result.problems).toEqual([]);
});

// 数・真偽値を文字列にし、前後の空白を除き、別名を並びにする（正常系）
test("test_build_aliases_when_values_coerced", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [customRow("cmds", "command", { records: "items" })];
  const sources = [
    {
      rowId: "cmds",
      path: "cmds/a.yaml",
      data: {
        items: [
          {
            id: 42,
            name: " 単体テスト ",
            aliases: ["ユニットテスト", 3, null],
            command: true,
          },
        ],
      },
    },
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.problems).toEqual([]);
  expect(result.aliases).toHaveLength(1);
  expect(result.aliases[0]).toMatchObject({
    id: "42",
    name: "単体テスト",
    aliases: ["ユニットテスト"],
    command: "true",
  });
});

// name が空のとき、records を持つ行はレコードの id、持たない行はファイル名から拡張子を除いたものにする（正常系）
test("test_build_aliases_when_name_missing", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [
    customRow("with-records", "term", { records: "terms" }),
    customRow("commands", "command"),
  ];
  const sources = [
    {
      rowId: "with-records",
      path: "with-records/a.yaml",
      data: {
        terms: [{ id: "ws", description: "話し合いの記録を置くフォルダ" }],
      },
    },
    // `name` を持たないコマンドのファイル 1 つが 1 件になる
    COMMANDS_SOURCE,
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.problems).toEqual([]);
  expect(result.aliases.map((alias) => alias.name)).toEqual([
    "ws",
    "unit-test",
  ]);
});

// ref の列が無いレコードは、無い列ごとにずれにし、種類と必須のキーを確かめない（正常系）
test("test_build_aliases_when_fields_missing", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [
    {
      ...customRow("cmds", "command"),
      metadata: {
        alias_type: { type: "custom", value: "command" },
        description: { type: "ref", field: "meaning" },
        command: { type: "ref", field: "cmd" },
      },
    },
  ];
  const sources = [
    { rowId: "cmds", path: "cmds/a.yaml", data: { id: "a", name: "A" } },
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases).toEqual([]);
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "alias_field_missing",
    "alias_field_missing",
  ]);
  expect(result.problems.map((problem) => problem.where)).toEqual([
    "meaning",
    "cmd",
  ]);
});

// env の url と port が両方空なら 1 件のずれにし、env を aliases に入れない（正常系）
test("test_build_aliases_when_env_has_no_url_and_port", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [customRow("servers", "env")];
  const sources = [
    { rowId: "servers", path: "servers/a.yaml", data: { id: "a", name: "A" } },
    {
      rowId: "servers",
      path: "servers/b.yaml",
      data: { id: "b", name: "B", port: 8767 },
    },
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases).toEqual([]);
  expect(result.problems).toHaveLength(1);
  const problem = result.problems[0];
  expect(problem?.kind).toBe("alias_required_empty");
  expect(problem?.where).toBe("url");
  expect(problem?.message).toContain("url");
  expect(problem?.message).toContain("port");
});

// env のレコードと同じ id のエイリアスを duplicate_alias_id にする（正常系）
test("test_build_aliases_when_id_same_as_env", async () => {
  // 準備
  const { buildAliases } = await loadAliases();
  const rows = [customRow("servers", "env"), customRow("urls", "url")];
  const sources = [
    {
      rowId: "servers",
      path: "servers/a.yaml",
      data: {
        id: "dev-server",
        name: "開発サーバー",
        url: "http://127.0.0.1:8767/",
      },
    },
    {
      rowId: "urls",
      path: "urls/a.yaml",
      data: { id: "dev-server", name: "公開", url: "https://example.com/" },
    },
  ];
  // 実行
  const result = buildAliases({ rows, sources });
  // 検証
  expect(result.aliases).toEqual([]);
  expect(result.problems.map((problem) => problem.kind)).toEqual([
    "duplicate_alias_id",
  ]);
});

// ref・custom・同じ名前の列の順で値を取る（正常系）
test("test_read_alias_record", async () => {
  // 準備
  const { readAliasRecord } = await loadAliases();
  const record = {
    term: "ワークスペース",
    description: "話し合いの記録を置くフォルダ",
    memo: "使わない列",
  };
  const metadata = {
    alias_type: { type: "custom", value: "term" },
    name: { type: "ref", field: "term" },
  };
  // 実行
  const result = readAliasRecord({ record, metadata, fallbackName: "ws" });
  // 検証
  expect(result.values).toEqual({
    alias_type: "term",
    name: "ワークスペース",
    description: "話し合いの記録を置くフォルダ",
  });
  expect(result.missing).toEqual([]);
});

// 種類ごとに必須のキーの空を返す（正常系）
test("test_check_alias_fields", async () => {
  // 準備
  const { checkAliasFields } = await loadAliases();
  // 実行
  const results = [
    checkAliasFields({ alias_type: "term", id: "a", name: "A" }),
    checkAliasFields({ alias_type: "command", id: "b", name: "B" }),
    checkAliasFields({ alias_type: "avoid", id: "c", name: "C" }),
    checkAliasFields({ alias_type: "memo", id: "d", name: "D" }),
    checkAliasFields({
      alias_type: "url",
      id: "e",
      name: "E",
      url: "https://example.com/",
    }),
  ];
  // 検証
  expect(results).toEqual([
    { kind: "alias_required_empty", keys: ["description"] },
    { kind: "alias_required_empty", keys: ["command"] },
    { kind: "alias_required_empty", keys: ["replacement"] },
    { kind: "alias_unknown_type", value: "memo" },
    undefined,
  ]);
});

// env・知らない種類・必須のキーが空・同じ id の後のものを除く（正常系）
test("test_usable_aliases", async () => {
  // 準備
  const { usableAliases } = await loadAliases();
  const unitTest = {
    alias_type: "command",
    id: "unit-test",
    name: "単体テスト",
    command: "npm run test:unit",
  };
  const aliases: readonly unknown[] = [
    unitTest,
    {
      alias_type: "env",
      id: "dev-server",
      name: "開発サーバー",
      url: "http://127.0.0.1:8767/",
    },
    { alias_type: "memo", id: "memo", name: "メモ" },
    { alias_type: "command", id: "build", name: "ビルド", command: "" },
    { ...unitTest, name: "もう 1 つの単体テスト" },
    "x",
  ];
  // 実行
  const result = usableAliases(aliases);
  // 検証
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject(unitTest);
  expect(result[0]?.aliases).toEqual([]);
});
