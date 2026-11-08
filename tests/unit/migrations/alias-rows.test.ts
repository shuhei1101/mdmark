import { glob } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { parseDocument } from "yaml";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** リポジトリの直下 */
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** 移行の手順のスクリプトの関数の型 */
type MigrateAliasRows = (options: {
  doc: ReturnType<typeof parseDocument>;
  configDir: string;
}) => Promise<{ changed: boolean; notices: string[]; problems: string[] }>;

/** `migrations/*\/alias-rows.mjs` を探して読み込む（release で `next/` をバージョンのフォルダへ移した後も同じテストで読み込む） */
const loadMigrateAliasRows = async (): Promise<MigrateAliasRows> => {
  const found: string[] = [];
  for await (const path of glob("migrations/*/alias-rows.mjs", {
    cwd: ROOT,
  })) {
    found.push(path);
  }
  expect(found).toHaveLength(1);
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(`${ROOT}${found[0]}`).href
  )) as { migrateAliasRows: MigrateAliasRows };
  return module.migrateAliasRows;
};

const createTempDir = useTempDirs();

/** 設定の本文と、設定のフォルダに配置するファイルから、読み込んだ設定とフォルダを作る */
async function createConfig(
  lines: string[],
  files: Record<string, string> = {},
): Promise<{ doc: ReturnType<typeof parseDocument>; configDir: string }> {
  const configDir = await createTempDir();
  await writeFiles(configDir, files);
  return { doc: parseDocument([...lines, ""].join("\n")), configDir };
}

// custom と種類が 1 つの ref の alias_type を行へ移し、ref の値を列名にする（正常系）
test("test_migrate_alias_rows", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const { doc, configDir } = await createConfig(
    [
      "# 設定",
      "aliases:",
      "  - id: terms",
      '    paths: ["terms/*.yaml"]',
      "    records: terms",
      "    metadata:",
      "      alias_type: { type: custom, value: term }",
      "      name: { type: ref, field: term }",
      "      description: { type: ref, field: meaning }",
      "  - id: commands",
      '    paths: ["commands/*.yaml"]',
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
    ],
    {
      "terms/a.yaml":
        "terms:\n  - id: ws\n    term: ワークスペース\n    meaning: 話し合いの記録を配置するフォルダ\n",
      "commands/unit-test.yaml":
        "alias_type: command\nid: unit-test\ncommand: npm run test:unit\n",
      "commands/build.yaml":
        "alias_type: command\nid: build\ncommand: npm run build\n",
    },
  );
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  expect(result).toEqual({ changed: true, notices: [], problems: [] });
  const config = doc.toJS() as { aliases: Record<string, unknown>[] };
  expect(config.aliases[0]).toEqual({
    id: "terms",
    paths: ["terms/*.yaml"],
    records: "terms",
    alias_type: "term",
    metadata: { name: "term", description: "meaning" },
  });
  expect(config.aliases[1]).toEqual({
    id: "commands",
    paths: ["commands/*.yaml"],
    alias_type: "command",
  });
  expect(doc.toString()).toContain("# 設定");
});

// alias_type 以外の custom のキーを除外して通知する（正常系）
test("test_migrate_alias_rows_when_custom_value", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const { doc, configDir } = await createConfig([
    "aliases:",
    "  - id: tests",
    '    paths: ["tests/*.yaml"]',
    "    metadata:",
    "      alias_type: { type: custom, value: command }",
    "      cwd: { type: custom, value: リポジトリの直下 }",
  ]);
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  const config = doc.toJS() as { aliases: Record<string, unknown>[] };
  expect(config.aliases[0]).toEqual({
    id: "tests",
    paths: ["tests/*.yaml"],
    alias_type: "command",
  });
  expect(result.problems).toEqual([]);
  expect(result.notices).toHaveLength(1);
  expect(result.notices[0]).toContain("tests");
  expect(result.notices[0]).toContain("cwd");
  expect(result.notices[0]).toContain("リポジトリの直下");
});

// ref の列の種類が 2 つ以上の行を problems にする（異常系）
test("test_migrate_alias_rows_when_mixed_types", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const { doc, configDir } = await createConfig(
    [
      "aliases:",
      "  - id: mixed",
      '    paths: ["mixed/*.yaml"]',
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
    ],
    {
      "mixed/a.yaml": "alias_type: term\nid: ws\ndescription: 説明\n",
      "mixed/b.yaml":
        "alias_type: command\nid: build\ncommand: npm run build\n",
    },
  );
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  expect(result.problems).toHaveLength(1);
  expect(result.problems[0]).toContain("mixed");
  expect(result.problems[0]).toContain("term");
  expect(result.problems[0]).toContain("command");
});

// ref の行のレコードが 0 件なら、alias_type の記載を求める problems にする（異常系）
test("test_migrate_alias_rows_when_no_records", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const { doc, configDir } = await createConfig([
    "aliases:",
    "  - id: empty",
    '    paths: ["empty/*.yaml"]',
    "    metadata:",
    "      alias_type: { type: ref, field: alias_type }",
  ]);
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  expect(result.problems).toHaveLength(1);
  expect(result.problems[0]).toContain("empty");
  expect(result.problems[0]).toContain("alias_type");
  expect(result.problems[0]).not.toContain("行を分け");
});

// v0.3.0 の構造の行は触らない（正常系）
test("test_migrate_alias_rows_when_already_migrated", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const lines = [
    "aliases:",
    "  - id: terms",
    '    paths: ["terms/*.yaml"]',
    "    alias_type: term",
    "    metadata:",
    "      name: term",
  ];
  const { doc, configDir } = await createConfig(lines);
  const before = doc.toString();
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  expect(result).toEqual({ changed: false, notices: [], problems: [] });
  expect(doc.toString()).toBe(before);
});

// YAML として読み込めないファイルを problems にし、例外を投げない（異常系）
test("test_migrate_alias_rows_when_unreadable", async () => {
  // 準備
  const migrateAliasRows = await loadMigrateAliasRows();
  const { doc, configDir } = await createConfig(
    [
      "aliases:",
      "  - id: broken",
      '    paths: ["broken/*.yaml"]',
      "    metadata:",
      "      alias_type: { type: ref, field: alias_type }",
    ],
    { "broken/a.yaml": "items: [1, 2\n" },
  );
  // 実行
  const result = await migrateAliasRows({ doc, configDir });
  // 検証
  expect(result.changed).toBe(false);
  expect(result.problems).toHaveLength(1);
  expect(result.problems[0]).toContain("broken");
  expect(result.problems[0]).toContain("broken/a.yaml");
});
