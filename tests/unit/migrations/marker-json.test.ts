import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** 文書のマーカーを書き換える移行のスクリプトのファイル名 */
const SCRIPT = "marker-json.mjs";

/** 移行の手順のスクリプトの関数の型 */
type MigrateDocumentMarks = (options: {
  config: unknown;
  configDir: string;
}) => Promise<{ changed: string[]; report: string[]; problems: string[] }>;

/** 移行のスクリプトを、それを持つ移行の手順のフォルダから読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMigrateDocumentMarks = async (): Promise<MigrateDocumentMarks> => {
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(join(migrationsDirOf(SCRIPT), SCRIPT)).href
  )) as { migrateDocumentMarks: MigrateDocumentMarks };
  return module.migrateDocumentMarks;
};

const createTempDir = useTempDirs();

/** 設定の本文（`build` の対象は `docs/` の Markdown、索引は `index.yaml`） */
const CONFIG = [
  "version: v0.10.0",
  "index: index.yaml",
  "build:",
  '  include: ["docs/**/*.md"]',
  "  out: dist/site.html",
  "",
].join("\n");

/** 索引だけが指す文書を記載した索引 */
const INDEX = [
  "schema: 2",
  "docs:",
  "  - id: notes",
  "    path: notes/extra.md",
  "    title: 索引だけの文書",
  "",
].join("\n");

/** `build` の対象の文書（書き出さない記載を持つ表とコードブロックの飾り） */
const BUILD_DOCUMENT = [
  "# 在庫",
  "",
  "<!-- table: data +count total=数量:sum filter=名前 closed -->",
  "",
  "| 名前 | 数量 |",
  "| --- | --- |",
  "| りんご | 3 |",
  "",
  "<!-- /table -->",
  "",
  "<!-- code: title=app.ts lines -->",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
].join("\n");

/** 索引だけが指す文書（拡張のマーカーと、書き換える記法のマーカー） */
const INDEX_DOCUMENT = [
  "# 補足",
  "",
  "<!-- greet: world -->",
  "",
  "<!-- section: closed -->",
  "",
].join("\n");

/** 移行の前の文書を持つ一時フォルダを作り、読み込んだ設定と一緒に返却する */
async function createFolder(): Promise<{ config: unknown; configDir: string }> {
  const configDir = await createTempDir();
  await writeFiles(configDir, {
    "mdmark.config.yaml": CONFIG,
    "index.yaml": INDEX,
    "docs/stock.md": BUILD_DOCUMENT,
    "notes/extra.md": INDEX_DOCUMENT,
  });
  return { config: parse(CONFIG), configDir };
}

// build の対象と索引の文書を書き換えて報告の行を出す（正常系）
test("test_migrate_document_marks", async () => {
  // 準備
  const migrateDocumentMarks = await loadMigrateDocumentMarks();
  const { config, configDir } = await createFolder();
  // 実行
  const result = await migrateDocumentMarks({ config, configDir });
  // 検証
  const stock = await readFile(join(configDir, "docs/stock.md"), "utf8");
  const extra = await readFile(join(configDir, "notes/extra.md"), "utf8");
  expect(stock).toBe(
    BUILD_DOCUMENT.replace(
      "<!-- table: data +count total=数量:sum filter=名前 closed -->",
      '<!-- table: {"kind": "data", "features": {"count": {}}, "columns": {"名前": {"filter": {}}}, "collapse": {"open": false}} -->',
    ).replace(
      "<!-- code: title=app.ts lines -->",
      '<!-- code: {"title": "app.ts", "lines": {}} -->',
    ),
  );
  expect(extra).toBe(
    INDEX_DOCUMENT.replace(
      "<!-- section: closed -->",
      '<!-- section: {"open": false} -->',
    ),
  );
  expect(result.changed).toEqual(["docs/stock.md", "notes/extra.md"]);
  expect(result.problems).toEqual([]);
  expect(result.report).toHaveLength(2);
  expect(result.report[0]).toMatch(
    /^docs\/stock\.md:3: table: total=数量:sum: /,
  );
  expect(result.report[1]).toMatch(/^notes\/extra\.md:3: greet: world: /);
});

// もう一度適用しても文書を書き換えない（正常系）
test("test_migrate_document_marks_when_rerun", async () => {
  // 準備
  const migrateDocumentMarks = await loadMigrateDocumentMarks();
  const { config, configDir } = await createFolder();
  await migrateDocumentMarks({ config, configDir });
  const before = await stat(join(configDir, "docs/stock.md"));
  // 実行
  const result = await migrateDocumentMarks({ config, configDir });
  // 検証
  const after = await stat(join(configDir, "docs/stock.md"));
  expect(result.changed).toEqual([]);
  expect(after.mtimeMs).toBe(before.mtimeMs);
});
