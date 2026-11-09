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
  HAS_SYSTEMD,
  listeningLines,
  pathWithoutSystemctl,
  runGlobalSetup,
  runSetupScript,
  sessionNames,
  startTmuxServer,
  systemctl,
  type Terminal,
  unitListeningLines,
  unitPath,
  unitValue,
} from "../setup-skill.ts";

/** 移行の手順を差し替える、`v0.0.1` を埋めてビルドしたパッケージ（使用するテストだけが作る） */
const test = base.extend<{ upgradePackage: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読み込む
  upgradePackage: async ({}, use) => {
    const root = await buildDistRoot();
    await use(root);
    await removeDistRoot(root);
  },
});

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 既定のセッション名
const SESSION = "mdmark-mcp";
// 常駐サーバーが返却するツールのうち、確認するもの
const TOOLS = ["export_html", "build_site", "check"];
/** 移行の前の端末の設定（`features.table` が真偽値でない）。unit の名前はテスト専用にする */
const oldSettings = (unit: string) =>
  `version: v0.0.0\nfeatures:\n  table: "off"\nserve:\n  systemdUnit: ${unit}\n`;
// テスト専用の移行の手順: `features.table` の `off` を `false` として解釈する
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

/** ファイルの中身。無ければ `null` */
const readOrNull = async (path: string) =>
  existsSync(path) ? await readFile(path, "utf8") : null;

/** 正常シナリオの回答（`features.table` を `false`、unit の名前をテスト専用の名前にする） */
const normalValues = (terminal: Terminal) => ({
  "features.table": "false",
  "serve.systemdUnit": terminal.unit,
});

/** 正常シナリオと同じ回答で global-setup を実行し、セットアップ済みの端末にする */
const setUpTerminal = async (
  builtRoot: string,
  terminal: Terminal,
  env?: Record<string, string>,
) => {
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: normalValues(terminal), approveWrite: true },
    env,
  });
  expect(report.start.code, report.start.stderr).toBe(0);
  return report;
};

/** 既定のセッション名のセッションの数 */
const countSession = async (terminal: Terminal) =>
  (await sessionNames(terminal)).filter((name) => name === SESSION).length;

/** unit の is-enabled と is-active */
const unitStates = async (unit: string) => ({
  enabled: (await systemctl(["is-enabled", unit])).stdout.trim(),
  active: (await systemctl(["is-active", unit])).stdout.trim(),
});

// systemd --user を使用するシナリオは、使えない端末では流さない
const systemdTest = HAS_SYSTEMD ? test : test.skip;

// 空の端末で端末の設定を作り、settings.json に MDMARK_CONFIG を書き込み、unit を記載して enable して常駐サーバーを起動し、フックを確認する（正常シナリオ）
systemdTest("test_normal", async ({ builtRoot, terminal, tempDir }) => {
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: normalValues(terminal), approveWrite: true },
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
  expect(existsSync(unitPath(terminal.unit))).toBe(true);
  expect(await unitStates(terminal.unit)).toEqual({
    enabled: "enabled",
    active: "active",
  });
  expect(await isListening(terminal.port)).toBe(true);
  expect(await unitValue(terminal.unit, "MainPID")).not.toBe("0");
  await expect.poll(() => unitListeningLines(terminal)).toHaveLength(1);
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
  expect(report.written?.keys).toEqual(
    expect.arrayContaining(["features.table", "serve.systemdUnit"]),
  );
  expect(started?.launcher).toBe("systemd");
  expect(started?.unit).toBe(terminal.unit);
  expect(started?.log).toBe(`journalctl --user -u ${terminal.unit}`);
  expect(started?.stop).toBe(`systemctl --user disable --now ${terminal.unit}`);
});

// セットアップ済みの端末では書き換えず、unit を起動し直さない（正常シナリオ（セットアップ済み））
systemdTest(
  "test_normal_when_already_set_up",
  async ({ builtRoot, terminal }) => {
    // 準備
    await setUpTerminal(builtRoot, terminal);
    const before = await readTerminalFiles(terminal);
    const unitFile = await readOrNull(unitPath(terminal.unit));
    const pid = await unitValue(terminal.unit, "MainPID");
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
    expect(await readOrNull(unitPath(terminal.unit))).toBe(unitFile);
    expect(await unitValue(terminal.unit, "MainPID")).toBe(pid);
    const started = report.start.started;
    expect(started?.tools).toEqual(expect.arrayContaining(TOOLS));
    // 最後の報告の材料
    expect(report.written).toBeUndefined();
    expect(started?.result).toBe("already_running");
    expect(started?.unit).toBe(terminal.unit);
  },
);

// 止めた unit を、端末の設定を書き換えずにもう一度起動する（正常シナリオ（常駐サーバーが止まっている））
systemdTest(
  "test_normal_when_server_stopped",
  async ({ builtRoot, terminal }) => {
    // 準備
    await setUpTerminal(builtRoot, terminal);
    const before = await readTerminalFiles(terminal);
    const unitFile = await readOrNull(unitPath(terminal.unit));
    await systemctl(["stop", terminal.unit]);
    await expect.poll(() => isListening(terminal.port)).toBe(false);
    const linesBefore = (await unitListeningLines(terminal)).length;
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: {}, approveWrite: false },
    });
    // 検証
    expect(await readTerminalFiles(terminal)).toEqual(before);
    expect(await readOrNull(unitPath(terminal.unit))).toBe(unitFile);
    expect((await unitStates(terminal.unit)).active).toBe("active");
    expect(await isListening(terminal.port)).toBe(true);
    await expect
      .poll(async () => (await unitListeningLines(terminal)).length)
      .toBe(linesBefore + 1);
    // 最後の報告の材料
    expect(report.start.started?.result).toBe("started");
    expect(report.start.started?.unit).toBe(terminal.unit);
  },
);

// unit の起動するコマンドが今のプラグインと違えば、記載し直して起動し直す（正常シナリオ（プラグインを更新した））
systemdTest(
  "test_normal_when_plugin_updated",
  async ({ builtRoot, terminal }) => {
    // 準備
    const oldCommand = `exec ${terminal.env.MDMARK_SERVE_COMMAND}`;
    await setUpTerminal(builtRoot, terminal, {
      MDMARK_SERVE_COMMAND: oldCommand,
    });
    const pid = await unitValue(terminal.unit, "MainPID");
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: {}, approveWrite: false },
    });
    // 検証
    const unitFile = (await readOrNull(unitPath(terminal.unit))) ?? "";
    expect(unitFile).not.toContain("exec ");
    expect(unitFile).toContain(
      `ExecStart=/bin/sh -c '${(terminal.env.MDMARK_SERVE_COMMAND ?? "").replaceAll("'", "'\\''")}'`,
    );
    expect(await isListening(terminal.port)).toBe(true);
    expect(await unitValue(terminal.unit, "MainPID")).not.toBe(pid);
    // 最後の報告の材料
    expect(report.start.started?.result).toBe("restarted");
    expect(report.start.started?.changes).toEqual(["unit_written"]);
  },
);

// tmux のセッションで動く常駐サーバーを閉じ、unit へ移す（正常シナリオ（tmux のセッションから unit へ移す））
systemdTest(
  "test_normal_when_moved_from_tmux",
  async ({ builtRoot, terminal }) => {
    // 準備
    await startTmuxServer(terminal);
    const tmuxReport = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: {
        values: { ...normalValues(terminal), "serve.launcher": "tmux" },
        approveWrite: true,
      },
    });
    expect(tmuxReport.start.started?.launcher).toBe("tmux");
    const written = await runSetupScript({
      pluginDir: pluginOf(builtRoot),
      terminal,
      args: ["write-settings", "--set", "serve.launcher=auto"],
    });
    expect(written.code, written.stderr).toBe(0);
    expect(existsSync(unitPath(terminal.unit))).toBe(false);
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: {}, approveWrite: false },
    });
    // 検証
    expect(await countSession(terminal)).toBe(0);
    expect((await unitStates(terminal.unit)).active).toBe("active");
    expect(await isListening(terminal.port)).toBe(true);
    // 最後の報告の材料
    expect(report.start.started?.launcher).toBe("systemd");
    expect(report.start.started?.changes).toEqual([
      "tmux_session_closed",
      "unit_written",
    ]);
  },
);

// systemd --user が使えない端末では、tmux のセッションで常駐サーバーを起動する（正常シナリオ（systemd --user が使えない））
test("test_normal_when_systemd_unavailable", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const path = await pathWithoutSystemctl(join(await tempDir(), "bin"));
  await startTmuxServer(terminal);
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: normalValues(terminal), approveWrite: true },
    path,
  });
  // 検証
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.features.table).toBe(false);
  expect(existsSync(unitPath(terminal.unit))).toBe(false);
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  expect(await listeningLines(terminal)).toHaveLength(1);
  // 最後の報告の材料
  const started = report.start.started;
  expect(started?.launcher).toBe("tmux");
  expect(started?.session).toBe(SESSION);
  expect(started?.log).toBe(terminal.logPath);
  expect(started?.stop).toBe(`tmux kill-session -t =${SESSION}`);
});

// 起動の方法を tmux に固定すると、unit を disable --now して tmux のセッションへ移す（正常シナリオ（tmux に固定する））
systemdTest(
  "test_normal_when_fixed_to_tmux",
  async ({ builtRoot, terminal }) => {
    // 準備
    await setUpTerminal(builtRoot, terminal);
    await startTmuxServer(terminal);
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: { "serve.launcher": "tmux" }, approveWrite: true },
    });
    // 検証
    expect(
      parse(await readFile(terminal.settingsPath, "utf8")).serve.launcher,
    ).toBe("tmux");
    const states = await unitStates(terminal.unit);
    expect(states.enabled).not.toBe("enabled");
    expect(states.active).not.toBe("active");
    expect(await countSession(terminal)).toBe(1);
    expect(await isListening(terminal.port)).toBe(true);
    // 最後の報告の材料
    expect(report.start.started?.launcher).toBe("tmux");
    expect(report.start.started?.changes).toEqual(["unit_disabled"]);
  },
);

// 古いバージョンの端末の設定に、コピーを残して移行の手順を適用する（正常シナリオ（古いバージョンの端末の設定））
systemdTest(
  "test_normal_when_settings_outdated",
  async ({ builtRoot, terminal, tempDir, upgradePackage }) => {
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
    const old = oldSettings(terminal.unit);
    await writeFiles(dirname(terminal.settingsPath), { "settings.yaml": old });
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
      line.startsWith("コピー: "),
    );
    expect(backup).toBeDefined();
    expect(
      await readFile(
        join(
          dirname(terminal.settingsPath),
          (backup ?? "").slice("コピー: ".length),
          "settings.yaml",
        ),
        "utf8",
      ),
    ).toBe(old);
  },
);

// 書き込むことを断ると端末の設定と settings.json を書き込まず、unit を記載せずに既定のセッション名で常駐サーバーを起動する（異常シナリオ（書き込むことを断る））
test("test_error_when_write_declined", async ({ builtRoot, terminal }) => {
  // 準備
  await startTmuxServer(terminal);
  const defaultUnit = unitPath("mdmark-mcp");
  const unitBefore = await readOrNull(defaultUnit);
  const enabledBefore = HAS_SYSTEMD
    ? (await systemctl(["is-enabled", "mdmark-mcp"])).stdout.trim()
    : "";
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
  expect(await readOrNull(defaultUnit)).toBe(unitBefore);
  if (HAS_SYSTEMD) {
    expect((await systemctl(["is-enabled", "mdmark-mcp"])).stdout.trim()).toBe(
      enabledBefore,
    );
  }
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  // 最後の報告の材料
  expect(report.written).toBeUndefined();
  expect(report.start.started?.launcher).toBe("tmux");
  expect(report.start.started?.session).toBe(SESSION);
});

// systemd --user も tmux も無いと端末の設定だけを書き込み、端末で mdmark serve を動かすコマンドを返却する（異常シナリオ（systemd --user も tmux も無い））
test("test_error_when_launcher_missing", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const emptyPath = await tempDir();
  // 実行
  const report = await runGlobalSetup({
    pluginDir: pluginOf(builtRoot),
    terminal,
    answers: { values: normalValues(terminal), approveWrite: true },
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
  expect(report.start.stderr).toContain("systemd --user も tmux も");
  expect(report.start.stderr).toContain(`MDMARK_PORT=${terminal.port}`);
  expect(report.start.stderr).toContain("serve");
  expect(report.hook).toBeUndefined();
});

// ポートをほかのプロセスが使用していると、unit を記載せずに修正方法を返却する（異常シナリオ（ポートをほかのプロセスが使用している））
systemdTest("test_error_when_port_in_use", async ({ builtRoot, terminal }) => {
  // 準備
  const other = createServer();
  await new Promise<void>((resolve) =>
    other.listen(terminal.port, "127.0.0.1", () => resolve()),
  );
  try {
    // 実行
    const report = await runGlobalSetup({
      pluginDir: pluginOf(builtRoot),
      terminal,
      answers: { values: normalValues(terminal), approveWrite: true },
    });
    // 検証
    expect(existsSync(unitPath(terminal.unit))).toBe(false);
    expect((await unitStates(terminal.unit)).enabled).not.toBe("enabled");
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
