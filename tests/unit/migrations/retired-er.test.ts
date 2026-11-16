import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { parse } from "yaml";
import type { convertRetiredEr } from "../../../src/map/convert.ts";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";
import {
  RETIRED_ER_DOCUMENT,
  RETIRED_ER_DOCUMENT_CONVERTED,
  RETIRED_ER_LINE,
  RETIRED_ER_REPORT_ITEMS,
} from "../helpers/retired-er-document.ts";

/** 廃止した ER 図の範囲を書き換える移行のスクリプトのファイル名 */
const SCRIPT = "retired-er.mjs";

/** 文書の本文を書き換える関数の型 */
type Convert = typeof convertRetiredEr;

/** 移行の手順のスクリプトの関数の型 */
type MigrateRetiredEr = (options: {
  config: unknown;
  configPath: string;
  configDir: string;
  directives: Set<string>;
  convert: Convert;
}) => Promise<{
  changed: string[];
  report: string[];
  problems: string[];
}>;

/** 移行のスクリプトを、それを持つ移行の手順のフォルダから読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMigrateRetiredEr = async (): Promise<MigrateRetiredEr> => {
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(join(migrationsDirOf(SCRIPT), SCRIPT))
      .href
  )) as { migrateRetiredEr: MigrateRetiredEr };
  return module.migrateRetiredEr;
};

/** ソースの書き換えの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConvert = async (): Promise<Convert> =>
  (await import("../../../src/map/convert.ts")).convertRetiredEr;

const createTempDir = useTempDirs();

/** 設定の本文（`build` の対象は `docs/` の Markdown、索引は `index.yaml`） */
const CONFIG = [
  "# 文書のフォルダの設定",
  "version: v0.13.0",
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
const createFolder = async (
  options: { build?: string; directives?: string[] } = {},
): Promise<{
  config: unknown;
  configPath: string;
  configDir: string;
  directives: Set<string>;
}> => {
  const configDir = await createTempDir();
  await writeFiles(configDir, {
    "mdmark.config.yaml": CONFIG,
    "index.yaml": INDEX,
    "docs/orders.md": options.build ?? RETIRED_ER_DOCUMENT,
    "notes/extra.md": RETIRED_ER_DOCUMENT,
  });
  return {
    config: parse(CONFIG),
    configPath: join(configDir, "mdmark.config.yaml"),
    configDir,
    directives: new Set(options.directives ?? []),
  };
};

// build の対象と索引の文書を書き換え、報告の行を出す（正常系）
test("test_migrate_retired_er", async () => {
  // 準備
  const migrateRetiredEr = await loadMigrateRetiredEr();
  const convert = await loadConvert();
  const folder = await createFolder();
  // 実行
  const result = await migrateRetiredEr({ ...folder, convert });
  // 検証
  for (const path of ["docs/orders.md", "notes/extra.md"]) {
    expect(await readFile(join(folder.configDir, path), "utf8")).toBe(
      RETIRED_ER_DOCUMENT_CONVERTED,
    );
  }
  expect(await readFile(folder.configPath, "utf8")).toBe(CONFIG);
  expect(result.changed).toEqual(["docs/orders.md", "notes/extra.md"]);
  expect(result.problems).toEqual([]);
  const prefixes = ["docs/orders.md", "notes/extra.md"].flatMap((path) =>
    RETIRED_ER_REPORT_ITEMS.map(
      (item) => `${path}:${RETIRED_ER_LINE}: er: ${item}: `,
    ),
  );
  expect(result.report).toHaveLength(prefixes.length);
  result.report.forEach((line, index) => {
    expect(line.startsWith(prefixes[index] ?? "")).toBe(true);
  });
});

// 拡張の名前の範囲を書き換えない（正常系）
test("test_migrate_retired_er_when_extension", async () => {
  // 準備
  const migrateRetiredEr = await loadMigrateRetiredEr();
  const convert = await loadConvert();
  const extension = [
    '<!-- er: {"target": "world"} -->',
    "",
    "<!-- /er -->",
    "",
  ].join("\n");
  const folder = await createFolder({ build: extension, directives: ["er"] });
  await writeFiles(folder.configDir, { "notes/extra.md": extension });
  // 実行
  const result = await migrateRetiredEr({ ...folder, convert });
  // 検証
  expect(await readFile(join(folder.configDir, "docs/orders.md"), "utf8")).toBe(
    extension,
  );
  expect(result.changed).toEqual([]);
  expect(result.report).toEqual([]);
});

// もう一度適用しても書き換えない（正常系）
test("test_migrate_retired_er_when_rerun", async () => {
  // 準備
  const migrateRetiredEr = await loadMigrateRetiredEr();
  const convert = await loadConvert();
  const folder = await createFolder();
  await migrateRetiredEr({ ...folder, convert });
  const paths = [
    join(folder.configDir, "docs/orders.md"),
    join(folder.configDir, "notes/extra.md"),
  ];
  const before = await Promise.all(paths.map((path) => stat(path)));
  // 実行
  const result = await migrateRetiredEr({ ...folder, convert });
  // 検証
  const after = await Promise.all(paths.map((path) => stat(path)));
  expect(result.changed).toEqual([]);
  expect(after.map((item) => item.mtimeMs)).toEqual(
    before.map((item) => item.mtimeMs),
  );
});

// 移行の手順のフォルダにまとめた書き換えの処理で、ソースの処理と同じに書き換える（正常系）
test("test_migrate_retired_er_when_bundled", async () => {
  // 準備
  const migrateRetiredEr = await loadMigrateRetiredEr();
  const convert = await loadConvert();
  const bundled = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(migrationsDirOf(SCRIPT), "retired-diagrams.js"),
    ).href
  )) as { convertRetiredEr: Convert };
  const fromSource = await createFolder();
  const fromBundle = await createFolder();
  // 実行
  const expected = await migrateRetiredEr({ ...fromSource, convert });
  const result = await migrateRetiredEr({
    ...fromBundle,
    convert: bundled.convertRetiredEr,
  });
  // 検証
  expect(result).toEqual(expected);
  for (const path of ["mdmark.config.yaml", "docs/orders.md", "notes/extra.md"]) {
    expect(await readFile(join(fromBundle.configDir, path), "utf8")).toBe(
      await readFile(join(fromSource.configDir, path), "utf8"),
    );
  }
});
