import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { parse } from "yaml";
import { main as buildMain } from "../../../scripts/build.ts";
import { type CliResult, linesOf, useTempDirs, writeFiles } from "../cli.ts";

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

// 配布ファイル 1 つの上限（jsDelivr の 20MB）
const MAX_BYTES = 20 * 1024 * 1024;

// 版を埋めたパッケージをビルドする待つ上限（ミリ秒）
const BUILD_TIMEOUT_MS = 180_000;

const createTempDir = useTempDirs();

/** 版を埋めてビルドしたテスト用のパッケージ（版 → パッケージの直下） */
const packages = new Map<string, string>();

/** 作業ツリーの `src`・`templates` と依存を一時フォルダへ写し、`--version` で版を埋めた `dist/cli.js` をビルドする */
async function buildPackage(version: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-integration-upgrade-"));
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  await cp(join(REPO_ROOT, "templates"), join(root, "templates"), {
    recursive: true,
  });
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
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

/** 版を埋めたパッケージの直下 */
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

/** パッケージの `dist/cli.js` で `upgrade` を流す。終了コードが 0 以外でも例外を投げず、結果を返す */
function runUpgrade(
  pkg: string,
  options: { args?: string[]; cwd: string; stdin?: string },
): Promise<CliResult> {
  return new Promise((resolveResult) => {
    const child = execFile(
      process.execPath,
      [join(pkg, "dist", "cli.js"), "upgrade", ...(options.args ?? [])],
      { cwd: options.cwd },
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

/** 手元の版が古い設定（コメントと、点検が拒まない最上位の知らないキー `legacy` を持つ） */
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

/** 版を持たない設定（v0.3.0 までの `init` が置いた設定） */
const CONFIG_WITHOUT_VERSION = OLD_CONFIG.replace("version: v0.3.0\n", "");

/** 手元のフォルダに置く索引と文書 */
const WORK_FILES = {
  "docs/index.yaml": [
    "schema: 1",
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

/** v0.5.0 の手順: 文書の印を書き換える（`destructive` を付けるときは先頭に足す） */
function stepsV050(destructive = false): string {
  return [
    "steps:",
    "  - op: replace_mark",
    ...(destructive ? ["    destructive: true"] : []),
    "    description: 印 note を callout に書き換える",
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
  "| v0.5.0 | [#45](https://example.com/45) | 注意書きの印の名前を揃える |",
  "| v0.4.0 | [#40](https://example.com/40) | 設定のキーの名前を改める |",
  "| v0.3.0 | [#38](https://example.com/38) | 手元の版より古い行 |",
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
    "docs/はじめに/変更履歴.md": CHANGELOG,
    ...options?.extra,
  };
}

/** 手元のフォルダを作り、その場所を返す */
async function createWork(config = OLD_CONFIG): Promise<string> {
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": config, ...WORK_FILES });
  return dir;
}

/** 手元のフォルダの設定と文書を読む */
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

/** 設定・索引・文書が流す前と同じ中身で、`.mdmark/` が無いことを確かめる */
async function expectUntouched(dir: string, config = OLD_CONFIG) {
  const work = await readWork(dir);
  expect(work.config).toBe(config);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
  expect(work.b).toBe(WORK_FILES["docs/b.md"]);
  expect(existsSync(join(dir, ".mdmark"))).toBe(false);
}

// 2 つの版の手順を版の順に当て、点検を通して版を書き換える（正常系）
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
  const backup = lines.find((line) => line.startsWith("写し: "));
  expect(backup).toBeDefined();
  const backupDir = join(dir, (backup ?? "").slice("写し: ".length));
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

// --plan で版ごとの手順・変更履歴・壊す手順を示し、何も書き換えない（正常系）
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

// set_default の ask で値を聞き、答えた値でキーを足す（正常系）
test("test_normal_when_value_asked", async () => {
  // 準備
  const pkg = packageOf("v0.4.0");
  await setMigrations(pkg, {
    "migrations/v0.4.0/steps.yaml": [
      "steps:",
      "  - op: set_default",
      "    description: title を足す",
      "    file: config",
      "    key: title",
      "    ask: 書き出す HTML の題を入れてください",
      "",
    ].join("\n"),
    "docs/はじめに/変更履歴.md": CHANGELOG,
  });
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir, stdin: "設計の文書\n" });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).toContain("書き出す HTML の題を入れてください");
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.title).toBe("設計の文書");
  expect(config.version).toBe("v0.4.0");
});

// 設定に version が無いと手元の版を聞き、当てた後に version を足す（正常系）
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

// 当てる手順が無ければ何も書き換えずに終わる（正常系）
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
    "手元の版が目標の版と同じです。当てる手順はありません",
  );
  await expectUntouched(dir, config);
});

// --yes なら壊す手順を確かめずに当てる（正常系）
test("test_normal_when_destructive_with_yes", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles({ stepsV050: stepsV050(true) }));
  const dir = await createWork();
  // 実行
  const result = await runUpgrade(pkg, { args: ["--yes"], cwd: dir });
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).not.toContain("壊す手順を当ててよいですか");
  const work = await readWork(dir);
  expect(work.a).toBe("# A\n\n<!-- callout -->\n");
  expect(parse(work.config).version).toBe("v0.5.0");
});

// 手順が既に当たった設定・文書に同じ手順を当てても中身が変わらない（正常系）
test("test_normal_when_reapplied", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork();
  await runUpgrade(pkg, { cwd: dir });
  const applied = await readWork(dir);
  // 写しから戻せずに止まった状態にする
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

// 壊す手順の確かめに y 以外を答えると、何も書き換えずに終わる（異常系）
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

// call のスクリプトが失敗すると、前の版で当てた分も写しから戻す（異常系）
test("test_error_when_step_fails", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: call",
        "    description: 設定をスクリプトで直す",
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
  expect(result.stderr).toContain("設定をスクリプトで直す");
  expect(result.stderr).toContain("1");
  const work = await readWork(dir);
  expect(work.config).toBe(OLD_CONFIG);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
});

// 当てた後の点検でずれがあると、写しから戻してずれを出す（異常系）
test("test_error_when_check_fails", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: map_values",
        "    description: build.out を txt に読み替える",
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

// 手元の版が呼んだ CLI の版より新しいと、呼び直し方を示して終わる（異常系）
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

// 手元の版の問いに書式の違う答えを返すと、書式を示して終わる（異常系）
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

// 問いに答える前に標準入力が終わると、何も書き換えずに終わる（異常系）
test("test_error_when_answer_missing", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(pkg, migrationFiles());
  const dir = await createWork(CONFIG_WITHOUT_VERSION);
  // 実行
  const result = await runUpgrade(pkg, { cwd: dir });
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("手元の版");
  expect(result.stderr).toContain("答えがありません");
  await expectUntouched(dir, CONFIG_WITHOUT_VERSION);
});

// 当てる版の steps.yaml が Schema に合わないと、書き換える前に終わる（異常系）
test("test_error_when_steps_invalid", async () => {
  // 準備
  const pkg = packageOf("v0.5.0");
  await setMigrations(
    pkg,
    migrationFiles({
      stepsV050: [
        "steps:",
        "  - op: replace_mark",
        "    description: 印 note を書き換える",
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

// 設定ファイルが見つからないと、mdmark init で置けることを示して終わる（異常系）
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
