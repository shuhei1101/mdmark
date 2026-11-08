import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** 語彙を削除する移行のスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMigration = () =>
  import("../../../migrations/next/drop-tag-vocabulary.mjs");

const createTempDir = useTempDirs();

/** 語彙と、別名・やめたタグで付けた文書のタグを持つ v0.9.0 までの索引 */
const OLD_INDEX = [
  "# 索引のコメント",
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "    tags: [MCP, { name: topic:old, main: true }, topic:yaml, 設計]",
  "tags:",
  "  - name: topic:mcp",
  "    aliases: [MCP]",
  "  - name: topic:old",
  "    deprecated: topic:mcp",
  "  - name: topic:yaml",
  "",
].join("\n");

// 別名・やめたタグを書き換え、語彙を削除して `schema` を `2` にする（正常系）
test("test_drop_tag_vocabulary", async () => {
  // 準備
  const { dropTagVocabulary } = await loadMigration();
  // 実行
  const result = dropTagVocabulary(OLD_INDEX);
  // 検証
  expect(result).toBeDefined();
  const value = parse(result ?? "");
  expect(value.schema).toBe(2);
  expect("tags" in value).toBe(false);
  expect(value.docs[0].tags).toEqual([
    { name: "topic:mcp", main: true },
    "topic:yaml",
    "設計",
  ]);
  expect(result).toContain("# 索引のコメント");
});

// 語彙を持たない `schema: 1` の索引は `schema` だけを `2` にする（正常系）
test("test_drop_tag_vocabulary_without_vocabulary", async () => {
  // 準備
  const { dropTagVocabulary } = await loadMigration();
  const source = [
    "schema: 1",
    "docs:",
    "  - id: a",
    "    path: a.md",
    "    title: A",
    "    tags: [MCP]",
    "",
  ].join("\n");
  // 実行
  const result = dropTagVocabulary(source);
  // 検証
  expect(result).toBe(source.replace("schema: 1", "schema: 2"));
});

// 適用した後の索引では `undefined` を返却する（正常系）
test("test_drop_tag_vocabulary_when_reapplied", async () => {
  // 準備
  const { dropTagVocabulary } = await loadMigration();
  const applied = dropTagVocabulary(OLD_INDEX) ?? "";
  // 実行
  const result = dropTagVocabulary(applied);
  // 検証
  expect(result).toBeUndefined();
});

// 設定の `index` が指す索引を書き換える（正常系）
test("test_run_drop_tag_vocabulary", async () => {
  // 準備
  const { dropTagVocabulary, runDropTagVocabulary } = await loadMigration();
  const root = await createTempDir();
  await writeFiles(root, {
    "mdmark.config.yaml": "index: docs/index.yaml\n",
    "docs/index.yaml": OLD_INDEX,
  });
  // 実行
  await runDropTagVocabulary(["--config", join(root, "mdmark.config.yaml")]);
  // 検証
  expect(await readFile(join(root, "docs/index.yaml"), "utf8")).toBe(
    dropTagVocabulary(OLD_INDEX),
  );
});

// 設定に `index` が無ければ何も書き換えない（正常系）
test("test_run_drop_tag_vocabulary_without_index", async () => {
  // 準備
  const { runDropTagVocabulary } = await loadMigration();
  const root = await createTempDir();
  const config = "build:\n  include: ['**/*.md']\n";
  await writeFiles(root, { "mdmark.config.yaml": config });
  // 実行
  await runDropTagVocabulary(["--config", join(root, "mdmark.config.yaml")]);
  // 検証
  expect(await readdir(root)).toEqual(["mdmark.config.yaml"]);
  expect(await readFile(join(root, "mdmark.config.yaml"), "utf8")).toBe(config);
});

// `--config` が無ければ例外を投げる（異常系）
test("test_run_drop_tag_vocabulary_without_config", async () => {
  // 準備
  const { runDropTagVocabulary } = await loadMigration();
  // 実行・検証
  await expect(runDropTagVocabulary([])).rejects.toThrow();
});
