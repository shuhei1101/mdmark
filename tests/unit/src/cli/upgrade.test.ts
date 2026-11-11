import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { parse } from "yaml";
import {
  CLEAN_INDEX,
  createAnswers,
  createIo,
  failingAsk,
  useTempDirs,
  writeFiles,
} from "../../helpers/cli.ts";

/** バージョンを上げる処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/upgrade.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// コピーのフォルダ名に使用する時刻（手元の時刻）
const NOW = new Date(2026, 9, 17, 12, 0, 0);

/** 手元のバージョンが古い設定（`legacy` は点検が拒まない最上位の知らないキー） */
const OLD_CONFIG = [
  "# 設定",
  "version: v0.3.0",
  "legacy: 1",
  "index: docs/index.yaml",
  "build:",
  '  include: ["docs/*.md"]',
  "  out: dist/docs.html",
  "",
].join("\n");

/** v0.4.0 の手順: `legacy` を `renamed` に改める */
const STEPS_V040 = [
  "steps:",
  "  - op: rename_key",
  "    description: legacy を renamed に改める",
  "    file: config",
  "    from: legacy",
  "    to: renamed",
  "",
].join("\n");

/** v0.5.0 の手順: 文書のマーカーを書き換える */
const STEPS_V050 = [
  "steps:",
  "  - op: replace_mark",
  "    description: マーカー note を callout に書き換える",
  "    from: <!-- note -->",
  "    to: <!-- callout -->",
  "",
].join("\n");

/** パッケージに入れる変更履歴 */
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

/** バージョンを上げる手順を実行する一時フォルダ（手元のフォルダとパッケージ）を作る */
async function createFixture(options?: {
  config?: string;
  stepsV050?: string;
  packageFiles?: Record<string, string>;
}): Promise<{
  work: string;
  packageDir: string;
  configPath: string;
  read: (path: string) => Promise<string>;
}> {
  const work = await createTempDir();
  const packageDir = await createTempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": options?.config ?? OLD_CONFIG,
    "docs/index.yaml": CLEAN_INDEX,
    "docs/a.md": "# A\n\n<!-- note -->\n",
    "docs/b.md": "# B\n\n<!-- note -->\n",
  });
  await writeFiles(packageDir, {
    "migrations/v0.4.0/steps.yaml": STEPS_V040,
    "migrations/v0.5.0/steps.yaml": options?.stepsV050 ?? STEPS_V050,
    "docs/guide/変更履歴.md": CHANGELOG,
    ...options?.packageFiles,
  });
  return {
    work,
    packageDir,
    configPath: join(work, "mdmark.config.yaml"),
    read: (path) => readFile(join(work, path), "utf8"),
  };
}

// ある version を書き換え、コメントとフロー形式の並びを残す（正常系）
test("test_write_config_version", async () => {
  // 準備
  const { writeConfigVersion } = await loadModule();
  const work = await createTempDir();
  const before = [
    "# 設定",
    "version: v0.3.0",
    "legacy: 1 # 古い",
    "build:",
    '  include: ["**/*.md"]',
    "",
  ].join("\n");
  await writeFiles(work, { "mdmark.config.yaml": before });
  const configPath = join(work, "mdmark.config.yaml");
  // 実行
  await writeConfigVersion(configPath, "v0.5.0");
  // 検証
  expect(await readFile(configPath, "utf8")).toBe(
    before.replace("version: v0.3.0", "version: v0.5.0"),
  );
});

// 無い version を先頭に追加する（正常系）
test("test_write_config_version_when_missing", async () => {
  // 準備
  const { writeConfigVersion } = await loadModule();
  const work = await createTempDir();
  await writeFiles(work, {
    "mdmark.config.yaml": "legacy: 1\ntitle: タイトル\n",
  });
  const configPath = join(work, "mdmark.config.yaml");
  // 実行
  await writeConfigVersion(configPath, "v0.5.0");
  // 検証
  const config = parse(await readFile(configPath, "utf8"));
  expect(Object.keys(config)[0]).toBe("version");
  expect(config).toEqual({ version: "v0.5.0", legacy: 1, title: "タイトル" });
});

// 2 つのバージョンの手順を適用してバージョンを書き換える（正常系）
test("test_run_upgrade", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture();
  const { io, stdout } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  const config = parse(await fixture.read("mdmark.config.yaml"));
  expect(config.renamed).toBe(1);
  expect(config.legacy).toBeUndefined();
  expect(config.version).toBe("v0.5.0");
  expect(await fixture.read("docs/a.md")).toContain("<!-- callout -->");
  expect(await fixture.read("docs/b.md")).toContain("<!-- callout -->");
  expect(stdout.at(-1)).toBe("バージョンを v0.5.0 にしました");
});

// --plan は何も書き換えない（正常系）
test("test_run_upgrade_when_plan", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture();
  const { io } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: true,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  expect(await fixture.read("mdmark.config.yaml")).toBe(OLD_CONFIG);
  expect(await fixture.read("docs/a.md")).toBe("# A\n\n<!-- note -->\n");
  expect(existsSync(join(fixture.work, ".mdmark"))).toBe(false);
});

// 同じバージョンなら何も適用しない（正常系）
test("test_run_upgrade_when_up_to_date", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
    config: OLD_CONFIG.replace("v0.3.0", "v0.5.0"),
  });
  const { io, stdout } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  expect(stdout.join("\n")).toContain("適用する手順はありません");
});

// version が無ければ手元のバージョンを聞く（正常系）
test("test_run_upgrade_when_version_missing", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
    config: OLD_CONFIG.replace("version: v0.3.0\n", ""),
  });
  const { io } = createIo(fixture.work);
  const { ask, asked } = createAnswers(["v0.3.0"]);
  // 実行
  const code = await runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    ask,
  );
  // 検証
  expect(code).toBe(0);
  expect(asked).toHaveLength(1);
  const config = parse(await fixture.read("mdmark.config.yaml"));
  expect(config.version).toBe("v0.5.0");
});

// 手元のバージョンが新しければ CliError（異常系）
test("test_run_upgrade_when_local_newer", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const { CliError } = await loadMain();
  const fixture = await createFixture({
    config: OLD_CONFIG.replace("v0.3.0", "v0.6.0"),
  });
  const { io } = createIo(fixture.work);
  // 実行
  const result = runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("v0.6.0");
  await expect(result).rejects.toThrow("v0.5.0");
  await expect(result).rejects.toThrow(
    "npx github:shuhei1101/mdmark#v0.6.0 upgrade",
  );
});

// 壊す手順を断ると何も書き換えない（異常系）
test("test_run_upgrade_when_declined", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const { CliError } = await loadMain();
  const fixture = await createFixture({
    stepsV050: STEPS_V050.replace(
      "  - op: replace_mark",
      "  - op: replace_mark\n    destructive: true",
    ),
  });
  const { io } = createIo(fixture.work);
  const { ask } = createAnswers(["n"]);
  // 実行
  const result = runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    ask,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("--yes");
  expect(await fixture.read("mdmark.config.yaml")).toBe(OLD_CONFIG);
  expect(existsSync(join(fixture.work, ".mdmark"))).toBe(false);
});

// 手順が失敗するとコピーから戻してもう一度投げる（異常系）
test("test_run_upgrade_when_step_fails", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const { CliError } = await loadMain();
  const fixture = await createFixture({
    stepsV050: [
      "steps:",
      "  - op: call",
      "    description: 設定をスクリプトで修正する",
      "    script: fail.mjs",
      "    files: [config]",
      "",
    ].join("\n"),
    packageFiles: { "migrations/v0.5.0/fail.mjs": "process.exit(1);\n" },
  });
  const { io } = createIo(fixture.work);
  // 実行
  const result = runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  const config = parse(await fixture.read("mdmark.config.yaml"));
  expect(config.legacy).toBe(1);
  expect(config.renamed).toBeUndefined();
  expect(config.version).toBe("v0.3.0");
});

// 点検のずれでコピーから戻し 1 を返却する（異常系）
test("test_run_upgrade_when_check_fails", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
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
  });
  const { io, stderr } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(1);
  expect(
    stderr.some(
      (line) => line.includes("build.out") && line.includes("schema"),
    ),
  ).toBe(true);
  expect(await fixture.read("mdmark.config.yaml")).toBe(OLD_CONFIG);
});

// 質問に回答が無ければ書き換えずに CliError（異常系）
test("test_run_upgrade_when_answer_missing", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const { CliError } = await loadMain();
  const fixture = await createFixture({
    config: OLD_CONFIG.replace("version: v0.3.0\n", ""),
  });
  const { io } = createIo(fixture.work);
  const { ask } = createAnswers([undefined]);
  // 実行
  const result = runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    ask,
  );
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  expect(existsSync(join(fixture.work, ".mdmark"))).toBe(false);
});

// --plan では値を聞く手順があっても聞かない（正常系）
test("test_run_upgrade_when_plan_with_ask", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
    stepsV050: [
      "steps:",
      "  - op: set_default",
      "    description: title を追加する",
      "    file: config",
      "    key: title",
      "    ask: タイトルを入れてください",
      "",
    ].join("\n"),
  });
  const { io } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: true,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  expect(await fixture.read("mdmark.config.yaml")).toBe(OLD_CONFIG);
});

// call のスクリプトが標準出力に書き込んだ行を、手順の行に続けて出す（正常系）
test("test_run_upgrade_when_script_prints", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
    stepsV050: [
      "steps:",
      "  - op: call",
      "    description: 設定をスクリプトで修正する",
      "    script: print.mjs",
      "    files: [config]",
      "",
    ].join("\n"),
    packageFiles: {
      "migrations/v0.5.0/print.mjs":
        'process.stdout.write("除外しました\\n");\n',
    },
  });
  const { io, stdout } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  const index = stdout.findIndex(
    (line, position) =>
      line.startsWith("v0.5.0 の手順「") &&
      stdout[position + 1] === "  除外しました",
  );
  expect(index).toBeGreaterThanOrEqual(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --settings で端末の設定だけを移行する（正常系）
test("test_run_upgrade_when_settings", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture();
  const terminal = await createTempDir();
  await writeFiles(terminal, {
    "settings.yaml": "# 端末の設定\nversion: v0.3.0\nlegacy: 1\n",
  });
  const settingsPath = join(terminal, "settings.yaml");
  vi.stubEnv("MDMARK_CONFIG", settingsPath);
  const { io } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      settings: true,
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  const after = await readFile(settingsPath, "utf8");
  expect(after).toContain("# 端末の設定");
  const settings = parse(after);
  expect(settings.renamed).toBe(1);
  expect(settings.legacy).toBeUndefined();
  expect(settings.version).toBe("v0.5.0");
  expect(await fixture.read("docs/a.md")).toContain("<!-- note -->");
  expect(parse(await fixture.read("mdmark.config.yaml")).version).toBe(
    "v0.3.0",
  );
});

// --settings で files が config だけの call を端末の設定に適用する（正常系）
test("test_run_upgrade_when_settings_with_config_call", async () => {
  // 準備
  const { runUpgrade } = await loadModule();
  const fixture = await createFixture({
    stepsV050: [
      "steps:",
      "  - op: call",
      "    description: 設定をスクリプトで修正する",
      "    script: mark.mjs",
      "    files: [config]",
      "",
    ].join("\n"),
    packageFiles: {
      "migrations/v0.5.0/mark.mjs": [
        'import { appendFileSync } from "node:fs";',
        'const path = process.argv[process.argv.indexOf("--config") + 1];',
        'appendFileSync(path, "migrated: true\\n");',
        "",
      ].join("\n"),
    },
  });
  const terminal = await createTempDir();
  await writeFiles(terminal, {
    "settings.yaml": "version: v0.3.0\n",
  });
  const settingsPath = join(terminal, "settings.yaml");
  vi.stubEnv("MDMARK_CONFIG", settingsPath);
  const { io } = createIo(fixture.work);
  // 実行
  const code = await runUpgrade(
    {
      settings: true,
      plan: false,
      yes: false,
      packageDir: fixture.packageDir,
      cliVersion: "v0.5.0",
      now: NOW,
    },
    io,
    failingAsk,
  );
  // 検証
  expect(code).toBe(0);
  const settings = parse(await readFile(settingsPath, "utf8"));
  expect(settings.migrated).toBe(true);
  expect(settings.version).toBe("v0.5.0");
  expect(await fixture.read("mdmark.config.yaml")).toBe(OLD_CONFIG);
});
