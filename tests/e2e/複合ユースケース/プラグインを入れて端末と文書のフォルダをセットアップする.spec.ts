import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { installPlugin, uninstallPlugin } from "../claude-plugin.ts";
import { writeFiles } from "../cli.ts";
import {
  callTool,
  indexYaml,
  isListening,
  readMcpUrl,
  withMcpClient,
} from "../plugin.ts";
import {
  checkIssuesOf,
  expect,
  listeningLines,
  panePid,
  type RunResult,
  runFolderSetup,
  runGlobalSetup,
  runSessionStartHook,
  runTmux,
  sessionNames,
  startTmuxServer,
  type Terminal,
  test,
} from "../setup-skill.ts";

// ブラウザを使用しないため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 既定のセッション名
const SESSION = "mdmark-mcp";
// 文書のフォルダの設定ファイル
const CONFIG_FILE = "mdmark.config.yaml";
// 文書のフォルダに配置する Markdown
const DOCUMENT = { "a.md": "# A\n" };

/** フックが `additionalContext` に指定した文。何も出さなければ `null` */
const contextOf = (hook: RunResult): string | null => {
  expect(hook.code).toBe(0);
  if (hook.stdout.trim() === "") {
    return null;
  }
  return JSON.parse(hook.stdout).hookSpecificOutput.additionalContext;
};

/** 端末の設定のセッション名のセッションの数 */
const countSession = async (terminal: Terminal) =>
  (await sessionNames(terminal)).filter((name) => name === SESSION).length;

/** `.mcp.json` の接続先で、作業のフォルダを `dir` にしたクライアントの `check` のずれの一覧 */
const checkOverMcp = async (options: {
  builtRoot: string;
  pluginDir: string;
  terminal: Terminal;
  dir: string;
}): Promise<unknown> => {
  const { builtRoot, pluginDir, terminal, dir } = options;
  const mcp = await readMcpUrl({ pluginDir, env: terminal.env });
  const result = await withMcpClient(
    { builtRoot, serverUrl: mcp.url, projectDir: dir },
    (client) => callTool(client, "check"),
  );
  expect(result.isError).toBe(false);
  return JSON.parse(result.texts[0] ?? "").issues;
};

/** 正常シナリオと同じ回答で、端末と文書のフォルダをセットアップし、文書のフォルダに索引と利用側の CSS を追加してずれを無くす */
const setUpAll = async (options: {
  pluginDir: string;
  terminal: Terminal;
  dir: string;
}) => {
  const { pluginDir, terminal, dir } = options;
  await startTmuxServer(terminal);
  const report = await runGlobalSetup({
    pluginDir,
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: true },
  });
  expect(report.start.code, report.start.stderr).toBe(0);
  await writeFiles(dir, DOCUMENT);
  await runFolderSetup({
    pluginDir,
    terminal,
    dir,
    values: { "features.callout": "false" },
    approveWrite: true,
  });
  await writeFiles(dir, { "index.yaml": indexYaml(["a"]), "theme.css": "" });
};

// プラグインを入れ、起動していないことを受け取り、global-setup と setup で用意して、MCP のツールで書き出す（正常シナリオ）
// ブランチは push 済みであること。tester が release ブランチで `dist/` と `plugin/` の生成物を commit して push した後に実行する
test("test_normal", async ({ builtRoot, terminal, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, DOCUMENT);
  await startTmuxServer(terminal);
  // 実行
  const { installPath } = await installPlugin(
    terminal.env.CLAUDE_CONFIG_DIR ?? "",
  );
  const firstHook = await runSessionStartHook({
    pluginDir: installPath,
    terminal,
  });
  const globalReport = await runGlobalSetup({
    pluginDir: installPath,
    terminal,
    answers: { values: { "features.table": "false" }, approveWrite: true },
  });
  const nextHook = await runSessionStartHook({
    pluginDir: installPath,
    terminal,
  });
  const mcp = await readMcpUrl({ pluginDir: installPath, env: terminal.env });
  const folderReport = await runFolderSetup({
    pluginDir: installPath,
    terminal,
    dir,
    values: { "features.callout": "false" },
    approveWrite: true,
  });
  const { instructions, exported } = await withMcpClient(
    { builtRoot, serverUrl: mcp.url, projectDir: dir },
    async (client) => ({
      instructions: client.getInstructions() ?? "",
      exported: await callTool(client, "export_html", { file: "a.md" }),
    }),
  );
  // 検証
  const notListening = contextOf(firstHook);
  expect(notListening).toContain(`127.0.0.1:${terminal.port}`);
  expect(notListening).toContain("/mdmark:global-setup");
  expect(globalReport.start.started?.session).toBe(SESSION);
  const settings = parse(await readFile(terminal.settingsPath, "utf8"));
  expect(settings.features.table).toBe(false);
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  const claude = JSON.parse(
    await readFile(terminal.claudeSettingsPath, "utf8"),
  );
  expect(claude.env.MDMARK_CONFIG).toBe(terminal.settingsPath);
  expect(await listeningLines(terminal)).toHaveLength(1);
  expect(contextOf(nextHook)).toBeNull();
  expect(instructions).toContain(SESSION);
  const configPath = join(dir, CONFIG_FILE);
  expect(folderReport.written?.written).toEqual([configPath]);
  expect(parse(await readFile(configPath, "utf8")).features.callout).toBe(
    false,
  );
  expect(
    await checkIssuesOf({ builtRoot, terminal, cwd: dir, path: configPath }),
  ).toEqual([]);
  expect(exported.isError).toBe(false);
  const out = JSON.parse(exported.texts[0] ?? "").out as string;
  expect(out).toBe(join(dir, "a.html"));
  expect(existsSync(out)).toBe(true);
});

// セットアップ済みの端末でプラグインをもう一度入れると、global-setup がセッションと端末の設定をそのままにする（正常シナリオ（セットアップ済みの端末でもう一度入れる））
// ブランチは push 済みであること。tester が release ブランチで `dist/` と `plugin/` の生成物を commit して push した後に実行する
test("test_normal_when_already_set_up", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const configDir = terminal.env.CLAUDE_CONFIG_DIR ?? "";
  const dir = await tempDir();
  const installed = await installPlugin(configDir);
  await setUpAll({ pluginDir: installed.installPath, terminal, dir });
  const settingsBefore = await readFile(terminal.settingsPath, "utf8");
  const pid = await panePid(terminal, SESSION);
  await uninstallPlugin(configDir);
  // 実行
  const { installPath } = await installPlugin(configDir);
  const hook = await runSessionStartHook({ pluginDir: installPath, terminal });
  const report = await runGlobalSetup({
    pluginDir: installPath,
    terminal,
    answers: { values: {}, approveWrite: false },
  });
  const issues = await checkOverMcp({
    builtRoot,
    pluginDir: installPath,
    terminal,
    dir,
  });
  // 検証
  expect(contextOf(hook)).toBeNull();
  expect(report.start.started?.result).toBe("already_running");
  expect(await countSession(terminal)).toBe(1);
  expect(await panePid(terminal, SESSION)).toBe(pid);
  expect(await readFile(terminal.settingsPath, "utf8")).toBe(settingsBefore);
  expect(issues).toEqual([]);
});

// 止まった常駐サーバーをセッションの開始で知り、global-setup でもう一度起動して、もう一度接続したクライアントで check を呼ぶ（異常シナリオ（常駐サーバーが止まっている））
test("test_error_when_server_stopped", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  const pluginDir = join(builtRoot, "plugin");
  const dir = await tempDir();
  await setUpAll({ pluginDir, terminal, dir });
  expect(await checkOverMcp({ builtRoot, pluginDir, terminal, dir })).toEqual(
    [],
  );
  const settingsBefore = await readFile(terminal.settingsPath, "utf8");
  await runTmux(terminal, ["kill-session", "-t", `=${SESSION}`]);
  await expect.poll(() => isListening(terminal.port)).toBe(false);
  // 実行
  const hook = await runSessionStartHook({ pluginDir, terminal });
  const report = await runGlobalSetup({
    pluginDir,
    terminal,
    answers: { values: {}, approveWrite: false },
  });
  const issues = await checkOverMcp({ builtRoot, pluginDir, terminal, dir });
  // 検証
  const context = contextOf(hook);
  expect(context).toContain(`127.0.0.1:${terminal.port}`);
  expect(context).toContain("/mdmark:global-setup");
  expect(report.start.started?.result).toBe("started");
  expect(await countSession(terminal)).toBe(1);
  expect(await isListening(terminal.port)).toBe(true);
  expect(await readFile(terminal.settingsPath, "utf8")).toBe(settingsBefore);
  expect(issues).toEqual([]);
});
