import { dirname, join } from "node:path";
import { writeFiles } from "../cli.ts";
import {
  describeError,
  isListening,
  readMcpUrl,
  withMcpClient,
} from "../plugin.ts";
import {
  expect,
  HAS_SYSTEMD,
  pathWithoutSystemctl,
  runSessionStartHook,
  runSetupScript,
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

/** ビルドした作業ツリーの `plugin/` */
const pluginOf = (builtRoot: string) => join(builtRoot, "plugin");

/** 端末の設定に、テスト専用の unit の名前を書き込む */
const writeTestUnit = async (terminal: Terminal) => {
  await writeFiles(dirname(terminal.settingsPath), {
    "settings.yaml": `serve:\n  systemdUnit: ${terminal.unit}\n`,
  });
};

/** フックを実行し、MCP の instructions を受け取る */
const readSessionStart = async (builtRoot: string, terminal: Terminal) => {
  const pluginDir = pluginOf(builtRoot);
  const hook = await runSessionStartHook({ pluginDir, terminal });
  const mcp = await readMcpUrl({ pluginDir, env: terminal.env });
  const instructions = await withMcpClient(
    { builtRoot, serverUrl: mcp.url },
    async (client) => client.getInstructions() ?? "",
  );
  return { hook, instructions };
};

// unit で動く常駐サーバーが待ち受けていればフックは何も出さず、instructions が unit の名前とログを確認する操作を伝える（正常シナリオ）
(HAS_SYSTEMD ? test : test.skip)(
  "test_normal",
  async ({ builtRoot, terminal }) => {
    // 準備
    await writeTestUnit(terminal);
    const started = await runSetupScript({
      pluginDir: pluginOf(builtRoot),
      terminal,
      args: ["start-server"],
    });
    expect(started.code, started.stderr).toBe(0);
    // 実行
    const { hook, instructions } = await readSessionStart(builtRoot, terminal);
    // 検証
    expect(hook).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(instructions).toContain(`unit ${terminal.unit}`);
    expect(instructions).toContain(`journalctl --user -u ${terminal.unit}`);
    expect(instructions).toContain("/mdmark:global-setup");
  },
);

// tmux のセッションで動く常駐サーバーが待ち受けていればフックは何も出さず、instructions がセッション名を伝える（正常シナリオ（tmux のセッションで動いている））
test("test_normal_when_running_in_tmux", async ({
  builtRoot,
  terminal,
  tempDir,
}) => {
  // 準備
  await writeTestUnit(terminal);
  await startTmuxServer(terminal);
  const started = await runSetupScript({
    pluginDir: pluginOf(builtRoot),
    terminal,
    args: ["start-server"],
    env: { PATH: await pathWithoutSystemctl(join(await tempDir(), "bin")) },
  });
  expect(started.code, started.stderr).toBe(0);
  // 実行
  const { hook, instructions } = await readSessionStart(builtRoot, terminal);
  // 検証
  expect(hook).toEqual({ code: 0, stdout: "", stderr: "" });
  expect(instructions).toContain(`tmux のセッション ${SESSION}`);
  expect(instructions).toContain("/mdmark:global-setup");
});

// 常駐サーバーが待ち受けていなければ、フックが起動の仕方を 1 行で指定し、接続は拒否される（異常シナリオ（起動していない））
test("test_error_when_server_not_running", async ({ builtRoot, terminal }) => {
  // 準備
  const pluginDir = pluginOf(builtRoot);
  expect(await isListening(terminal.port)).toBe(false);
  // 実行
  const hook = await runSessionStartHook({ pluginDir, terminal });
  const mcp = await readMcpUrl({ pluginDir, env: terminal.env });
  const connecting = await withMcpClient(
    { builtRoot, serverUrl: mcp.url },
    async () => undefined,
  ).catch((error: unknown) => error);
  // 検証
  expect(hook.code).toBe(0);
  const lines = hook.stdout.split("\n").filter(Boolean);
  expect(lines).toHaveLength(1);
  const context = JSON.parse(lines[0] ?? "").hookSpecificOutput
    .additionalContext as string;
  expect(context).toContain(`127.0.0.1:${terminal.port}`);
  expect(context).toContain("/mdmark:global-setup");
  expect(connecting).toBeInstanceOf(Error);
  expect(describeError(connecting)).toContain("ECONNREFUSED");
});
