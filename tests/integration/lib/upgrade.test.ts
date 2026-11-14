import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { parse } from "yaml";
import { main as buildMain } from "../../../scripts/build.ts";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { shopEr } from "../../unit/helpers/er.ts";
import {
  RETIRED_DOCUMENT,
  RETIRED_DOCUMENT_CONVERTED,
  RETIRED_KINDS,
  RETIRED_LINES,
} from "../../unit/helpers/retired-document.ts";
import {
  type CliResult,
  GREET_SOURCE,
  linesOf,
  TEST_LIB_SOURCE,
  useTempDirs,
  writeFiles,
} from "../cli.ts";
import { copyPluginInputs, writeRootPackageJson } from "../plugin-inputs.ts";

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

// バージョンを埋めたパッケージをビルドする待つ上限（ミリ秒）
const BUILD_TIMEOUT_MS = 180_000;

const createTempDir = useTempDirs();

/** バージョンを埋めてビルドしたテスト用のパッケージ（バージョン → パッケージの直下） */
const packages = new Map<string, string>();

/** 作業ツリーの `src`・`templates` と依存を一時フォルダへコピーし、`--version` でバージョンを埋めた `dist/cli.js` をビルドする */
async function buildPackage(version: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-upgrade-"));
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  await cp(join(REPO_ROOT, "schemas"), join(root, "schemas"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "templates"), join(root, "templates"), {
    recursive: true,
  });
  await writeRootPackageJson(root);
  await copyPluginInputs(root);
  await writeFile(join(root, "version.ini"), "v0.0.0\n");
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await copyFile(join(REPO_ROOT, name), join(root, name));
  }
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  const code = await buildMain(["--version", version], {
    root,
    maxBytes: MAX_BYTES,
  });
  if (code !== 0) {
    throw new Error(`${version} を埋めたパッケージをビルドできなかった`);
  }
  packages.set(version, root);
  return root;
}

beforeAll(async () => {
  await buildPackage("v0.5.0");
  await buildPackage("v0.4.0");
}, BUILD_TIMEOUT_MS * 2);

afterAll(async () => {
  await Promise.all(
    [...packages.values()].map((root) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
});

/** バージョンを埋めたパッケージの直下 */
function packageOf(version: string): string {
  const root = packages.get(version);
  if (!root) {
    throw new Error(`${version} を埋めたパッケージが無い`);
  }
  return root;
}

/** パッケージの `migrations/` と変更履歴を、テスト用のものに差し替える */
async function setMigrations(
  pkg: string,
  files: Record<string, string>,
): Promise<void> {
  await rm(join(pkg, "migrations"), { recursive: true, force: true });
  await rm(join(pkg, "docs"), { recursive: true, force: true });
  await writeFiles(pkg, files);
}

/** パッケージの `dist/cli.js` で `upgrade` を実行する。終了コードが 0 以外でも例外を投げず、結果を返却する */
function runUpgrade(
  pkg: string,
  options: {
    args?: string[];
    cwd: string;
    stdin?: string;
    env?: Record<string, string>;
  },
): Promise<CliResult> {
  return new Promise((resolveResult) => {
    const child = execFile(
      process.execPath,
      [join(pkg, "dist", "cli.js"), "upgrade", ...(options.args ?? [])],
      { cwd: options.cwd, env: { ...process.env, ...options.env } },
      (error, stdout, stderr) => {
        const failed = error as { code?: number } | null;
        resolveResult({
          code: failed ? (failed.code ?? -1) : 0,
          stdout,
          stderr,
        });
      },
    );
    child.stdin?.end(options.stdin ?? "");
  });
}

/** 手元のバージョンが古い設定（コメントと、点検が拒まない最上位の知らないキー `legacy` を持つ） */
const OLD_CONFIG = [
  "# mdmark の設定",
  "version: v0.3.0",
  "legacy: 1 # 古いキー",
  "index: docs/index.yaml",
  "build:",
  '  include: ["docs/*.md"]',
  "  out: dist/docs.html",
  "",
].join("\n");

/** バージョンを持たない設定（v0.3.0 までの `init` が配置した設定） */
const CONFIG_WITHOUT_VERSION = OLD_CONFIG.replace("version: v0.3.0\n", "");

/** 手元のフォルダに配置する索引と文書 */
const WORK_FILES = {
  "docs/index.yaml": [
    "schema: 2",
    "docs:",
    "  - id: a",
    "    path: a.md",
    "    title: A",
    "  - id: b",
    "    path: b.md",
    "    title: B",
    "",
  ].join("\n"),
  "docs/a.md": "# A\n\n<!-- note -->\n",
  "docs/b.md": "# B\n\n<!-- note -->\n",
};

/** v0.4.0 の手順: 設定の `legacy` を `renamed` に改める */
const STEPS_V040 = [
  "steps:",
  "  - op: rename_key",
  "    description: legacy を renamed に改める",
  "    file: config",
  "    from: legacy",
  "    to: renamed",
  "",
].join("\n");

/** v0.5.0 の手順: 文書のマーカーを書き換える（`destructive` を付けるときは先頭に追加する） */
function stepsV050(destructive = false): string {
  return [
    "steps:",
    "  - op: replace_mark",
    ...(destructive ? ["    destructive: true"] : []),
    "    description: マーカー note を callout に書き換える",
    "    from: <!-- note -->",
    "    to: <!-- callout -->",
    "",
  ].join("\n");
}

/** テスト用の変更履歴（v0.3.0・v0.4.0・v0.5.0 の行） */
const CHANGELOG = [
  "# 変更履歴",
  "",
  "| バージョン | PR | 変更 |",
  "| --- | --- | --- |",
  "| v0.5.0 | [#45](https://example.com/45) | 注意書きのマーカーの名前を統一する |",
  "| v0.4.0 | [#40](https://example.com/40) | 設定のキーの名前を改める |",
  "| v0.3.0 | [#38](https://example.com/38) | 手元のバージョンより古い行 |",
  "",
].join("\n");

/** 変更履歴と、v0.4.0・v0.5.0 の手順を持つパッケージのファイル */
function migrationFiles(options?: {
  stepsV050?: string;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    "migrations/v0.4.0/steps.yaml": STEPS_V040,
    "migrations/v0.5.0/steps.yaml": options?.stepsV050 ?? stepsV050(),
    "docs/guide/変更履歴.md": CHANGELOG,
    ...options?.extra,
  };
}

/** 手元のフォルダを作り、その場所を返却する */
async function createWork(config = OLD_CONFIG): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": config, ...WORK_FILES });
  return dir;
}

/** 手元のフォルダの設定と文書を読み込む */
async function readWork(dir: string): Promise<{
  config: string;
  a: string;
  b: string;
}> {
  return {
    config: await readFile(join(dir, "mdmark.config.yaml"), "utf8"),
    a: await readFile(join(dir, "docs", "a.md"), "utf8"),
    b: await readFile(join(dir, "docs", "b.md"), "utf8"),
  };
}

/** 設定・索引・文書が実行する前と同じ中身で、`.mdmark/` が無いことを確認する */
async function expectUntouched(dir: string, config = OLD_CONFIG) {
  const work = await readWork(dir);
  expect(work.config).toBe(config);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
  expect(work.b).toBe(WORK_FILES["docs/b.md"]);
  expect(existsSync(join(dir, ".mdmark"))).toBe(false);
}

// 2 つのバージョンの手順をバージョンの順に当て、点検に合格してバージョンを書き換える（正常系）
test("test_normal", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  const work = await readWork(dir);
  const config = parse(work.config);
  expect(config.renamed).toBe(1);
  expect(config.legacy).toBeUndefined();
  expect(config.version).toBe("v0.5.0");
  expect(work.config).toContain("# mdmark の設定");
  expect(work.config).toContain("renamed: 1 # 古いキー");
  expect(work.config).toContain('include: ["docs/*.md"]');
  expect(work.a).toBe("# A\n\n<!-- callout -->\n");
  expect(work.b).toBe("# B\n\n<!-- callout -->\n");
  const lines = linesOf(result.stdout);
  const first = lines.indexOf("v0.4.0:");
  const second = lines.indexOf("v0.5.0:");
  expect(first).toBeGreaterThanOrEqual(0);
  expect(second).toBeGreaterThan(first);
  expect(lines.some((line) => line.startsWith("  v0.4.0 #40 "))).toBe(true);
  expect(lines.some((line) => line.startsWith("  v0.5.0 #45 "))).toBe(true);
  expect(lines.some((line) => line.startsWith("  v0.3.0 "))).toBe(false);
  const backup = lines.find((line) => line.startsWith("コピー: "));
  expect(backup).toBeDefined();
  const backupDir = join(dir, (backup ?? "").slice("コピー: ".length));
  expect(await readFile(join(backupDir, "mdmark.config.yaml"), "utf8")).toBe(
    OLD_CONFIG,
  );
  expect(await readFile(join(backupDir, "docs", "a.md"), "utf8")).toBe(
    WORK_FILES["docs/a.md"],
  );
  expect(
    (await readFile(join(dir, ".mdmark", ".gitignore"), "utf8")).trim(),
  ).toBe("*");
});

// --settings で端末の設定に file: config の手順を当て、version を書き換える（正常系（端末の設定を移行する））
test("test_normal_when_settings", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork();
  const terminal = await createTempDir();
  await writeFiles(terminal, {
    "settings.yaml": "# 端末の設定\nversion: v0.3.0\nlegacy: 1\n",
  });
  const settingsPath = join(terminal, "settings.yaml");
  // 実行
  const result = await runUpgrade(pkg, {
    args: ["--settings"],
    cwd: dir,
    env: { MDMARK_CONFIG: settingsPath },
  });
  // 検証
  expect(result.code).toBe(0);
  const after = await readFile(settingsPath, "utf8");
  expect(after).toContain("# 端末の設定");
  const settings = parse(after);
  expect(settings.renamed).toBe(1);
  expect(settings.legacy).toBeUndefined();
  expect(settings.version).toBe("v0.5.0");
  const backup = linesOf(result.stdout).find((line) =>
    line.startsWith("コピー: "),
  );
  expect(backup).toBeDefined();
  expect(
    await readFile(
      join(terminal, (backup ?? "").slice("コピー: ".length), "settings.yaml"),
      "utf8",
    ),
  ).toContain("legacy: 1");
  const work = await readWork(dir);
  expect(work.a).toBe("# A\n\n<!-- note -->\n");
});

// --plan でバージョンごとの手順・変更履歴・壊す手順を示し、何も書き換えない（正常系）
test("test_normal_when_plan", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles({ stepsV050: stepsV050(true) }));
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { args: ["--plan"], cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  const lines = linesOf(result.stdout);
  expect(
    lines.some((line) => line.startsWith("  replace_mark（壊す手順）:")),
  ).toBe(true);
  expect(lines).toContain("--plan のため書き換えていません");
  await expectUntouched(dir);
});

// set_default の ask で値を聞き、回答した値でキーを追加する（正常系）
test("test_normal_when_value_asked", async () => {
  // 準備
  const pkg = packageOf("v0.4.0");
  await setMigrations(pkg, {
    "migrations/v0.4.0/steps.yaml": [
      "steps:",
      "  - op: set_default",
      "    description: title を追加する",
      "    file: config",
      "    key: title",
      "    ask: 書き出す HTML のタイトルを入れてください",
      "",
    ].join("\n"),
    "docs/guide/変更履歴.md": CHANGELOG,
  });
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir, stdin: "設計の文書\n" });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toContain("書き出す HTML のタイトルを入れてください");
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.title).toBe("設計の文書");
  expect(config.version).toBe("v0.4.0");
});

// 設定に version が無いと手元のバージョンを聞き、適用した後に version を追加する（正常系）
test("test_normal_when_version_missing", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const reference = await createWork();
  await runUpgrade(pkg, { cwd: reference });
  const dir = await createWork(CONFIG_WITHOUT_VERSION);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir, stdin: "v0.3.0\n" });
  // 検証
  expect(result.code).toBe(0);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  expect(Object.keys(parse(config))[0]).toBe("version");
  expect(parse(config).version).toBe("v0.5.0");
  const expected = await readWork(reference);
  const actual = await readWork(dir);
  const withoutVersion = (text: string) => text.replace(/^version: .*\n/m, "");
  expect(withoutVersion(actual.config)).toBe(withoutVersion(expected.config));
  expect(actual.a).toBe(expected.a);
  expect(actual.b).toBe(expected.b);
});

// 適用する手順が無ければ何も書き換えずに終わる（正常系）
test("test_normal_when_up_to_date", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const config = OLD_CONFIG.replace("v0.3.0", "v0.5.0");
  const dir = await createWork(config);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(
    "手元のバージョンが目標のバージョンと同じです。適用する手順はありません",
  );
  await expectUntouched(dir, config);
});

// --yes なら壊す手順を確認せずに適用する（正常系）
test("test_normal_when_destructive_with_yes", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles({ stepsV050: stepsV050(true) }));
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { args: ["--yes"], cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).not.toContain("壊す手順を適用してよいですか");
  const work = await readWork(dir);
  expect(work.a).toBe("# A\n\n<!-- callout -->\n");
  expect(parse(work.config).version).toBe("v0.5.0");
});

// 手順が既に該当した設定・文書に同じ手順を適用しても中身が変わらない（正常系）
test("test_normal_when_reapplied", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork();
  await runUpgrade(pkg, { cwd: dir });
  const applied = await readWork(dir);
  // コピーから戻せずに止まった状態にする
  await writeFile(
    join(dir, "mdmark.config.yaml"),
    applied.config.replace("version: v0.5.0", "version: v0.3.0"),
  );
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  expect(await readWork(dir)).toEqual(applied);
});

// 語彙を削除する `call` の手順を当て、文書のタグを書き換えて索引の `schema` を `2` にし、点検に合格させる（正常系（v0.9.0 までの索引からタグの語彙を削除する））
test("test_normal_when_tag_vocabulary_dropped", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  const next = migrationsDirOf("drop-tag-vocabulary.mjs");
  // `steps.yaml` の手順が実行する全てのスクリプトを配置する
  const scripts: Record<string, string> = {};
  for (const name of await readdir(next)) {
    if (name.endsWith(".mjs")) {
      scripts[`migrations/v0.5.0/${name}`] = await readFile(
        join(next, name),
        "utf8",
      );
    }
  }
  await setMigrations(pkg, {
    "migrations/v0.5.0/steps.yaml": await readFile(
      join(next, "steps.yaml"),
      "utf8",
    ),
    ...scripts,
    "docs/guide/変更履歴.md": CHANGELOG,
  });
  const dir = await createWork();
  await writeFile(
    join(dir, "docs", "index.yaml"),
    [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "    tags: [MCP]",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "    tags: [topic:old]",
      "tags:",
      "  - name: topic:mcp",
      "    aliases: [MCP]",
      "  - name: topic:old",
      "    deprecated: topic:mcp",
      "",
    ].join("\n"),
  );
  // 実行
  const result = await runUpgrade(pkg, { args: ["--yes"], cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  const index = parse(await readFile(join(dir, "docs", "index.yaml"), "utf8"));
  expect(index.schema).toBe(2);
  expect("tags" in index).toBe(false);
  expect(index.docs[0].tags).toEqual(["topic:mcp"]);
  expect(index.docs[1].tags).toEqual(["topic:mcp"]);
  expect(parse((await readWork(dir)).config).version).toBe("v0.5.0");
});

// 壊す手順の確認に y 以外を回答すると、何も書き換えずに終わる（異常系）
test("test_error_when_destructive_declined", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles({ stepsV050: stepsV050(true) }));
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir, stdin: "n\n" });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("--yes");
  await expectUntouched(dir);
});

// call のスクリプトが失敗すると、前のバージョンで適用した分もコピーから戻す（異常系）
test("test_error_when_step_fails", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: call",
        "    description: 設定をスクリプトで修正する",
        "    script: fail.mjs",
        "    files: [config]",
        "",
      ].join("\n"),
      extra: { "migrations/v0.5.0/fail.mjs": "process.exit(1);\n" },
    }),
  );
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("v0.5.0");
  expect(result.stderr).toContain("設定をスクリプトで修正する");
  expect(result.stderr).toContain("終了コード 1");
  const work = await readWork(dir);
  expect(work.config).toBe(OLD_CONFIG);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
});

// 適用した後の点検でずれがあると、コピーから戻してずれを出す（異常系）
test("test_error_when_check_fails", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: map_values",
        "    description: build.out を txt として解釈する",
        "    file: config",
        "    key: build.out",
        "    mapping:",
        "      dist/docs.html: dist/docs.txt",
        "",
      ].join("\n"),
    }),
  );
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(
    linesOf(result.stderr).some((line) =>
      line.startsWith("mdmark.config.yaml:build.out: schema:"),
    ),
  ).toBe(true);
  expect((await readWork(dir)).config).toBe(OLD_CONFIG);
});

// 手元のバージョンが呼んだ CLI のバージョンより新しいと、もう一度呼ぶ方法を示して終わる（異常系）
test("test_error_when_local_version_newer", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const config = OLD_CONFIG.replace("v0.3.0", "v0.6.0");
  const dir = await createWork(config);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("v0.6.0");
  expect(result.stderr).toContain("v0.5.0");
  expect(result.stderr).toContain(
    "npx github:shuhei1101/mdmark#v0.6.0 upgrade",
  );
  await expectUntouched(dir, config);
});

// 手元のバージョンの質問に書式の違う回答を返却すると、書式を示して終わる（異常系）
test("test_error_when_version_format_invalid", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork(CONFIG_WITHOUT_VERSION);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir, stdin: "0.3\n" });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("v{MAJOR}.{MINOR}.{PATCH}");
  await expectUntouched(dir, CONFIG_WITHOUT_VERSION);
});

// 質問に回答する前に標準入力が終わると、何も書き換えずに終わる（異常系）
test("test_error_when_answer_missing", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork(CONFIG_WITHOUT_VERSION);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("手元のバージョン");
  expect(result.stderr).toContain("回答がありません");
  await expectUntouched(dir, CONFIG_WITHOUT_VERSION);
});

// 適用するバージョンの steps.yaml が Schema に合わないと、書き換える前に終わる（異常系）
test("test_error_when_steps_invalid", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: replace_mark",
        "    description: マーカー note を書き換える",
        "    from: <!-- note -->",
        "",
      ].join("\n"),
    }),
  );
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("v0.5.0");
  expect(result.stderr).toContain("to");
  await expectUntouched(dir);
});

// 設定ファイルが見つからないと、mdmark init で配置できることを示して終わる（異常系）
test("test_error_when_config_missing", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createTempDir();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("mdmark.config.yaml");
  expect(result.stderr).toContain("mdmark init");
});

// 適用した後の点検で図の定義のずれが見つかると、コピーから戻して終わる（異常系（図の定義のずれ・終了コード 1））
test("test_error_when_diagram_drift", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork();
  const missingTable = shopEr();
  missingTable.relations = missingTable.relations.map((relation) =>
    relation.label === "注文する" ? { ...relation, to: "payments" } : relation,
  );
  const a = [
    WORK_FILES["docs/a.md"],
    "<!-- er -->",
    "",
    "```json",
    JSON.stringify(missingTable),
    "```",
    "",
    "<!-- /er -->",
    "",
  ].join("\n");
  await writeFiles(dir, { "docs/a.md": a });
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(a.split("\n").indexOf("<!-- er -->") + 1).toBe(5);
  expect(result.code).toBe(1);
  const invalid = linesOf(result.stderr).find((line) =>
    line.startsWith("docs/a.md:5: diagram_invalid:"),
  );
  expect(invalid).toContain("payments");
  const work = await readWork(dir);
  expect(work.config).toBe(OLD_CONFIG);
  expect(parse(work.config).version).toBe("v0.3.0");
  expect(work.a).toBe(a);
  expect(work.b).toBe(WORK_FILES["docs/b.md"]);
});

// 廃止した図の範囲を map の範囲へ書き換える call の手順を当て、設定に種類を書き足し、写さない値と読めない範囲を移行の報告に出す（正常系（廃止した図の範囲を map へ書き換える））
test("test_normal_when_retired_diagrams_migrated", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  const next = migrationsDirOf("retired-diagrams.mjs");
  const files: Record<string, string> = {};
  for (const name of await readdir(next)) {
    files[`migrations/v0.5.0/${name}`] = await readFile(
      join(next, name),
      "utf8",
    );
  }
  await setMigrations(pkg, { ...files, "docs/guide/変更履歴.md": CHANGELOG });
  const dir = await createWork();
  const unreadable = [
    "# B",
    "",
    "<!-- flow -->",
    "",
    "```json",
    '{ "title": "壊れた図", "nodes": [',
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
  await writeFiles(dir, {
    "docs/a.md": RETIRED_DOCUMENT,
    "docs/b.md": unreadable,
  });
  // 実行
  const result = await runUpgrade(pkg, { args: ["--yes"], cwd: dir });
  // 検証
  expect(result.code, result.stderr).toBe(0);
  const read = (path: string) => readFile(join(dir, path), "utf8");
  expect(await read("docs/a.md")).toBe(RETIRED_DOCUMENT_CONVERTED);
  expect(await read("docs/b.md")).toBe(unreadable);
  const configText = await read("mdmark.config.yaml");
  const config = parse(configText) as {
    version: string;
    legacy: number;
    map: { kinds: unknown; lines: unknown };
  };
  expect(config.version).toBe("v0.5.0");
  expect(config.legacy).toBe(1);
  expect(configText).toContain("# mdmark の設定");
  expect(configText).toContain("legacy: 1 # 古いキー");
  expect(config.map.kinds).toEqual(RETIRED_KINDS);
  expect(config.map.lines).toEqual(RETIRED_LINES);
  const report = linesOf(result.stdout).map((line) => line.trim());
  for (const item of [
    "scope: メールの受け取りから返信まで",
    "updated: 2026-11-01",
    "stickyTitles: false",
    "scope: 依頼から回答まで",
  ]) {
    expect(
      report.filter((line) =>
        new RegExp(`^docs/a\\.md:\\d+: (flow|sequence): ${item}: .+`).test(
          line,
        ),
      ),
      item,
    ).toHaveLength(1);
  }
  expect(
    report.some((line) =>
      /^docs\/b\.md:3: flow: 範囲: .*JSON として読み込めません/.test(line),
    ),
  ).toBe(true);
  // 書き換えた文書を描くと map の範囲になり、記載の警告が無い
  const { render } = (await import(
    pathToFileURL(join(pkg, "dist", "index.js")).href
  )) as { render: (markdown: string) => string };
  const html = render(await read("docs/a.md"));
  expect(html.match(/class="mdmark-map"/g)).toHaveLength(3);
  expect(html).not.toContain("mdmark-syntax-warning");
});

/** 文書のマーカーを JSON の記載へ書き換える移行の、書き換える前の文書（シナリオ『バージョンを上げる』の 2 つの正常シナリオの文書） */
const LEGACY_MARK_DOCS = {
  "docs/a.md": [
    "# A",
    "",
    "<!-- table: data +count total=数量:sum filter=名前,更新日:date closed -->",
    "",
    "| 名前 | 数量 | 更新日 |",
    "| --- | --- | --- |",
    "| a | 1 | 2026-10-01 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- code: title=app.ts lines highlight=2,4-6 -->",
    "",
    "```ts",
    ...Array.from({ length: 6 }, (_, index) => `const v${index} = ${index};`),
    "```",
    "",
  ].join("\n"),
  "docs/b.md": [
    "# B",
    "",
    "<!-- toc -->",
    "",
    "<!-- details: 実行の例 open -->",
    "",
    "段落",
    "",
    "<!-- /details -->",
    "",
    "<!-- fig: arch -->",
    "",
    '![構成](arch.png "全体の構成")',
    "",
    "<!-- include: src/app.ts#L3-L5 -->",
    "",
    "```markdown",
    "<!-- section: closed -->",
    "```",
    "",
  ].join("\n"),
  "docs/c.md": [
    "<!-- section: closed -->",
    "",
    "# C",
    "",
    "<!-- greet: world -->",
    "",
    "<!-- test-lib: a b -->",
    "",
    "<!-- table: data filter=名前:range -->",
    "",
    "| 名前 |",
    "| --- |",
    "| a |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n"),
};

// 文書のマーカーを書き換える call の手順を当て、今の書き方のマーカーを JSON のオブジェクトにし、書き換えない記載を移行の報告に出す（正常系（文書のマーカーを JSON の記載へ書き換える））
test("test_normal_when_document_marks_migrated", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  const next = migrationsDirOf("marker-json.mjs");
  const files: Record<string, string> = {};
  for (const name of await readdir(next)) {
    files[`migrations/v0.5.0/${name}`] = await readFile(
      join(next, name),
      "utf8",
    );
  }
  await setMigrations(pkg, { ...files, "docs/guide/変更履歴.md": CHANGELOG });
  const dir = await createWork(
    `${OLD_CONFIG}extensions: [extensions/greet.js]\nlibraries:\n  test-lib: lib/test-lib.js\n`,
  );
  await writeFiles(dir, {
    ...LEGACY_MARK_DOCS,
    "docs/index.yaml": [
      "schema: 2",
      "docs:",
      ...["a", "b", "c"].flatMap((id) => [
        `  - id: ${id}`,
        `    path: ${id}.md`,
        `    title: ${id.toUpperCase()}`,
      ]),
      "",
    ].join("\n"),
    "docs/src/app.ts": Array.from(
      { length: 6 },
      (_, index) => `const v${index} = ${index};`,
    ).join("\n"),
    "docs/arch.png": "",
    "extensions/greet.js": GREET_SOURCE,
    "lib/test-lib.js": TEST_LIB_SOURCE,
  });
  const { render } = (await import(
    pathToFileURL(join(pkg, "dist", "index.js")).href
  )) as {
    render: (markdown: string, opts?: { config?: unknown }) => string;
  };
  const config = { libraries: { "test-lib": "lib/test-lib.js" } };
  /** 記載の警告を除いた描いた文字列 */
  const rendered = (markdown: string): string =>
    render(markdown, { config }).replace(
      /<div[^>]*class="mdmark-syntax-warning"[\s\S]*?<\/div>/g,
      "",
    );
  // 実行
  const result = await runUpgrade(pkg, { args: ["--yes"], cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  const read = (path: string) => readFile(join(dir, path), "utf8");
  const [a, b, c] = await Promise.all([
    read("docs/a.md"),
    read("docs/b.md"),
    read("docs/c.md"),
  ]);
  expect(a).toContain(
    '<!-- table: {"kind": "data", "features": {"count": {}}, "columns": {"名前": {"filter": {}}, "更新日": {"filter": {"type": "date"}}}, "collapse": {"open": false}} -->',
  );
  expect(a).not.toContain("total");
  expect(a).toContain(
    '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [2, {"from": 4, "to": 6}]} -->',
  );
  expect(b).toContain('<!-- details: {"title": "実行の例", "open": true} -->');
  expect(b).toContain('<!-- fig: {"id": "arch"} -->');
  expect(b).toContain(
    '<!-- include: {"path": "src/app.ts", "lines": {"from": 3, "to": 5}} -->',
  );
  expect(b).toContain("<!-- toc -->");
  expect(b).toContain("```markdown\n<!-- section: closed -->\n```");
  expect(a.replace(/<!-- (table|code): .*-->/g, "")).toBe(
    LEGACY_MARK_DOCS["docs/a.md"].replace(/<!-- (table|code): .*-->/g, ""),
  );
  expect(c).toContain('<!-- section: {"open": false} -->');
  expect(c).toContain('<!-- table: {"kind": "data"} -->');
  expect(c).toContain("<!-- greet: world -->");
  expect(c).toContain("<!-- test-lib: a b -->");
  const report = linesOf(result.stdout).map((line) => line.trim());
  for (const [file, name, text] of [
    ["docs/a.md", "table", "total=数量:sum"],
    ["docs/c.md", "greet", "world"],
    ["docs/c.md", "test-lib", "a b"],
    ["docs/c.md", "table", "filter=名前:range"],
  ] as const) {
    expect(
      report.filter((line) =>
        new RegExp(
          `^${file}:\\d+: ${name}: [^:]*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^:]*: .+`,
        ).test(line),
      ),
      `${file} ${name} ${text}`,
    ).toHaveLength(1);
  }
  for (const path of ["docs/a.md", "docs/b.md", "docs/c.md"] as const) {
    expect(rendered(await read(path)), path).toBe(
      rendered(LEGACY_MARK_DOCS[path]),
    );
  }
  expect(parse(await read("mdmark.config.yaml")).version).toBe("v0.5.0");
});
