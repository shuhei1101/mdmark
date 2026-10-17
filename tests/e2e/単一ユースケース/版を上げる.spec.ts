import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { test as base, expect, linesOf, runCli, writeFiles } from "../cli.ts";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

/** 呼んだ CLI の版を `v0.5.0` と `v0.4.0` にしてビルドしたパッケージ（ワーカーごとに 1 回作る） */
const test = base.extend<object, { package050: string; package040: string }>({
  package050: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読む
    async ({}, use) => {
      const root = await buildDistRoot("v0.5.0");
      await use(root);
      await removeDistRoot(root);
    },
    { scope: "worker" },
  ],
  package040: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読む
    async ({}, use) => {
      const root = await buildDistRoot("v0.4.0");
      await use(root);
      await removeDistRoot(root);
    },
    { scope: "worker" },
  ],
});

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);
// パッケージの移行の手順をテストごとに差し替えるため、定義した順に 1 つずつ流す
test.describe.configure({ mode: "serial" });

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

/** パッケージの `migrations/` と変更履歴を、テスト用のものに差し替える */
async function setMigrations(
  pkg: string,
  files: Record<string, string>,
): Promise<void> {
  await rm(join(pkg, "migrations"), { recursive: true, force: true });
  await rm(join(pkg, "docs"), { recursive: true, force: true });
  await writeFiles(pkg, files);
}

/** 手元のフォルダを作る */
async function createWork(
  tempDir: () => Promise<string>,
  config = OLD_CONFIG,
): Promise<string> {
  const dir = await tempDir();
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

/** 設定・索引・文書が流す前と同じ中身で、写しのフォルダが無いことを確かめる */
async function expectUntouched(dir: string, config = OLD_CONFIG) {
  const work = await readWork(dir);
  expect(work.config).toBe(config);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
  expect(work.b).toBe(WORK_FILES["docs/b.md"]);
  expect(existsSync(join(dir, ".mdmark"))).toBe(false);
}

// 2 つの版の手順を版の順に当て、点検を通して版を書き換え、変更履歴と写しの場所を出す（正常シナリオ）
test("test_normal", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(package050, migrationFiles());
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir);
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
  expect(first).toBeGreaterThanOrEqual(0);
  expect(lines.indexOf("v0.5.0:")).toBeGreaterThan(first);
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
  // npx が入れるパッケージ（git の clone）に、移行の手順・手順の Schema・変更履歴が入る
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: REPO_ROOT },
  );
  const packed = stdout.split("\0");
  for (const path of [
    "migrations/no-steps.yaml",
    "schemas/mdmark.steps.schema.json",
    "docs/はじめに/変更履歴.md",
  ]) {
    expect(packed).toContain(path);
  }
});

// --plan で版ごとの手順・変更履歴・壊す手順を示し、何も書き換えない（正常シナリオ（当てる前に示す））
test("test_normal_when_plan", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(
    package050,
    migrationFiles({ stepsV050: stepsV050(true) }),
  );
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade", "--plan"], dir);
  // 検証
  expect(result.code).toBe(0);
  const lines = linesOf(result.stdout);
  expect(lines.indexOf("v0.4.0:")).toBeGreaterThanOrEqual(0);
  expect(lines.indexOf("v0.5.0:")).toBeGreaterThan(lines.indexOf("v0.4.0:"));
  expect(
    lines.some((line) => line.startsWith("  replace_mark（壊す手順）:")),
  ).toBe(true);
  expect(lines.some((line) => line.startsWith("  v0.4.0 #40 "))).toBe(true);
  expect(lines.some((line) => line.startsWith("  v0.5.0 #45 "))).toBe(true);
  expect(lines).toContain("--plan のため書き換えていません");
  await expectUntouched(dir);
});

// 値を利用者に聞く手順では、標準入力の答えでキーを足す（正常シナリオ（値を聞く手順がある））
test("test_normal_when_value_asked", async ({ package040, tempDir }) => {
  // 準備
  await setMigrations(package040, {
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
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package040, ["upgrade"], dir, "設計の文書\n");
  // 検証
  expect(result.code).toBe(0);
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.title).toBe("設計の文書");
  expect(config.version).toBe("v0.4.0");
});

// 設定に version が無いと手元の版を聞き、当てた後に version を足す（正常シナリオ（手元の版を持たない設定））
test("test_normal_when_version_missing", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(package050, migrationFiles());
  const reference = await createWork(tempDir);
  await runCli(package050, ["upgrade"], reference);
  const dir = await createWork(tempDir, CONFIG_WITHOUT_VERSION);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir, "v0.3.0\n");
  // 検証
  expect(result.code).toBe(0);
  const config = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  expect(parse(config).version).toBe("v0.5.0");
  const expected = await readWork(reference);
  const actual = await readWork(dir);
  const withoutVersion = (text: string) => text.replace(/^version: .*\n/m, "");
  expect(withoutVersion(actual.config)).toBe(withoutVersion(expected.config));
  expect(actual.a).toBe(expected.a);
  expect(actual.b).toBe(expected.b);
});

// 手元の版が目標の版と同じなら、何も書き換えずに終わる（正常シナリオ（手元の版が目標の版と同じ））
test("test_normal_when_up_to_date", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(package050, migrationFiles());
  const config = OLD_CONFIG.replace("v0.3.0", "v0.5.0");
  const dir = await createWork(tempDir, config);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(
    "手元の版が目標の版と同じです。当てる手順はありません",
  );
  await expectUntouched(dir, config);
});

// 壊す手順の確かめを断ると、何も書き換えずに終わる（正常シナリオ（壊す手順を断る））
test("test_normal_when_destructive_declined", async ({
  package050,
  tempDir,
}) => {
  // 準備
  await setMigrations(
    package050,
    migrationFiles({ stepsV050: stepsV050(true) }),
  );
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir, "n\n");
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("壊す手順を当ててよいですか");
  expect(result.stderr).toContain("何も当てていません");
  expect(result.stderr).toContain("--yes");
  await expectUntouched(dir);
});

// call のスクリプトが失敗すると、前の版で当てた分も写しから戻す（異常シナリオ（手順の途中で失敗する））
test("test_error_when_step_fails", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(
    package050,
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
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("v0.5.0");
  expect(result.stderr).toContain("設定をスクリプトで直す");
  expect(result.stderr).toContain("終了コード 1");
  const work = await readWork(dir);
  expect(work.config).toBe(OLD_CONFIG);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
  expect(work.b).toBe(WORK_FILES["docs/b.md"]);
});

// 当てた後の点検でずれがあると、写しから戻してずれを出す（異常シナリオ（当てた後の点検が通らない））
test("test_error_when_check_fails", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(
    package050,
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
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  expect(
    linesOf(result.stderr).some((line) =>
      line.startsWith("mdmark.config.yaml:build.out: schema:"),
    ),
  ).toBe(true);
  const work = await readWork(dir);
  expect(work.config).toBe(OLD_CONFIG);
  expect(work.a).toBe(WORK_FILES["docs/a.md"]);
});

// 手元の版が目標の版より新しいと、手元の版以上の CLI で呼び直すことを示して終わる（異常シナリオ（手元の版が目標の版より新しい））
test("test_error_when_local_version_newer", async ({ package050, tempDir }) => {
  // 準備
  await setMigrations(package050, migrationFiles());
  const config = OLD_CONFIG.replace("v0.3.0", "v0.6.0");
  const dir = await createWork(tempDir, config);
  // 実行
  const result = await runCli(package050, ["upgrade"], dir);
  // 検証
  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain("v0.6.0");
  expect(result.stderr).toContain("v0.5.0");
  expect(result.stderr).toContain(
    "npx github:shuhei1101/mdmark#v0.6.0 upgrade",
  );
  await expectUntouched(dir, config);
});

// --yes なら壊す手順を確かめずに当てる（正常シナリオ（壊す手順を --yes で当てる））
test("test_normal_when_destructive_with_yes", async ({
  package050,
  tempDir,
}) => {
  // 準備
  await setMigrations(
    package050,
    migrationFiles({ stepsV050: stepsV050(true) }),
  );
  const dir = await createWork(tempDir);
  // 実行
  const result = await runCli(package050, ["upgrade", "--yes"], dir);
  // 検証
  expect(result.code).toBe(0);
  expect(result.stderr).not.toContain("壊す手順を当ててよいですか");
  const work = await readWork(dir);
  const config = parse(work.config);
  expect(config.renamed).toBe(1);
  expect(work.a).toBe("# A\n\n<!-- callout -->\n");
  expect(work.b).toBe("# B\n\n<!-- callout -->\n");
  expect(config.version).toBe("v0.5.0");
});
