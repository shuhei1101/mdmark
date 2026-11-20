import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<typeof import("../../../src/index.ts")> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** 用語のレコードを `terms` の配列から作る行 */
const TERMS_ROW = {
  id: "terms",
  paths: ["terms/*.yaml"],
  alias_type: "term",
  records: "terms",
  metadata: { name: "term", description: "meta.meaning" },
};

/** `TERMS_ROW` が読み込むファイル（`aliases` は文字列で記載する） */
const TERMS_SOURCE = {
  rowId: "terms",
  path: "terms/glossary.yaml",
  data: {
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        aliases: "WS",
        meta: { meaning: "話し合いの記録を配置するフォルダ" },
      },
    ],
  },
};

/** コマンドのファイル 1 つを 1 件にする行 */
const COMMANDS_ROW = {
  id: "commands",
  paths: ["commands/unit-test.yaml"],
  alias_type: "command",
};

/** `COMMANDS_ROW` が読み込むファイル（`name` を持たない） */
const COMMANDS_SOURCE = {
  rowId: "commands",
  path: "commands/unit-test.yaml",
  data: {
    id: "unit-test",
    description: "ライブラリ本体の単体テストを実行する",
    command: "npm run test:unit",
  },
};

/** 種類を `alias_type` にした、ファイル 1 つを 1 件にする行 */
function typedRow(
  id: string,
  aliasType: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    paths: [`${id}/*.yaml`],
    alias_type: aliasType,
    ...extra,
  };
}

// records を持つ行と持たない行から、metadata を適用したエイリアスを並びの順に作り、env と読み込まない行を除く（正常系）
test("test_normal", async () => {
  // 準備
  const { buildAliases } = await loadBuilt();
  const rows = [
    TERMS_ROW,
    COMMANDS_ROW,
    { ...typedRow("off", "term"), enabled: false },
    typedRow("servers", "env"),
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
      data: { id: "memo", name: "メモ", description: "読み込まない" },
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
    description: "話し合いの記録を配置するフォルダ",
  });
  expect(result.aliases[1]).toMatchObject({
    alias_type: "command",
    id: "unit-test",
    name: "unit-test",
    description: "ライブラリ本体の単体テストを実行する",
    command: "npm run test:unit",
  });
  const ids = result.aliases.map((alias) => alias.id);
  expect(ids).not.toContain("dev-server");
  expect(ids).not.toContain("memo");
  expect(result.problems).toEqual([]);
  expect({ rows, sources }).toEqual(before);
});

// 使用できない行とレコードを除いてずれにし、残りからエイリアスを作る（正常系）
test("test_normal_when_invalid_rows", async () => {
  // 準備
  const { buildAliases } = await loadBuilt();
  const rows = [
    TERMS_ROW,
    // 1: records のキーがファイルに無い
    typedRow("no-records", "term", { records: "items" }),
    // 2: description を取る列 missing_col がレコードに無い
    typedRow("no-column", "term", {
      metadata: { description: "missing_col" },
    }),
    // 3: 行の alias_type が種類に無い
    typedRow("unknown-type", "memo"),
    // 4: command が空
    typedRow("empty-command", "command"),
    // 5: 行の id が terms と同じ
    typedRow("terms", "term"),
    // 6: エイリアスの id が terms のレコード ws と同じ
    typedRow("dup-alias", "term"),
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
  const unknownProblem = result.problems[2];
  expect(unknownProblem?.file).toBe("mdmark.config.yaml");
  expect(unknownProblem?.where).toBe("aliases[3].alias_type");
  const rowIdProblem = result.problems[4];
  expect(rowIdProblem?.file).toBe("mdmark.config.yaml");
  expect(rowIdProblem?.where).toBe("aliases[5].id");
  const emptyProblem = result.problems[3];
  expect(emptyProblem?.file).toBe("empty-command/a.yaml");
  expect(emptyProblem?.where).toBe("command");
  expect(emptyProblem?.message).toContain("command");
  expect(emptyProblem?.message).toContain("記載してください");
});

// エイリアスに元の行の id を入れ、詳細のページのリンク先を設定ファイルのフォルダからの相対パスにする（正常系（元の行と詳細のページ））
test("test_normal_when_row_and_details", async () => {
  // 準備
  const { buildAliases } = await loadBuilt();
  const rows = [
    {
      id: "terms",
      paths: ["docs/guide/用語集.yaml"],
      alias_type: "term",
      records: "terms",
      metadata: { details: "pages" },
    },
  ];
  const sources = [
    {
      rowId: "terms",
      path: "docs/guide/用語集.yaml",
      data: {
        terms: [
          {
            id: "marker",
            name: "マーカー",
            description: "HTML コメントで記載する指定",
            pages: [
              {
                title: "文書を描く仕組み",
                href: "./コアコンセプト-文書を描く仕組み.md#流れ",
              },
              { title: "仕様", href: "https://example.com/spec" },
              { title: "リンク先の無い要素" },
            ],
          },
        ],
      },
    },
  ];
  // 実行
  const { aliases, problems } = buildAliases({ rows, sources });
  // 検証
  expect(problems).toEqual([]);
  expect(aliases[0]?.row).toBe("terms");
  expect(aliases[0]?.details).toHaveLength(2);
  expect(aliases[0]?.details?.[0]?.href).toBe(
    "docs/guide/コアコンセプト-文書を描く仕組み.md#流れ",
  );
  expect(aliases[0]?.details?.[1]?.href).toBe("https://example.com/spec");
});
