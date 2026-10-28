import { join } from "node:path";
import { expect, test } from "vitest";
import type { LoadedConfig } from "../../../../src/cli/config.ts";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 設定の aliases の YAML を読む処理を読み込む（ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む。実装が無い間は各テストが個別に失敗する） */
const loadAliasesModule = (): Promise<
  typeof import("../../../../src/cli/aliases.ts")
> =>
  import(
    /* @vite-ignore */ new URL(
      "../../../../src/cli/aliases.ts",
      import.meta.url,
    ).href
  );

const createTempDir = useTempDirs();

/** `alias_type` を列から取る行 */
function row(
  paths: string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "records",
    paths,
    metadata: { alias_type: { type: "ref", field: "alias_type" } },
    ...extra,
  };
}

/** 読んだ設定を作る */
function createLoaded(dir: string, config: Record<string, unknown>) {
  return {
    path: join(dir, "mdmark.config.yaml"),
    dir,
    config,
  } as unknown as LoadedConfig;
}

// 行の paths の YAML を読んでエイリアスを作る（正常系）
test("test_load_aliases", async () => {
  // 準備
  const { loadAliases } = await loadAliasesModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "aliases/a.yaml": [
      "items:",
      "  - alias_type: command",
      "    id: run-test",
      "    name: テストを流す",
      "    command: npm test",
      "  - alias_type: env",
      "    id: dev-server",
      "    name: 開発サーバー",
      "    url: http://127.0.0.1:8767/",
      "",
    ].join("\n"),
  });
  const loaded = createLoaded(dir, {
    aliases: [row(["aliases/*.yaml"], { records: "items" })],
  });
  // 実行
  const result = await loadAliases(loaded);
  // 検証
  expect(result.issues).toEqual([]);
  expect(result.aliases).toHaveLength(1);
  expect(result.aliases?.[0]).toMatchObject({
    alias_type: "command",
    id: "run-test",
  });
});

// 当たるファイルが無い行を alias_no_files にする（異常系）
test("test_load_aliases_when_no_files", async () => {
  // 準備
  const { loadAliases } = await loadAliasesModule();
  const dir = await createTempDir();
  const loaded = createLoaded(dir, { aliases: [row(["missing/*.yaml"])] });
  // 実行
  const result = await loadAliases(loaded);
  // 検証
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.kind).toBe("alias_no_files");
  expect(result.issues[0]?.where).toBe("aliases[0].paths");
  expect(result.issues[0]?.message).toContain("missing/*.yaml");
});

// YAML として読めないファイルを alias_unreadable にして使わない（異常系）
test("test_load_aliases_when_unreadable", async () => {
  // 準備
  const { loadAliases } = await loadAliasesModule();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "aliases/a.yaml": "items: [1, 2\n",
    "aliases/b.yaml":
      "alias_type: command\nid: run-test\nname: テストを流す\ncommand: npm test\n",
  });
  const loaded = createLoaded(dir, { aliases: [row(["aliases/*.yaml"])] });
  // 実行
  const result = await loadAliases(loaded);
  // 検証
  const unreadable = result.issues.filter(
    (issue) => issue.kind === "alias_unreadable",
  );
  expect(unreadable).toHaveLength(1);
  expect(unreadable[0]?.file).toBe("aliases/a.yaml");
  expect(result.aliases?.map((alias) => alias.id)).toEqual(["run-test"]);
});

// enabled が false の行と null の行は読まない（正常系）
test("test_load_aliases_when_disabled_or_null", async () => {
  // 準備
  const { loadAliases } = await loadAliasesModule();
  const dir = await createTempDir();
  const loaded = createLoaded(dir, {
    aliases: [row(["none/*.yaml"], { enabled: false }), null],
  });
  // 実行
  const result = await loadAliases(loaded);
  // 検証
  expect(result.issues).toEqual([]);
  expect(result.aliases).toEqual([]);
});

// 設定に aliases が無ければ何も読まない（正常系）
test("test_load_aliases_when_no_aliases", async () => {
  // 準備
  const { loadAliases } = await loadAliasesModule();
  const dir = await createTempDir();
  const loaded = createLoaded(dir, {});
  // 実行
  const result = await loadAliases(loaded);
  // 検証
  expect(result.aliases).toBeUndefined();
  expect(result.issues).toEqual([]);
});
