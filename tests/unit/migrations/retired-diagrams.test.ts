import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { parse } from "yaml";
import type { convertRetiredDiagrams } from "../../../src/map/convert.ts";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";
import {
  RETIRED_DOCUMENT,
  RETIRED_DOCUMENT_CONVERTED,
  RETIRED_KINDS,
  RETIRED_LINES,
} from "../helpers/retired-document.ts";

/** 廃止した図の範囲を書き換える移行のスクリプトのファイル名 */
const SCRIPT = "retired-diagrams.mjs";

/** 文書の本文を書き換える関数の型 */
type Convert = typeof convertRetiredDiagrams;

/** 移行の手順のスクリプトの関数の型 */
type MigrateRetiredDiagrams = (options: {
  config: unknown;
  configPath: string;
  configDir: string;
  directives: Set<string>;
  convert: Convert;
}) => Promise<{
  changed: string[];
  configChanged: boolean;
  report: string[];
  problems: string[];
}>;

/** 移行のスクリプトを、それを持つ移行の手順のフォルダから読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMigrateRetiredDiagrams =
  async (): Promise<MigrateRetiredDiagrams> => {
    const module = (await import(
      /* @vite-ignore */ pathToFileURL(join(migrationsDirOf(SCRIPT), SCRIPT))
        .href
    )) as { migrateRetiredDiagrams: MigrateRetiredDiagrams };
    return module.migrateRetiredDiagrams;
  };

/** ソースの書き換えの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConvert = async (): Promise<Convert> =>
  (await import("../../../src/map/convert.ts")).convertRetiredDiagrams;

const createTempDir = useTempDirs();

/** 設定の本文（コメントを持ち、`build` の対象は `docs/` の Markdown、索引は `index.yaml`） */
const CONFIG = [
  "# 文書のフォルダの設定",
  "version: v0.11.0",
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

/** 移行の前の文書を持つ一時フォルダを作り、手順の関数に渡す引数を返却する */
const createFolder = async (
  options: { config?: string; build?: string; directives?: string[] } = {},
): Promise<{
  config: unknown;
  configPath: string;
  configDir: string;
  directives: Set<string>;
}> => {
  const configDir = await createTempDir();
  const config = options.config ?? CONFIG;
  await writeFiles(configDir, {
    "mdmark.config.yaml": config,
    "index.yaml": INDEX,
    "docs/reply.md": options.build ?? RETIRED_DOCUMENT,
    "notes/extra.md": RETIRED_DOCUMENT,
  });
  return {
    config: parse(config),
    configPath: join(configDir, "mdmark.config.yaml"),
    configDir,
    directives: new Set(options.directives ?? []),
  };
};

// build の対象と索引の文書を書き換え、設定に種類を書き足して報告の行を出す（正常系）
test("test_migrate_retired_diagrams", async () => {
  // 準備
  const migrateRetiredDiagrams = await loadMigrateRetiredDiagrams();
  const convert = await loadConvert();
  const folder = await createFolder();
  // 実行
  const result = await migrateRetiredDiagrams({ ...folder, convert });
  // 検証
  for (const path of ["docs/reply.md", "notes/extra.md"]) {
    expect(await readFile(join(folder.configDir, path), "utf8")).toBe(
      RETIRED_DOCUMENT_CONVERTED,
    );
  }
  const text = await readFile(folder.configPath, "utf8");
  const config = parse(text) as {
    build: unknown;
    map: { kinds: unknown; lines: unknown };
  };
  expect(text.startsWith(CONFIG)).toBe(true);
  expect(config.build).toEqual((parse(CONFIG) as { build: unknown }).build);
  expect(config.map.kinds).toEqual(RETIRED_KINDS);
  expect(config.map.lines).toEqual(RETIRED_LINES);
  expect(result.changed).toEqual(["docs/reply.md", "notes/extra.md"]);
  expect(result.configChanged).toBe(true);
  expect(result.problems).toEqual([]);
  expect(result.report).toHaveLength(14);
  expect(result.report[0]).toMatch(
    /^docs\/reply\.md:\d+: flow: scope: メールの受け取りから返信まで: /,
  );
  expect(result.report[7]).toMatch(/^notes\/extra\.md:\d+: flow: scope: /);
});

// 設定に同じ名前の種類があれば書き換えない（正常系）
test("test_migrate_retired_diagrams_when_kind_defined", async () => {
  // 準備
  const migrateRetiredDiagrams = await loadMigrateRetiredDiagrams();
  const convert = await loadConvert();
  const folder = await createFolder({
    config: `${CONFIG}map:\n  kinds:\n    llm:\n      label: AI\n`,
  });
  // 実行
  await migrateRetiredDiagrams({ ...folder, convert });
  // 検証
  const config = parse(await readFile(folder.configPath, "utf8")) as {
    map: { kinds: Record<string, unknown> };
  };
  expect(config.map.kinds.llm).toEqual({ label: "AI" });
  expect(config.map.kinds.script).toEqual(RETIRED_KINDS.script);
});

// 拡張の名前の範囲を書き換えない（正常系）
test("test_migrate_retired_diagrams_when_extension", async () => {
  // 準備
  const migrateRetiredDiagrams = await loadMigrateRetiredDiagrams();
  const convert = await loadConvert();
  const extension = [
    '<!-- flow: {"target": "world"} -->',
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
  const folder = await createFolder({
    build: extension,
    directives: ["flow"],
  });
  await writeFiles(folder.configDir, { "notes/extra.md": extension });
  // 実行
  const result = await migrateRetiredDiagrams({ ...folder, convert });
  // 検証
  expect(await readFile(join(folder.configDir, "docs/reply.md"), "utf8")).toBe(
    extension,
  );
  expect(await readFile(folder.configPath, "utf8")).toBe(CONFIG);
  expect(result.report).toEqual([]);
  expect(result.configChanged).toBe(false);
});

// もう一度適用しても書き換えない（正常系）
test("test_migrate_retired_diagrams_when_rerun", async () => {
  // 準備
  const migrateRetiredDiagrams = await loadMigrateRetiredDiagrams();
  const convert = await loadConvert();
  const folder = await createFolder();
  await migrateRetiredDiagrams({ ...folder, convert });
  const configured = {
    ...folder,
    config: parse(await readFile(folder.configPath, "utf8")),
  };
  const paths = [folder.configPath, join(folder.configDir, "docs/reply.md")];
  const before = await Promise.all(paths.map((path) => stat(path)));
  // 実行
  const result = await migrateRetiredDiagrams({ ...configured, convert });
  // 検証
  const after = await Promise.all(paths.map((path) => stat(path)));
  expect(result.changed).toEqual([]);
  expect(result.configChanged).toBe(false);
  expect(after.map((item) => item.mtimeMs)).toEqual(
    before.map((item) => item.mtimeMs),
  );
});

// 移行の手順のフォルダにまとめた書き換えの処理で、ソースの処理と同じに書き換える（正常系）
test("test_migrate_retired_diagrams_when_bundled", async () => {
  // 準備
  const migrateRetiredDiagrams = await loadMigrateRetiredDiagrams();
  const convert = await loadConvert();
  const bundled = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(migrationsDirOf(SCRIPT), "retired-diagrams.js"),
    ).href
  )) as { convertRetiredDiagrams: Convert };
  const fromSource = await createFolder();
  const fromBundle = await createFolder();
  // 実行
  const expected = await migrateRetiredDiagrams({ ...fromSource, convert });
  const result = await migrateRetiredDiagrams({
    ...fromBundle,
    convert: bundled.convertRetiredDiagrams,
  });
  // 検証
  expect(result).toEqual(expected);
  for (const path of [
    "mdmark.config.yaml",
    "docs/reply.md",
    "notes/extra.md",
  ]) {
    expect(await readFile(join(fromBundle.configDir, path), "utf8")).toBe(
      await readFile(join(fromSource.configDir, path), "utf8"),
    );
  }
});
