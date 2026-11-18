import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** map のマーカーの廃止した引数を削除する移行のスクリプトのファイル名 */
const SCRIPT = "retired-map-options.mjs";

/** 移行のスクリプトが持つ関数 */
type RetiredMapOptions = {
  removeRetiredMapOptions: (markdown: string) => {
    markdown: string;
    changed: boolean;
  };
  migrateRetiredMapOptions: (options: {
    config: unknown;
    configPath: string;
    configDir: string;
  }) => Promise<{ changed: string[]; problems: string[] }>;
};

/** 移行のスクリプトを、それを持つ移行の手順のフォルダから読み込む（実装が無い間は各テストが個別に失敗する） */
const loadScript = async (): Promise<RetiredMapOptions> =>
  (await import(
    /* @vite-ignore */ pathToFileURL(join(migrationsDirOf(SCRIPT), SCRIPT)).href
  )) as RetiredMapOptions;

const createTempDir = useTempDirs();

/** シナリオ『バージョンを上げる』の 1 つ目の文書 */
const FIRST = [
  '<!-- map: {"title": "全体の構成", "play": "autoplay", "interval": 3} -->',
  "",
  "```mermaid",
  "flowchart LR",
  "  A --> B",
  "```",
  "",
  "<!-- /map -->",
  "",
].join("\n");

/** シナリオ『バージョンを上げる』の 2 つ目の文書（コードブロックの中にマーカーを持つ） */
const SECOND = [
  '<!-- map: {"interval": 1} -->',
  "",
  "```mermaid",
  "sequenceDiagram",
  "  A->>B: 送信する",
  "```",
  "",
  "<!-- /map -->",
  "",
  "````markdown",
  '<!-- map: {"play": "autoplay"} -->',
  "````",
  "",
].join("\n");

/** 設定の本文（`build` の対象は `docs/` の Markdown、索引は `index.yaml`） */
const CONFIG = [
  "version: v0.14.0",
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

/** 移行の前の文書を持つ一時フォルダを作り、手順の関数に指定する引数を返却する */
const createFolder = async () => {
  const configDir = await createTempDir();
  await writeFiles(configDir, {
    "mdmark.config.yaml": CONFIG,
    "index.yaml": INDEX,
    "docs/first.md": FIRST,
    "notes/extra.md": SECOND,
  });
  return {
    config: parse(CONFIG),
    configPath: join(configDir, "mdmark.config.yaml"),
    configDir,
  };
};

// 引数を削除し、無くなったマーカーを引数なしにする（正常系）
test("test_remove_retired_map_options", async () => {
  // 準備
  const { removeRetiredMapOptions } = await loadScript();
  // 実行
  const first = removeRetiredMapOptions(FIRST);
  const second = removeRetiredMapOptions(SECOND);
  // 検証
  expect(first.markdown).toBe(
    FIRST.replace(
      '<!-- map: {"title": "全体の構成", "play": "autoplay", "interval": 3} -->',
      '<!-- map: {"title": "全体の構成"} -->',
    ),
  );
  expect(second.markdown).toBe(
    SECOND.replace('<!-- map: {"interval": 1} -->', "<!-- map -->"),
  );
  expect([first.changed, second.changed]).toEqual([true, true]);
});

// 書き換えないマーカー（正常系）
test("test_remove_retired_map_options_when_untouched", async () => {
  // 準備
  const { removeRetiredMapOptions } = await loadScript();
  const markdown = [
    '<!-- map: {"title": "全体", "focus": "read"} -->',
    "<!-- /map -->",
    "<!-- map: {play: 1} -->",
    "<!-- /map -->",
    "",
  ].join("\n");
  // 実行
  const result = removeRetiredMapOptions(markdown);
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.changed).toBe(false);
});

// build の対象と索引の文書を書き換える（正常系）
test("test_migrate_retired_map_options", async () => {
  // 準備
  const { migrateRetiredMapOptions, removeRetiredMapOptions } =
    await loadScript();
  const folder = await createFolder();
  // 実行
  const result = await migrateRetiredMapOptions(folder);
  // 検証
  expect(await readFile(join(folder.configDir, "docs/first.md"), "utf8")).toBe(
    removeRetiredMapOptions(FIRST).markdown,
  );
  expect(await readFile(join(folder.configDir, "notes/extra.md"), "utf8")).toBe(
    removeRetiredMapOptions(SECOND).markdown,
  );
  expect(await readFile(folder.configPath, "utf8")).toBe(CONFIG);
  expect(result.changed).toEqual(["docs/first.md", "notes/extra.md"]);
  expect(result.problems).toEqual([]);
});

// もう一度適用しても書き換えない（正常系）
test("test_migrate_retired_map_options_when_rerun", async () => {
  // 準備
  const { migrateRetiredMapOptions } = await loadScript();
  const folder = await createFolder();
  await migrateRetiredMapOptions(folder);
  const before = (await stat(join(folder.configDir, "docs/first.md"))).mtimeMs;
  // 実行
  const result = await migrateRetiredMapOptions(folder);
  // 検証
  expect(result.changed).toEqual([]);
  expect((await stat(join(folder.configDir, "docs/first.md"))).mtimeMs).toBe(
    before,
  );
});
