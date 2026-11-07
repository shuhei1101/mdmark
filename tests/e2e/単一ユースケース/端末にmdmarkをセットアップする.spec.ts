import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { linesOf, writeFiles } from "../cli.ts";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";
import { isListening } from "../plugin.ts";
import {
  test as base,
  checkIssuesOf,
  expect,
  listeningLines,
  panePid,
  runGlobalSetup,
  runTmux,
  sessionNames,
  startTmuxServer,
  type Terminal,
} from "../setup-skill.ts";

/** 移行の手順を差し替える、`v0.0.1` を埋めてビルドしたパッケージ（使うテストだけが作る） */
const test = base.extend<{ upgradePackage: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読む
  upgradePackage: async ({}, use) => {
    const root = await buildDistRoot();
    await use(root);
    await removeDistRoot(root);
  },
});

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 既定のセッション名
const SESSION = "mdmark-mcp";
// 常駐サーバーが返すツールのうち、確かめるもの
const TOOLS = ["export_html", "build_site", "check"];
// 移行の前の端末の設定（`features.table` が真偽値でない）
const OLD_SETTINGS = 'version: v0.0.0\nfeatures:\n  table: "off"\n';
// テスト専用の移行の手順: `features.table` の `off` を `false` に読み替える
const TEST_STEPS = [
  "steps:",
  "  - op: map_values",
  "    description: features.table の off を false に読み替える",
  "    file: config",
  "    key: features.table",
  "    mapping:",
  '      "off": false',
  "",
].join("\n");
// テスト専用の変更履歴
const TEST_CHANGELOG = [
  "# 変更履歴",
  "",
  "| バージョン | PR | 変更 |",
  "| --- | --- | --- |",
  "| v0.0.1 | [#165](https://example.com/165) | features.table を真偽値にする |",
  "",
].join("\n");

/** ビルドした作業ツリーの `plugin/` */
const pluginOf = (builtRoot: string) => join(builtRoot, "plugin");

/** 端末の設定と settings.json の中身。無ければ `null` */
const readTerminalFiles = async (terminal: Terminal) => ({
  settings: existsSync(terminal.settingsPath)
    ? await readFile(terminal.settingsPath, "utf8")
    : null,
  claude: existsSync(terminal.claudeSettingsPath)
    ? await readFile(terminal.claudeSettingsPath, "utf8")
    : null,
});

/** 正常シナリオと同じ答えで global-setup を流し、セットアップ済みの端末にする */
const setUpTerminal = async (builtRoot: string, terminal: Terminal) => {
  await startTmuxServer(terminal);
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: true },
  });
  expect(report.start.code, report.start.stderr).toBe(0);
};

/** 端末の設定のセッション名のセッションの数 */
const countSession = async (terminal: Terminal) =>
  (await sessionNames(terminal)).filter((name) => name === SESSION).length;

// 空の端末で端末の設定を作り、settings.json に MDMARK_CONFIG を書き、tmux のセッションで常駐サーバーを起動してフックを確かめる（正常シナリオ）
test("test_normal", async ({ builtRoot, terminal, tempDir }) => {
  // 準備
  await startTmuxServer(terminal);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: true },
  });
  // 検証
  expect(report.status.settings.exists).toBe(false);
  expect(report.status.settings.path).toBe(terminal.settingsPath);
  expect(report.askedKeys).toContain("features.table");
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.features.table).toBe(false);
  expect(
    await checkIssuesOf({
      builtRoot,
      terminal,
      cwd: await tempDir(),
      path: terminal.settingsPath,
    }),
  ).toEqual([]);
  const claude = JSON.parse(
    await readFile(terminal.claudeSettingsPath, "utf8"),
  );
  expect(claude.env.MDMARK_CONFIG).toBe(terminal.settingsPath);
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  expect(await listeningLines(terminal)).toHaveLength(1);
  const started = report.start.started;
  expect(started?.result).toBe("started");
  expect(started?.tools).toEqual(expect.arrayContaining(TOOLS));
  expect(report.hook).toEqual({ code: 0, stdout: "", stderr: "" });
  // 最後の報告の材料
  expect(report.written?.written).toEqual(
    expect.arrayContaining([
      terminal.settingsPath,
      terminal.claudeSettingsPath,
    ]),
  );
  expect(report.written?.keys).toEqual(["features.table"]);
  expect(started?.session).toBe(SESSION);
  expect(started?.log).toBe(terminal.logPath);
  expect(started?.stop).toContain(SESSION);
});

// セットアップ済みの端末では書き換えず、セッションを作り直さない（正常シナリオ（セットアップ済み））
test("test_normal_when_already_set_up", async ({ builtRoot, terminal }) => {
  // 準備
  await setUpTerminal(builtRoot, terminal);
  const before = await readTerminalFiles(terminal);
  const pid = await panePid(terminal, SESSION);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: {}, approveWrite: false },
  });
  // 検証
  expect(report.status.settings.version).toBe(
    report.status.settings.target_version,
  );
  expect(await readTerminalFiles(terminal)).toEqual(before);
  expect(await countSession(terminal)).toBe(1);
  expect(await panePid(terminal, SESSION)).toBe(pid);
  const started = report.start.started;
  expect(started?.tools).toEqual(expect.arrayContaining(TOOLS));
  // 最後の報告の材料
  expect(report.written).toBeUndefined();
  expect(started?.result).toBe("already_running");
  expect(started?.session).toBe(SESSION);
});

// 止まった常駐サーバーを、端末の設定を書き換えずに起動し直す（正常シナリオ（常駐サーバーが止まっている））
test("test_normal_when_server_stopped", async ({ builtRoot, terminal }) => {
  // 準備
  await setUpTerminal(builtRoot, terminal);
  const before = await readTerminalFiles(terminal);
  await runTmux(terminal, ["kill-session", "-t", `=${SESSION}`]);
  await expect.poll(() => isListening(terminal.port)).toBe(false);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: {}, approveWrite: false },
  });
  // 検証
  expect(await readTerminalFiles(terminal)).toEqual(before);
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  expect(await listeningLines(terminal)).toHaveLength(2);
  // 最後の報告の材料
  expect(report.start.started?.result).toBe("started");
  expect(report.start.started?.session).toBe(SESSION);
});

// 古いバージョンの端末の設定に、写しを残して移行の手順を当てる（正常シナリオ（古いバージョンの端末の設定））
test("test_normal_when_settings_outdated", async ({
  builtRoot,
  terminal,
  tempDir,
  upgradePackage,
}) => {
  // 準備
  await rm(join(upgradePackage, "migrations"), {
    recursive: true,
    force: true,
  });
  await rm(join(upgradePackage, "docs"), { recursive: true, force: true });
  await writeFiles(upgradePackage, {
    "migrations/v0.0.1/steps.yaml": TEST_STEPS,
    "docs/はじめに/変更履歴.md": TEST_CHANGELOG,
  });
  await writeFiles(dirname(terminal.settingsPath), {
    "settings.yaml": OLD_SETTINGS,
  });
  await startTmuxServer(terminal);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: {}, approveWrite: false, upgradePackage },
  });
  // 検証
  expect(report.status.settings.version).toBe("v0.0.0");
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.version).toBe(report.status.settings.target_version);
  expect(settings.features.table).toBe(false);
  expect(
    await checkIssuesOf({
      builtRoot,
      terminal,
      cwd: await tempDir(),
      path: terminal.settingsPath,
    }),
  ).toEqual([]);
  // 最後の報告の材料
  const backup = linesOf(report.upgrade?.stdout ?? "").find((line) =>
    line.startsWith("写し: "),
  );
  expect(backup).toBeDefined();
  expect(
    await readFile(
      join(
        dirname(terminal.settingsPath),
        (backup ?? "").slice("写し: ".length),
        "settings.yaml",
      ),
      "utf8",
    ),
  ).toBe(OLD_SETTINGS);
});

// 書くことを断ると端末の設定と settings.json を書かず、既定のセッション名で常駐サーバーを起動する（異常シナリオ（書くことを断る））
test("test_error_when_write_declined", async ({ builtRoot, terminal }) => {
  // 準備
  await startTmuxServer(terminal);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: false },
  });
  // 検証
  expect(await readTerminalFiles(terminal)).toEqual({
    settings: null,
    claude: null,
  });
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  // 最後の報告の材料
  expect(report.written).toBeUndefined();
  expect(report.start.started?.session).toBe(SESSION);
});

// tmux が無いと端末の設定だけを書き、端末で mdmark serve を動かすコマンドを返す（異常シナリオ（tmux が無い））
test("test_error_when_tmux_missing", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  await startTmuxServer(terminal);
  const emptyPath = await tempDir();
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: true },
    path: emptyPath,
  });
  // 検証
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.features.table).toBe(false);
  const claude = JSON.parse(
    await readFile(terminal.claudeSettingsPath, "utf8"),
  );
  expect(claude.env.MDMARK_CONFIG).toBe(terminal.settingsPath);
  expect(await isListening(terminal.port)).toBe(false);
  // 最後の報告の材料
  expect(report.start.code).toBe(2);
  expect(report.start.stderr).toContain("tmux");
  expect(report.start.stderr).toContain(`MDMARK_PORT=${terminal.port}`);
  expect(report.start.stderr).toContain("serve");
  expect(report.hook).toBeUndefined();
});

// ポートをほかのプロセスが使っていると、セッションを残さずに修正方法を返す（異常シナリオ（ポートをほかのプロセスが使っている））
test("test_error_when_port_in_use", async ({ builtRoot, terminal }) => {
  // 準備
  await startTmuxServer(terminal);
  const other = createServer();
  await new Promise<void>((resolve) =>
    other.listen(terminal.port, "127.0.0.1", () => resolve()),
  );
  try {
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: {}, approveWrite: true },
    });
    // 検証
    expect(await countSession(terminal)).toBe(0);
    expect(await isListening(terminal.port)).toBe(true);
    expect(other.listening).toBe(true);
    // 最後の報告の材料
    expect(report.start.code).toBe(1);
    expect(report.start.stderr).toContain(String(terminal.port));
    expect(report.start.stderr).toContain("MDMARK_PORT");
    expect(report.start.stderr).toContain("/mdmark:global-setup");
  } finally {
    await new Promise<void>((resolve) => other.close(() => resolve()));
  }
});
